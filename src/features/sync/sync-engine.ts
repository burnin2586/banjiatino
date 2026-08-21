import { OutboxRepository } from '@/repositories/outbox-repository';
import { SyncStateRepository } from '@/repositories/sync-state-repository';
import {
  notifyProjectCommitted,
  withDatabaseTransaction,
  type DatabaseTransaction,
} from '@/storage/database/connection';
import { mergeRemoteChange, type LocalEntityState } from './merge-rules';
import type {
  EntityType,
  OutboxOperation,
  ProjectChange,
  ProjectChangePage,
} from './sync-types';

export type SyncGateway = {
  applyOperation(operation: OutboxOperation): Promise<unknown>;
  pullChanges(afterCursor: number, pageSize: number): Promise<ProjectChangePage>;
};

export type SyncFailureCode = 'network' | 'validation' | 'rls' | 'unknown';

export type SyncFailure = {
  operationId: string;
  code: SyncFailureCode;
  message: string;
  retryable: boolean;
};

export type SyncSummary = {
  pushed: number;
  pulled: number;
  nextCursor: number;
  failures: SyncFailure[];
  skippedPendingBackoff: number;
  skippedByMerge: number;
};

export type SyncEnginePorts = {
  gateway: SyncGateway;
  now?: () => number;
  pageSize?: number;
};

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 60_000;
const DEFAULT_PAGE_SIZE = 200;

const perProjectLock = new Map<string, Promise<unknown>>();

async function withProjectLock<T>(projectId: string, work: () => Promise<T>): Promise<T> {
  const previous = perProjectLock.get(projectId) ?? Promise.resolve();
  const run = previous.then(work, work);
  perProjectLock.set(
    projectId,
    run.catch(() => undefined),
  );
  try {
    return await run;
  } finally {
    if (perProjectLock.get(projectId) === undefined) {
      perProjectLock.delete(projectId);
    }
  }
}

export function computeBackoffDelayMs(attemptCount: number): number {
  const exponent = Math.min(Math.max(attemptCount, 1) - 1, 6);
  return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CAP_MS);
}

export function classifyGatewayError(error: unknown): { code: SyncFailureCode; retryable: boolean } {
  const message = error instanceof Error ? error.message : String(error);
  if (/network|fetch|timed?\s*out|connection|50\d/i.test(message)) {
    return { code: 'network', retryable: true };
  }
  if (/permission|rls|membership|403|42501/i.test(message)) {
    return { code: 'rls', retryable: false };
  }
  if (/invalid|required|must|expected|payload|22023|denied/i.test(message)) {
    return { code: 'validation', retryable: false };
  }
  return { code: 'unknown', retryable: true };
}

const TABLE_BY_ENTITY: Record<EntityType, string> = {
  room: 'rooms',
  task: 'moving_tasks',
  box: 'moving_boxes',
  item: 'moving_items',
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; code?: unknown };
    const message = typeof record.message === 'string' ? record.message : undefined;
    const code = typeof record.code === 'string' ? record.code : undefined;
    return [code, message].filter(Boolean).join(': ') || JSON.stringify(error);
  }
  return String(error);
}

/**
 * Offline-first sync orchestrator: pushes the outbox FIFO with exponential backoff, then
 * pulls cursor pages whose merge results and cursor advance commit in one local transaction.
 */
export class SyncEngine {
  private readonly gateway: SyncGateway;
  private readonly now: () => number;
  private readonly pageSize: number;
  private readonly outbox = new OutboxRepository();
  private readonly syncState = new SyncStateRepository();

