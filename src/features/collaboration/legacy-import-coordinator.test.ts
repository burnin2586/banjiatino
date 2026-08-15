import { resetDatabaseForTesting, setDatabaseForTesting } from '@/storage/database/connection';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '@/storage/database/test-database';
import type { MovingState } from '@/types/moving';
import { runLegacyImportAtStartup } from './legacy-import-coordinator';

const projectId = 'legacy-project';

const moving: MovingState = {
  schemaVersion: 4,
  movingDate: 1_786_665_600_000,
  rooms: [
    { id: 'source-kitchen', name: '旧厨房', color: '#BFDCCB', kind: 'source', order: 0 },
  ],
  boxes: [],
  items: [],
  tasks: [],
  storagePhotos: [],
};

describe('runLegacyImportAtStartup', () => {
  let database: TestDatabase;
  let reads: number;
  let legacyState: MovingState | null;

  beforeEach(async () => {
    database = await createTestDatabase();
    setDatabaseForTesting(database);
    reads = 0;
    legacyState = moving;
  });

  afterEach(async () => {
    resetDatabaseForTesting();
    if (database) await closeTestDatabase(database);
  });

  function readLegacyMovingState(): Promise<MovingState | null> {
    reads += 1;
    return Promise.resolve(legacyState);
  }

  it('imports legacy state once and skips repeat runs after completion', async () => {
    const first = await runLegacyImportAtStartup({
      projectId,
      projectName: '搬家',
      readLegacyMovingState,
    });
    const second = await runLegacyImportAtStartup({
      projectId,
      projectName: '搬家',
      readLegacyMovingState,
    });

    expect(first).toMatchObject({ status: 'completed', attemptCount: 1 });
    expect(second).toMatchObject(first!);

    const rooms = await database.execute('SELECT COUNT(*) AS value FROM rooms');
    expect(Number(rooms.rows[0].value)).toBe(1);
  });

  it('returns null when no legacy state exists', async () => {
    legacyState = null;

    await expect(runLegacyImportAtStartup({
      projectId,
      projectName: '搬家',
      readLegacyMovingState,
    })).resolves.toBeNull();
    expect(reads).toBe(1);
  });

  it('surfaces a retryable receipt on failure and retries on the next startup', async () => {
    const broken: MovingState = {
      ...moving,
      boxes: [{
        id: 'box-1', code: 'BOX-001', name: '餐具',
        sourceRoomId: 'missing-room', destinationRoomId: 'missing-room',
        status: '已装箱', note: '', createdAt: 1, updatedAt: 1,
      }],
    };
    let calls = 0;
    const reader = () => {
      calls += 1;
      return Promise.resolve(calls === 1 ? broken : moving);
    };

    const failed = await runLegacyImportAtStartup({
      projectId, projectName: '搬家', readLegacyMovingState: reader,
    });
    const retried = await runLegacyImportAtStartup({
      projectId, projectName: '搬家', readLegacyMovingState: reader,
    });

    expect(failed).toMatchObject({ status: 'retryable', attemptCount: 1 });
    expect(retried).toMatchObject({ status: 'completed', attemptCount: 2 });
    const boxes = await database.execute('SELECT COUNT(*) AS value FROM moving_boxes');
    expect(Number(boxes.rows[0].value)).toBe(0);
  });
});
