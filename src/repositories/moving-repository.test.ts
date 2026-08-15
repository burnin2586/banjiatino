import {
  resetDatabaseForTesting,
  setDatabaseForTesting,
  withDatabaseTransaction,
} from '@/storage/database/connection';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '@/storage/database/test-database';
import { MovingRepository, type CreateBoxInput } from './moving-repository';
import { OutboxRepository } from './outbox-repository';

const projectA = 'project-a';
const projectB = 'project-b';
const createdAt = '2026-08-13T08:00:00.000Z';

function boxInput(projectId = projectA, id = 'box-a') {
  return {
    box: {
      id,
      projectId,
      displayNumber: 1,
      label: 'Kitchen',
      notes: 'Fragile',
      status: 'draft',
      sourceRoomId: null,
      destinationRoomId: null,
      assigneeId: 'user-a',
      createdBy: 'user-a',
      updatedBy: 'user-a',
      createdAt,
      updatedAt: createdAt,
    },
    operation: {
      operationId: `operation-${id}`,
      projectId,
      entityType: 'box' as const,
      entityId: id,
      action: 'create' as const,
      baseVersion: 0,
      payload: { id, name: 'Kitchen' },
      createdAt: 1_786_646_400_000,
      attemptCount: 0,
    },
  };
}

describe('MovingRepository', () => {
  let database: TestDatabase;
  let moving: MovingRepository;
  let outbox: OutboxRepository;

  beforeEach(async () => {
    database = await createTestDatabase();
    setDatabaseForTesting(database);
    await database.execute(
      `INSERT INTO moving_projects (
        id, name, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [projectA, 'Project A', 'user-a', createdAt, createdAt],
    );
    await database.execute(
      `INSERT INTO moving_projects (
        id, name, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [projectB, 'Project B', 'user-a', createdAt, createdAt],
    );
    moving = new MovingRepository();
    outbox = new OutboxRepository();
  });

  afterEach(async () => {
    resetDatabaseForTesting();
    if (database) await closeTestDatabase(database);
  });

  it('atomically persists a pending box and exactly one outbox operation', async () => {
    const result = await moving.createBox(boxInput());

    expect(result).toMatchObject({
      id: 'box-a',
      projectId: projectA,
      label: 'Kitchen',
      syncStatus: 'pending',
    });
    expect(await moving.listBoxes(projectA)).toEqual([result]);
    expect(await outbox.listPending(projectA)).toEqual([
      expect.objectContaining({
        operationId: 'operation-box-a',
        entityId: 'box-a',
        createdAt: 1_786_646_400_000,
      }),
    ]);
  });

  it('rolls back both box and outbox operation when the outbox insert fails', async () => {
    const listener = jest.fn();
    const unsubscribe = moving.subscribeToProject(projectA, listener);
    database.failNextOutboxInsert(new Error('injected outbox failure'));

    await expect(moving.createBox(boxInput())).rejects.toThrow('injected outbox failure');

    expect(await moving.listBoxes(projectA)).toEqual([]);
    expect(await outbox.listPending(projectA)).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('rejects an outbox operation that does not create this box', async () => {
    const input = boxInput();
    const invalidInput: CreateBoxInput = {
      ...input,
      operation: { ...input.operation, action: 'update' },
    };

    await expect(moving.createBox(invalidInput)).rejects.toThrow('box create operation');

    expect(await moving.listBoxes(projectA)).toEqual([]);
    expect(await outbox.listPending(projectA)).toEqual([]);
  });

  it('aborts a database transaction when work throws', async () => {
    await expect(
      withDatabaseTransaction(async tx => {
        await tx.execute(
          `INSERT INTO moving_projects (id, name, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          ['aborted-project', 'Aborted', 'user-a', createdAt, createdAt],
        );
        throw new Error('abort transaction');
      }),
    ).rejects.toThrow('abort transaction');

    const count = await database.scalar<number>(
      'SELECT COUNT(*) AS value FROM moving_projects WHERE id = ?',
      ['aborted-project'],
    );
    expect(count).toBe(0);
  });

  it('notifies a project subscriber only after its committed projection can be re-queried', async () => {
    const projections: string[] = [];
    const unsubscribe = moving.subscribeToProject(projectA, () => {
      void moving.listBoxes(projectA).then(boxes => {
        projections.push(boxes.map(box => `${box.id}:${box.syncStatus}`).join(','));
      });
    });

    await moving.createBox(boxInput());
    await new Promise<void>(resolve => setImmediate(() => resolve()));

    expect(projections).toEqual(['box-a:pending']);
    unsubscribe();
  });

  it('isolates project subscriptions and cancels the listener that unsubscribes', async () => {
    const projectACalls = jest.fn();
    const projectBCalls = jest.fn();
    const unsubscribeA = moving.subscribeToProject(projectA, projectACalls);
    const unsubscribeB = moving.subscribeToProject(projectB, projectBCalls);

    await moving.createBox(boxInput(projectA, 'box-a'));
    expect(projectACalls).toHaveBeenCalledTimes(1);
    expect(projectBCalls).not.toHaveBeenCalled();

    unsubscribeA();
    await moving.createBox(boxInput(projectB, 'box-b'));
    expect(projectACalls).toHaveBeenCalledTimes(1);
    expect(projectBCalls).toHaveBeenCalledTimes(1);
    unsubscribeB();
  });

  it('returns the committed box when a project listener throws', async () => {
    const unsubscribe = moving.subscribeToProject(projectA, () => {
      throw new Error('listener failure');
    });

    await expect(moving.createBox(boxInput())).resolves.toMatchObject({ id: 'box-a' });
    expect(await moving.listBoxes(projectA)).toHaveLength(1);
    unsubscribe();
  });
});
