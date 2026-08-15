import {
  resetDatabaseForTesting,
  setDatabaseForTesting,
} from '@/storage/database/connection';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '@/storage/database/test-database';
import { SyncStateRepository } from './sync-state-repository';

describe('SyncStateRepository', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
    setDatabaseForTesting(database);
    await database.execute(
      `INSERT INTO moving_projects (id, name, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        'project-a', 'Project A', 'user-a', '2026-08-13T08:00:00.000Z', '2026-08-13T08:00:00.000Z',
        'project-b', 'Project B', 'user-a', '2026-08-13T08:00:00.000Z', '2026-08-13T08:00:00.000Z',
      ],
    );
  });

  afterEach(async () => {
    resetDatabaseForTesting();
    if (database) await closeTestDatabase(database);
  });

  it('stores a project cursor independently from every other project', async () => {
    const repository = new SyncStateRepository();

    await repository.setLastPulledCursor('project-a', 7);
    await repository.setLastPulledCursor('project-b', 11);

    expect(await repository.getLastPulledCursor('project-a')).toBe(7);
    expect(await repository.getLastPulledCursor('project-b')).toBe(11);
  });
});
