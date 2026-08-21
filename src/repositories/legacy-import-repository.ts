import type {
  LegacyImportEntity,
  LegacyImportReceipt,
  LegacyImportRepositories,
  LegacyImportTransaction,
} from '@/features/collaboration/legacy-import';
import type { DatabaseTransaction, DatabaseValue } from '@/storage/database/connection';
import {
  executeDatabaseQuery,
  withDatabaseTransaction,
} from '@/storage/database/connection';

type SqlExecutor = (sql: string, values?: DatabaseValue[]) => Promise<unknown>;

const BOX_STATUS_MAP: Record<string, string> = {
  '待整理': 'draft',
  '已装箱': 'packed',
  '已搬走': 'moved',
  '已到达': 'arrived',
  '已拆箱': 'unpacked',
};

function toIsoTimestamp(value: unknown): string {
  const milliseconds = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : new Date().toISOString();
}

function toNullableIsoTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIsoTimestamp(value);
}

function toNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toNullableInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function mapBoxStatus(status: unknown): string {
  return BOX_STATUS_MAP[typeof status === 'string' ? status : ''] ?? 'draft';
}

function parseDisplayNumber(code: unknown): number | null {
  if (typeof code !== 'string') return null;
  const match = /^BOX-(\d+)$/.exec(code.trim());
  return match ? Number.parseInt(match[1], 10) : null;
}

function mapReceiptRow(row: Record<string, unknown>): LegacyImportReceipt {
  return {
    sourceStorageVersion: row.source_storage_version as string,
    status: row.status as LegacyImportReceipt['status'],
    attemptCount: Number(row.attempt_count),
    importedEntityIds: JSON.parse(row.imported_entity_ids_json as string) as string[],
    ...(row.last_error === null || row.last_error === undefined
      ? {}
      : { lastError: row.last_error as string }),
  };
}

/**
 * SQLite-backed implementation of the legacy-import boundary. Entity writes and the completed
 * receipt share one transaction, so an import is either fully applied or fully rolled back.
 */
export class LegacyImportRepository implements LegacyImportRepositories {
  constructor(
    private readonly projectId: string,
    private readonly actorId = 'legacy-import',
  ) {}

