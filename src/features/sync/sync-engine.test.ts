import type { ApplyOperationResult, OutboxOperation, ProjectChange, ProjectChangePage } from './sync-types';
import { resetDatabaseForTesting, setDatabaseForTesting, withDatabaseTransaction } from '@/storage/database/connection';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '@/storage/database/test-database';
import { OutboxRepository } from '@/repositories/outbox-repository';
import { SyncStateRepository } from '@/repositories/sync-state-repository';
import { SyncEngine, type SyncGateway } from './sync-engine';

const projectId = 'project-1';
const outbox = new OutboxRepository();

let clock = 1_000_000;

function operation(index: number, entityType: 'room' | 'box' | 'item' = 'room', entityId = `entity-${index}`): OutboxOperation {
  return {
    operationId: `op-${index}`,
    projectId,
    entityType,
    entityId,
    action: 'create',
    baseVersion: 0,
    payload: { name: `entity-${index}` },
    createdAt: clock + index * 100,
    attemptCount: 0,
  };
}

async function enqueue(...operations: OutboxOperation[]): Promise<void> {
  await withDatabaseTransaction(async tx => {
    for (const item of operations) {
      await outbox.insert(tx, item);
    }
  });
}

class FakeGateway implements SyncGateway {
  readonly appliedOperations: string[] = [];
  readonly pullCalls: { afterCursor: number; pageSize: number }[] = [];
  readonly calls: string[] = [];
  pages: ProjectChangePage[] = [];
  failures = new Map<string, Error>();

  async applyOperation(operation: OutboxOperation): Promise<ApplyOperationResult> {
    this.calls.push(`apply:${operation.operationId}`);
    const failure = this.failures.get(operation.operationId);
    if (failure) throw failure;
    this.appliedOperations.push(operation.operationId);
    return {
      entity: { id: operation.entityId },
      cursor: this.appliedOperations.length,
      operationId: operation.operationId,
    };
  }

  async pullChanges(afterCursor: number, pageSize: number): Promise<ProjectChangePage> {
    this.calls.push(`pull:${afterCursor}`);
    this.pullCalls.push({ afterCursor, pageSize });
    return this.pages.shift() ?? { changes: [], nextCursor: afterCursor };
  }
}

function change(cursor: number, entityType: 'room' | 'box', entityId: string, payload: Record<string, unknown>): ProjectChange {
  return {
    cursor,
    projectId,
    entityType,
    entityId,
    changeType: 'upsert',
    entityVersion: 1,
    payload,
    createdAt: '2026-08-16T00:00:00Z',
  };
}

