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

describe('legacy import persistence (migration 2)', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(async () => {
    if (database) await closeTestDatabase(database);
  });

  it('adds the import receipt table and legacy data columns', async () => {
    const receipts = await database.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_import_receipts'",
    );
    expect(receipts.rows).toHaveLength(1);

    const receiptColumns = await database.execute('PRAGMA table_info(legacy_import_receipts)');
    expect(receiptColumns.rows.map(column => column.name)).toEqual(expect.arrayContaining([
      'source_storage_version',
      'status',
      'attempt_count',
      'imported_entity_ids_json',
      'last_error',
      'updated_at',
    ]));

    const roomColumns = await database.execute('PRAGMA table_info(rooms)');
    expect(roomColumns.rows.map(column => column.name)).toEqual(expect.arrayContaining([
      'color', 'sort_order',
    ]));

    const itemColumns = await database.execute('PRAGMA table_info(moving_items)');
    expect(itemColumns.rows.map(column => column.name)).toEqual(expect.arrayContaining([
      'quantity', 'original_location', 'destination_location', 'action',
    ]));

    const boxColumns = await database.execute('PRAGMA table_info(moving_boxes)');
    expect(boxColumns.rows.map(column => column.name)).toEqual(expect.arrayContaining([
      'storage_photo_id', 'marker_rect',
    ]));

    const taskColumns = await database.execute('PRAGMA table_info(moving_tasks)');
    expect(taskColumns.rows.map(column => column.name)).toEqual(expect.arrayContaining([
      'due_offset_days',
    ]));
  });
});