  constructor(ports: SyncEnginePorts) {
    this.gateway = ports.gateway;
    this.now = ports.now ?? (() => Date.now());
    this.pageSize = ports.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  async flush(projectId: string): Promise<SyncSummary> {
    return withProjectLock(projectId, async () => {
      const operations = await this.outbox.listPending(projectId);
      const summary: SyncSummary = {
        pushed: 0,
        pulled: 0,
        nextCursor: 0,
        failures: [],
        skippedPendingBackoff: 0,
        skippedByMerge: 0,
      };

      for (const operation of operations) {
        if (operation.failureCode) continue;
        if ((operation.nextAttemptAt ?? 0) > this.now()) {
          summary.skippedPendingBackoff += 1;
          continue;
        }

        try {
          const confirmation = await this.gateway.applyOperation(operation);
          await this.outbox.delete(operation.operationId);
          await this.applyServerConfirmation(projectId, operation.entityType, confirmation);
          summary.pushed += 1;
        } catch (error) {
          const { code, retryable } = classifyGatewayError(error);
          const attemptCount = operation.attemptCount + 1;
          await this.outbox.markFailure(operation.operationId, {
            attemptCount,
            nextAttemptAt: retryable
              ? this.now() + computeBackoffDelayMs(attemptCount)
              : (operation.nextAttemptAt ?? 0),
            lastError: describeError(error),
            failureCode: retryable ? null : code,
          });
          summary.failures.push({
            operationId: operation.operationId,
            code,
            message: describeError(error),
            retryable,
          });
        }
      }

      return summary;
    });
  }

  async pull(projectId: string): Promise<SyncSummary> {
    return withProjectLock(projectId, async () => {
      const summary: SyncSummary = {
        pushed: 0,
        pulled: 0,
        nextCursor: await this.syncState.getLastPulledCursor(projectId),
        failures: [],
        skippedPendingBackoff: 0,
        skippedByMerge: 0,
      };

      for (;;) {
        const page = await this.gateway.pullChanges(summary.nextCursor, this.pageSize);
        if (page.changes.length === 0) break;

        let applied = 0;
        let pageCommitted = false;
        try {
          await withDatabaseTransaction(async tx => {
            let pageSkipped = 0;
            for (const change of page.changes) {
              const decision = await this.applyRemoteChange(tx, projectId, change);
              if (decision === 'applied') applied += 1;
              if (decision === 'skipped-by-merge') pageSkipped += 1;
            }
            summary.skippedByMerge += pageSkipped;
            await tx.execute(
              `INSERT INTO sync_state (project_id, last_pulled_cursor, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(project_id) DO UPDATE SET
                 last_pulled_cursor = excluded.last_pulled_cursor,
                 updated_at = excluded.updated_at`,
              [projectId, page.nextCursor, new Date().toISOString()],
            );
          });
          pageCommitted = applied > 0;
        } catch (error) {
          const { code, retryable } = classifyGatewayError(error);
          summary.failures.push({
            operationId: `pull@${summary.nextCursor}`,
            code,
            message: describeError(error),
            retryable,
          });
          break;
        }

        summary.pulled += applied;
        summary.nextCursor = page.nextCursor;
        // Pulled rows are new local data; wake project subscribers so screens re-render.
        if (pageCommitted) notifyProjectCommitted(projectId);
        if (page.changes.length < this.pageSize) break;
      }

      return summary;
    });
  }

  async sync(projectId: string): Promise<SyncSummary> {
    const flushed = await this.flush(projectId);
    const pulled = await this.pull(projectId);
    return {
      pushed: flushed.pushed,
      pulled: pulled.pulled,
      nextCursor: pulled.nextCursor,
      failures: [...flushed.failures, ...pulled.failures],
      skippedPendingBackoff: flushed.skippedPendingBackoff,
      skippedByMerge: pulled.skippedByMerge,
    };
  }

  /**
   * A successful apply is the server's authoritative receipt (version, box number); write
   * it onto the local row immediately instead of waiting for the next pull to catch up.
   */
  private async applyServerConfirmation(
    projectId: string,
    entityType: OutboxOperation['entityType'],
    confirmation: unknown,
  ): Promise<void> {
    const envelope = confirmation as { entity?: unknown } | null;
    const entity = envelope?.entity as
      | { id?: unknown; version?: number; display_number?: number | null }
      | undefined;
    if (!entity || typeof entity.id !== 'string') return;
    const entityId = entity.id;

    const table = TABLE_BY_ENTITY[entityType];
    const version = typeof entity.version === 'number' ? entity.version : null;
    if (version === null) return;

    await withDatabaseTransaction(async tx => {
      if (entityType === 'box') {
        await tx.execute(
          `UPDATE ${table} SET version = ?, display_number = ?, sync_status = 'synced' WHERE project_id = ? AND id = ?`,
          [version, entity.display_number ?? null, projectId, entityId],
        );
      } else {
        await tx.execute(
          `UPDATE ${table} SET version = ?, sync_status = 'synced' WHERE project_id = ? AND id = ?`,
          [version, projectId, entityId],
        );
      }
    });
    notifyProjectCommitted(projectId);
  }

  private async applyRemoteChange(
    tx: DatabaseTransaction,
    projectId: string,
    change: ProjectChange,
  ): Promise<'applied' | 'skipped-by-merge' | 'skipped-no-local-row'> {
    const local = await loadLocalEntity(tx, projectId, change.entityType, change.entityId);
    if (!local) {
      if (change.changeType === 'delete') return 'skipped-no-local-row';
      await upsertRemoteRow(tx, projectId, change, null);
      return 'applied';
    }

    const pendingWrite = await this.outbox.hasPendingWrite(projectId, change.entityType, change.entityId);
    const decision = mergeRemoteChange(
      {
        entityType: change.entityType,
        entityId: change.entityId,
        version: local.version,
        deletedAt: local.deletedAt,
        boxStatus: local.boxStatus,
        hasPendingLocalWrite: pendingWrite,
      },
      {
        entityType: change.entityType,
        entityId: change.entityId,
        changeType: change.changeType,
        entityVersion: change.entityVersion,
        boxStatus: change.entityType === 'box' ? readStatus(change.payload) : undefined,
      },
    );

    if (decision.action !== 'acceptRemote') {
      return 'skipped-by-merge';
    }

    await upsertRemoteRow(tx, projectId, change, local);
    return 'applied';
  }
}

type LocalRow = { version: number; deletedAt: string | null; boxStatus?: string | null };

async function loadLocalEntity(
  tx: DatabaseTransaction,
  projectId: string,
  entityType: EntityType,
  entityId: string,
): Promise<LocalRow | null> {
  const table = TABLE_BY_ENTITY[entityType];
  const statusColumn = entityType === 'box' ? ', status' : '';
  const result = await tx.execute(
    `SELECT version, deleted_at${statusColumn} FROM ${table} WHERE project_id = ? AND id = ?`,
    [projectId, entityId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    version: Number(row.version),
    deletedAt: (row.deleted_at as string | null) ?? null,
    boxStatus: entityType === 'box' ? ((row.status as string | null) ?? null) : undefined,
  };
}

function readStatus(payload: Record<string, unknown>): string | null {
  return typeof payload.status === 'string' ? payload.status : null;
}

function text(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === 'string' ? (payload[key] as string) : '';
}

function nullableText(payload: Record<string, unknown>, key: string): string | null {
  return typeof payload[key] === 'string' ? (payload[key] as string) : null;
}

/**
 * Upserts the server projection. Remote-known columns are written; local-only columns
 * (room color/order, item quantity/locations, box marker/photo link, task due offset)
 * keep their local values on conflict.
 */
async function upsertRemoteRow(
  tx: DatabaseTransaction,
  projectId: string,
  change: ProjectChange,
  local: LocalRow | null,
): Promise<void> {
  const payload = change.payload;
  const deletedAt = change.changeType === 'delete'
    ? (nullableText(payload, 'deletedAt') ?? new Date().toISOString())
    : null;
  const version = change.entityVersion;
  const nowIso = new Date().toISOString();
  const createdAt = nullableText(payload, 'created_at') ?? nowIso;
  const updatedAt = nullableText(payload, 'updated_at') ?? nowIso;
  const createdBy = nullableText(payload, 'created_by') ?? 'remote';
  const updatedBy = nullableText(payload, 'updated_by') ?? 'remote';

  if (change.changeType === 'delete' && !local) {
    // Nothing to mark deleted locally; the entity was never imported.
    return;
  }

  switch (change.entityType) {
    case 'room':
      await tx.execute(
        `INSERT INTO rooms (id, project_id, name, room_kind, created_by, updated_by, sync_status, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           name = excluded.name, room_kind = excluded.room_kind, version = excluded.version,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at,
           sync_status = 'synced', deleted_at = excluded.deleted_at`,
        [change.entityId, projectId, text(payload, 'name'), nullableText(payload, 'room_kind'),
          createdBy, updatedBy, version, createdAt, updatedAt, deletedAt],
      );
      break;
    case 'task':
      await tx.execute(
        `INSERT INTO moving_tasks (id, project_id, title, notes, status, completed_at, created_by, updated_by, sync_status, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           title = excluded.title, notes = excluded.notes, status = excluded.status,
           completed_at = excluded.completed_at, version = excluded.version,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at,
           sync_status = 'synced', deleted_at = excluded.deleted_at`,
        [change.entityId, projectId, text(payload, 'title'), nullableText(payload, 'notes'),
          typeof payload.status === 'string' ? payload.status : 'pending',
          nullableText(payload, 'completed_at'), createdBy, updatedBy, version, createdAt, updatedAt, deletedAt],
      );
      break;
    case 'box':
      await tx.execute(
        `INSERT INTO moving_boxes (id, project_id, display_number, label, notes, status, source_room_id, destination_room_id, assignee_id, created_by, updated_by, sync_status, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           display_number = excluded.display_number, label = excluded.label, notes = excluded.notes,
           status = excluded.status, source_room_id = excluded.source_room_id,
           destination_room_id = excluded.destination_room_id, assignee_id = excluded.assignee_id,
           version = excluded.version, updated_by = excluded.updated_by, updated_at = excluded.updated_at,
           sync_status = 'synced', deleted_at = excluded.deleted_at`,
        [change.entityId, projectId,
          payload.display_number === null || payload.display_number === undefined ? null : Number(payload.display_number),
          text(payload, 'label'), nullableText(payload, 'notes'),
          typeof payload.status === 'string' ? payload.status : 'draft',
          nullableText(payload, 'source_room_id'), nullableText(payload, 'destination_room_id'),
          nullableText(payload, 'assignee_id'), createdBy, updatedBy, version, createdAt, updatedAt, deletedAt],
      );
      break;
    case 'item':
      await tx.execute(
        `INSERT INTO moving_items (id, project_id, box_id, name, notes, created_by, updated_by, sync_status, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           box_id = excluded.box_id, name = excluded.name, notes = excluded.notes,
           version = excluded.version, updated_by = excluded.updated_by, updated_at = excluded.updated_at,
           sync_status = 'synced', deleted_at = excluded.deleted_at`,
        [change.entityId, projectId, nullableText(payload, 'box_id'), text(payload, 'name'),
          nullableText(payload, 'notes'), createdBy, updatedBy, version, createdAt, updatedAt, deletedAt],
      );
      break;
  }
}
