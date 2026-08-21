export const DATABASE_SCHEMA_VERSION = 3;

export type DatabaseMigration = {
  version: number;
  statements: string[];
};

export const databaseMigrations: DatabaseMigration[] = [
  {
    version: DATABASE_SCHEMA_VERSION,
    statements: [
      `CREATE TABLE IF NOT EXISTS moving_projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        moving_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        deleted_at TEXT,
        PRIMARY KEY(project_id, user_id),
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        room_kind TEXT,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        UNIQUE(project_id, id),
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS moving_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        due_at TEXT,
        assignee_id TEXT,
        completed_at TEXT,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        UNIQUE(project_id, id),
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS moving_boxes (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        display_number INTEGER,
        label TEXT NOT NULL DEFAULT '',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        source_room_id TEXT,
        destination_room_id TEXT,
        assignee_id TEXT,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        UNIQUE(project_id, id),
        UNIQUE(project_id, display_number),
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id, source_room_id) REFERENCES rooms(project_id, id),
        FOREIGN KEY(project_id, destination_room_id) REFERENCES rooms(project_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS moving_items (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        box_id TEXT,
        name TEXT NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        UNIQUE(project_id, id),
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id, box_id) REFERENCES moving_boxes(project_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS outbox (
        operation_id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        base_version INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS sync_state (
        project_id TEXT PRIMARY KEY NOT NULL,
        last_pulled_cursor INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS project_change_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(project_id) REFERENCES moving_projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS moving_projects_updated_at_idx ON moving_projects(updated_at)',
      'CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members(project_id, user_id)',
      'CREATE INDEX IF NOT EXISTS rooms_project_filter_idx ON rooms(project_id, room_kind, updated_at)',
      'CREATE INDEX IF NOT EXISTS moving_tasks_project_filter_idx ON moving_tasks(project_id, completed_at, updated_at)',
      'CREATE INDEX IF NOT EXISTS moving_boxes_project_filter_idx ON moving_boxes(project_id, status, updated_at)',
      'CREATE INDEX IF NOT EXISTS moving_items_project_filter_idx ON moving_items(project_id, box_id, updated_at)',
      'CREATE INDEX IF NOT EXISTS outbox_project_order_idx ON outbox(project_id, created_at, operation_id)',
      'CREATE INDEX IF NOT EXISTS project_changes_project_cursor_idx ON project_change_notifications(project_id, id)',
    ],
  },
  {
    version: 2,
    statements: [
      'ALTER TABLE rooms ADD COLUMN color TEXT',
      'ALTER TABLE rooms ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE moving_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE moving_items ADD COLUMN original_location TEXT',
      'ALTER TABLE moving_items ADD COLUMN destination_location TEXT',
      'ALTER TABLE moving_items ADD COLUMN action TEXT',
      'ALTER TABLE moving_boxes ADD COLUMN storage_photo_id TEXT',
      'ALTER TABLE moving_boxes ADD COLUMN marker_rect TEXT',
      'ALTER TABLE moving_tasks ADD COLUMN due_offset_days INTEGER',
      `CREATE TABLE IF NOT EXISTS legacy_import_receipts (
        source_storage_version TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('completed', 'retryable')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        imported_entity_ids_json TEXT NOT NULL DEFAULT '[]',
        last_error TEXT,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 3,
    statements: [
      'ALTER TABLE outbox ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE outbox ADD COLUMN failure_code TEXT',
      'ALTER TABLE moving_items ADD COLUMN status TEXT',
    ],
  },
];
