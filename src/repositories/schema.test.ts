import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '@/storage/database/test-database';

describe('local collaboration schema', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(async () => {
    if (database) await closeTestDatabase(database);
  });

  it('uses the sync protocol box projection columns and project-scoped indexes', async () => {
    const columns = await database.execute('PRAGMA table_info(moving_boxes)');
    const columnNames = columns.rows.map(column => column.name);
    const indexes = await database.execute('PRAGMA index_list(moving_boxes)');

    expect(columnNames).toEqual(expect.arrayContaining([
      'display_number',
      'label',
      'notes',
      'assignee_id',
      'created_by',
      'updated_by',
      'version',
      'sync_status',
    ]));
    expect(indexes.rows.map(index => index.name)).toContain('moving_boxes_project_filter_idx');
  });

  it('uses the server projection table name for rooms', async () => {
    const tables = await database.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rooms'",
    );

    expect(tables.rows).toHaveLength(1);
  });
});