  async ensureProject(name: string, movingDateMs: number | null): Promise<void> {
    const now = new Date().toISOString();
    const movingDate = movingDateMs === null
      ? null
      : new Date(movingDateMs).toISOString().slice(0, 10);

    await executeDatabaseQuery(
      `INSERT INTO moving_projects (id, name, moving_date, status, created_by, version, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, 1, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [this.projectId, name, movingDate, this.actorId, now, now],
    );
  }

  async getReceipt(sourceStorageVersion: string): Promise<LegacyImportReceipt | null> {
    const result = await executeDatabaseQuery(
      `SELECT source_storage_version, status, attempt_count, imported_entity_ids_json, last_error
       FROM legacy_import_receipts
       WHERE source_storage_version = ?`,
      [sourceStorageVersion],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReceiptRow(row) : null;
  }

  async saveReceipt(receipt: LegacyImportReceipt): Promise<void> {
    await this.writeReceipt((sql, values) => executeDatabaseQuery(sql, values), receipt);
  }

  async transaction(work: (transaction: LegacyImportTransaction) => Promise<void>): Promise<void> {
    await withDatabaseTransaction(async tx => {
      await work({
        upsert: entity => this.upsertEntity(tx, entity),
        saveReceipt: receipt => this.writeReceipt(tx.execute, receipt),
      });
    });
  }

  private async writeReceipt(
    execute: SqlExecutor,
    receipt: LegacyImportReceipt,
  ): Promise<void> {
    await execute(
      `INSERT INTO legacy_import_receipts (
         source_storage_version, status, attempt_count, imported_entity_ids_json, last_error, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_storage_version) DO UPDATE SET
         status = excluded.status,
         attempt_count = excluded.attempt_count,
         imported_entity_ids_json = excluded.imported_entity_ids_json,
         last_error = excluded.last_error,
         updated_at = excluded.updated_at`,
      [
        receipt.sourceStorageVersion,
        receipt.status,
        receipt.attemptCount,
        JSON.stringify(receipt.importedEntityIds),
        receipt.lastError ?? null,
        new Date().toISOString(),
      ],
    );
  }

  private async upsertEntity(
    tx: DatabaseTransaction,
    entity: LegacyImportEntity,
  ): Promise<void> {
    const payload = entity.payload;
    const createdAt = toIsoTimestamp(payload.createdAt);
    const updatedAt = toIsoTimestamp(payload.updatedAt);

    switch (entity.type) {
      case 'room':
        await tx.execute(
          `INSERT INTO rooms (
             id, project_id, name, room_kind, color, sort_order,
             created_by, updated_by, sync_status, version, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
           ON CONFLICT(project_id, id) DO UPDATE SET
             name = excluded.name, room_kind = excluded.room_kind, color = excluded.color,
             sort_order = excluded.sort_order, updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`,
          [
            entity.id,
            this.projectId,
            String(payload.name ?? ''),
            toNullableText(payload.roomKind),
            toNullableText(payload.color),
            toNullableInteger(payload.order) ?? 0,
            this.actorId,
            this.actorId,
            createdAt,
            updatedAt,
          ],
        );
        break;
      case 'box':
        await tx.execute(
          `INSERT INTO moving_boxes (
             id, project_id, display_number, label, notes, status,
             source_room_id, destination_room_id, storage_photo_id, marker_rect,
             created_by, updated_by, sync_status, version, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)
           ON CONFLICT(project_id, id) DO UPDATE SET
             display_number = excluded.display_number, label = excluded.label, notes = excluded.notes,
             status = excluded.status, source_room_id = excluded.source_room_id,
             destination_room_id = excluded.destination_room_id,
             storage_photo_id = excluded.storage_photo_id, marker_rect = excluded.marker_rect,
             updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
          [
            entity.id,
            this.projectId,
            parseDisplayNumber(payload.code),
            String(payload.name ?? ''),
            toNullableText(payload.notes),
            mapBoxStatus(payload.status),
            entity.references[0] ?? null,
            entity.references[1] ?? null,
            // The planner already maps legacy photo ids to deterministic import ids.
            toNullableText(payload.storagePhotoId),
            payload.markerRect === null || payload.markerRect === undefined
              ? null
              : JSON.stringify(payload.markerRect),
            this.actorId,
            this.actorId,
            createdAt,
            updatedAt,
          ],
        );
        break;
      case 'item':
        await tx.execute(
          `INSERT INTO moving_items (
             id, project_id, box_id, name, notes, quantity,
             original_location, destination_location, action,
             created_by, updated_by, sync_status, version, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
           ON CONFLICT(project_id, id) DO UPDATE SET
             box_id = excluded.box_id, name = excluded.name, notes = excluded.notes,
             quantity = excluded.quantity, original_location = excluded.original_location,
             destination_location = excluded.destination_location, action = excluded.action,
             updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
          [
            entity.id,
            this.projectId,
            entity.references[0] ?? null,
            String(payload.name ?? ''),
            toNullableText(payload.notes),
            toNullableInteger(payload.quantity) ?? 1,
            toNullableText(payload.originalLocation),
            toNullableText(payload.destinationLocation),
            toNullableText(payload.action),
            this.actorId,
            this.actorId,
            createdAt,
            updatedAt,
          ],
        );
        break;
      case 'task':
        await tx.execute(
          `INSERT INTO moving_tasks (
             id, project_id, title, notes, status, due_offset_days, completed_at,
             created_by, updated_by, sync_status, version, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
           ON CONFLICT(project_id, id) DO UPDATE SET
             title = excluded.title, notes = excluded.notes, status = excluded.status,
             due_offset_days = excluded.due_offset_days, completed_at = excluded.completed_at,
             updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
          [
            entity.id,
            this.projectId,
            String(payload.title ?? ''),
            toNullableText(payload.notes),
            payload.done === true ? 'completed' : 'pending',
            toNullableInteger(payload.dueOffsetDays),
            payload.done === true ? toNullableIsoTimestamp(payload.updatedAt) : null,
            this.actorId,
            this.actorId,
            createdAt,
            updatedAt,
          ],
        );
        break;
      case 'storage_photo':
        // Photo binaries and metadata stay in legacy storage until the photo plan adds the
        // shared photo schema; boxes already record the mapped photo identifier.
        break;
    }
  }
}