describe('SyncEngine', () => {
  let database: TestDatabase;
  let gateway: FakeGateway;
  let engine: SyncEngine;
  const syncState = new SyncStateRepository();

  beforeEach(async () => {
    database = await createTestDatabase();
    setDatabaseForTesting(database);
    gateway = new FakeGateway();
    clock = 1_000_000;
    engine = new SyncEngine({ gateway, now: () => clock });
    await withDatabaseTransaction(async tx => {
      await tx.execute(
        `INSERT INTO moving_projects (id, name, created_by, created_at, updated_at)
         VALUES (?, 'p', 'user-1', ?, ?)`,
        [projectId, new Date().toISOString(), new Date().toISOString()],
      );
    });
  });

  afterEach(async () => {
    resetDatabaseForTesting();
    if (database) await closeTestDatabase(database);
  });

  it('submits outbox operations FIFO by creation time', async () => {
    await enqueue(operation(1), operation(2), operation(3));

    const summary = await engine.flush(projectId);

    expect(summary.pushed).toBe(3);
    expect(gateway.appliedOperations).toEqual(['op-1', 'op-2', 'op-3']);
    const pending = await outbox.listPending(projectId);
    expect(pending).toEqual([]);
  });

  it('retries a network failure with exponential backoff and skips inside the window', async () => {
    await enqueue(operation(1));
    gateway.failures.set('op-1', new Error('network request failed'));

    const first = await engine.flush(projectId);
    expect(first.pushed).toBe(0);
    expect(first.failures[0]).toMatchObject({ operationId: 'op-1', retryable: true });
    expect(await outbox.listPending(projectId)).toHaveLength(1);

    clock += 500; // still inside the 1s backoff window
    const skipped = await engine.flush(projectId);
    expect(skipped.skippedPendingBackoff).toBe(1);
    expect(skipped.pushed).toBe(0);

    clock += 5_000; // past the window
    gateway.failures.delete('op-1');
    const retried = await engine.flush(projectId);
    expect(retried.pushed).toBe(1);
    expect(await outbox.listPending(projectId)).toHaveLength(0);
  });

  it('stops retrying validation failures and records a structured code', async () => {
    await enqueue(operation(1), operation(2), operation(3));
    gateway.failures.set('op-2', new Error('payload invalid: name is required'));

    const summary = await engine.flush(projectId);

    expect(summary.pushed).toBe(2);
    expect(summary.failures).toEqual([
      { operationId: 'op-2', code: 'validation', message: expect.stringContaining('name is required'), retryable: false },
    ]);

    clock += 10_000;
    const again = await engine.flush(projectId);
    expect(again.pushed).toBe(0);
    expect(again.skippedPendingBackoff).toBe(0);
    expect(again.failures).toEqual([]);
  });

  it('isolates one failed operation from later independent entities', async () => {
    await enqueue(operation(1, 'room', 'room-1'), operation(2, 'box', 'box-1'), operation(3, 'room', 'room-2'));
    gateway.failures.set('op-2', new Error('payload invalid: label missing'));

    const summary = await engine.flush(projectId);

    expect(gateway.appliedOperations).toEqual(['op-1', 'op-3']);
    expect(summary.failures.map(failure => failure.operationId)).toEqual(['op-2']);
  });

  it('pushes pending operations before pulling during sync', async () => {
    await enqueue(operation(1));
    gateway.pages = [{ changes: [change(1, 'room', 'room-9', { name: '书房' })], nextCursor: 1 }];

    await engine.sync(projectId);

    expect(gateway.calls).toEqual(['apply:op-1', 'pull:0']);
  });

  it('pulls 200-row pages until a short page and persists the cursor after commit', async () => {
    const firstPage: ProjectChange[] = Array.from({ length: 200 }, (_, index) =>
      change(index + 1, 'room', `room-${index}`, { name: `room-${index}` }));
    const secondPage: ProjectChange[] = [change(201, 'room', 'room-final', { name: 'final' })];
    gateway.pages = [
      { changes: firstPage, nextCursor: 200 },
      { changes: secondPage, nextCursor: 201 },
    ];

    const summary = await engine.pull(projectId);

    expect(gateway.pullCalls).toEqual([
      { afterCursor: 0, pageSize: 200 },
      { afterCursor: 200, pageSize: 200 },
    ]);
    expect(summary.pulled).toBe(201);
    expect(summary.nextCursor).toBe(201);
    await expect(syncState.getLastPulledCursor(projectId)).resolves.toBe(201);
    const rooms = await database.execute('SELECT COUNT(*) AS value FROM rooms');
    expect(Number(rooms.rows[0].value)).toBe(201);
  });

  it('does not persist the cursor when applying a page fails', async () => {
    gateway.pages = [
      {
        changes: [
          change(1, 'room', 'room-ok', { name: 'ok' }),
          change(2, 'box', 'box-bad', {
            name: 'orphan box',
            source_room_id: 'missing-room',
            destination_room_id: 'missing-room',
          }),
        ],
        nextCursor: 2,
      },
    ];

    const summary = await engine.pull(projectId);

    expect(summary.failures.length).toBeGreaterThan(0);
    await expect(syncState.getLastPulledCursor(projectId)).resolves.toBe(0);
    const rooms = await database.execute('SELECT COUNT(*) AS value FROM rooms');
    expect(Number(rooms.rows[0].value)).toBe(0);
  });

  it('skips a remote box status regression but still advances the cursor', async () => {
    const inserted = await withDatabaseTransaction(async tx => {
      await tx.execute(
        `INSERT INTO moving_boxes (id, project_id, label, status, created_by, updated_by, created_at, updated_at)
         VALUES ('box-1', ?, '餐具', 'arrived', 'user-1', 'user-1', ?, ?)`,
        [projectId, new Date().toISOString(), new Date().toISOString()],
      );
      await tx.execute('UPDATE moving_boxes SET version = 1 WHERE id = ?', ['box-1']);
      return null;
    });
    expect(inserted).toBeNull();
    gateway.pages = [
      {
        changes: [{
          cursor: 1,
          projectId,
          entityType: 'box',
          entityId: 'box-1',
          changeType: 'upsert',
          entityVersion: 2,
          payload: { id: 'box-1', label: '餐具', status: 'packed', version: 2 },
          createdAt: '2026-08-16T00:00:00Z',
        }],
        nextCursor: 1,
      },
    ];

    const summary = await engine.pull(projectId);

    expect(summary.pulled).toBe(0);
    expect(summary.skippedByMerge).toBe(1);
    await expect(syncState.getLastPulledCursor(projectId)).resolves.toBe(1);
    const boxes = await database.execute('SELECT status, version FROM moving_boxes WHERE id = ?', ['box-1']);
    expect(boxes.rows[0]).toEqual({ status: 'arrived', version: 1 });
  });
});
