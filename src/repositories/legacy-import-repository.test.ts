import { resetDatabaseForTesting, setDatabaseForTesting } from '@/storage/database/connection';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '@/storage/database/test-database';
import {
  buildLegacyImportPlan,
  executeLegacyImport,
} from '@/features/collaboration/legacy-import';
import type { MovingState } from '@/types/moving';
import { LegacyImportRepository } from './legacy-import-repository';

const projectId = 'legacy-project';
const legacyActor = 'legacy-import';

const moving: MovingState = {
  schemaVersion: 4,
  movingDate: 1_786_665_600_000,
  rooms: [
    { id: 'source-kitchen', name: '旧厨房', color: '#BFDCCB', kind: 'source', order: 0 },
    { id: 'destination-kitchen', name: '新厨房', color: '#BCD7E8', kind: 'destination', order: 1 },
  ],
  boxes: [{
    id: 'box-1',
    code: 'BOX-001',
    name: '餐具',
    sourceRoomId: 'source-kitchen',
    destinationRoomId: 'destination-kitchen',
    status: '已装箱',
    note: '易碎',
    storagePhotoId: 'storage-photo-1',
    createdAt: 1_786_646_400_000,
    updatedAt: 1_786_646_401_000,
  }],
  items: [{
    id: 'item-1', name: '盘子', quantity: 6, originalLocation: '旧厨房', destinationLocation: '新厨房',
    boxId: 'box-1', action: '带走', status: '已装箱', note: '白色',
    createdAt: 1_786_646_402_000, updatedAt: 1_786_646_403_000,
  }],
  tasks: [{
    id: 'task-1', title: '预约搬家公司', dueOffsetDays: -7, done: false, note: '上午',
    createdAt: 1_786_646_404_000, updatedAt: 1_786_646_405_000,
  }],
  storagePhotos: [{
    id: 'storage-photo-1', imageUri: 'file:///documents/cabinet.jpg', title: '橱柜', createdAt: 1_786_646_406_000,
  }],
};

describe('LegacyImportRepository', () => {
  let database: TestDatabase;
  let repository: LegacyImportRepository;

  beforeEach(async () => {
    database = await createTestDatabase();
    setDatabaseForTesting(database);
    repository = new LegacyImportRepository(projectId, legacyActor);
  });

  afterEach(async () => {
    resetDatabaseForTesting();
    if (database) await closeTestDatabase(database);
  });

  it('returns no receipt for an unseen source-storage version', async () => {
    expect(await repository.getReceipt('banjiatino-moving-state-v1@4')).toBeNull();
  });

  it('ensures the legacy project row exists idempotently', async () => {
    await repository.ensureProject('搬家', 1_786_665_600_000);
    await repository.ensureProject('搬家', 1_786_665_600_000);

    const projects = await database.execute(
      'SELECT id, name, status, created_by FROM moving_projects',
    );
    expect(projects.rows).toEqual([
      { id: projectId, name: '搬家', status: 'active', created_by: legacyActor },
    ]);
  });

  it('imports rooms, boxes, items, and tasks with a completed receipt in one transaction', async () => {
    await repository.ensureProject('搬家', 1_786_665_600_000);
    const plan = buildLegacyImportPlan(moving);

    const receipt = await executeLegacyImport(plan, repository);

    expect(receipt).toMatchObject({
      status: 'completed',
      attemptCount: 1,
      importedEntityIds: plan.entities.map(entity => entity.id),
    });
    await expect(repository.getReceipt(plan.sourceStorageVersion)).resolves.toMatchObject({
      status: 'completed',
    });

    const rooms = await database.execute(
      'SELECT id, name, room_kind, color, sort_order FROM rooms ORDER BY sort_order, id',
    );
    expect(rooms.rows.map(row => ({ ...row }))).toEqual([
      expect.objectContaining({ name: '旧厨房', room_kind: 'source', color: '#BFDCCB', sort_order: 0 }),
      expect.objectContaining({ name: '新厨房', room_kind: 'destination', color: '#BCD7E8', sort_order: 1 }),
    ]);

    const boxes = await database.execute(
      `SELECT id, display_number, label, notes, status, source_room_id, destination_room_id,
              storage_photo_id, marker_rect
       FROM moving_boxes`,
    );
    expect(boxes.rows).toEqual([
      {
        id: 'ea42617c-9748-5b75-addb-8f96a42d8c61',
        display_number: 1,
        label: '餐具',
        notes: '易碎',
        status: 'packed',
        source_room_id: 'c5b73af8-fc91-55aa-ba89-9945a99e8931',
        destination_room_id: '07730deb-b664-567a-bf5d-d6b86e7b93a3',
        storage_photo_id: 'c7310a2f-b4a3-5a50-8cec-3aa2420fa30c',
        marker_rect: null,
      },
    ]);

    const items = await database.execute(
      `SELECT id, name, notes, quantity, original_location, destination_location, action, box_id
       FROM moving_items`,
    );
    expect(items.rows).toEqual([
      {
        id: '3a31d6c5-1a2c-5dd9-ba0b-14ad16be768a',
        name: '盘子',
        notes: '白色',
        quantity: 6,
        original_location: '旧厨房',
        destination_location: '新厨房',
        action: '带走',
        box_id: 'ea42617c-9748-5b75-addb-8f96a42d8c61',
      },
    ]);

    const tasks = await database.execute(
      'SELECT id, title, notes, status, due_offset_days, completed_at FROM moving_tasks',
    );
    expect(tasks.rows).toEqual([
      {
        id: '16b71dbc-3397-56b1-bd41-cb7717dcd163',
        title: '预约搬家公司',
        notes: '上午',
        status: 'pending',
        due_offset_days: -7,
        completed_at: null,
      },
    ]);
  });

  it('maps a completed legacy task to the completed status with a completion timestamp', async () => {
    await repository.ensureProject('搬家', 1_786_665_600_000);
    const done: MovingState = {
      ...moving,
      tasks: [{
        id: 'task-1', title: '预约搬家公司', dueOffsetDays: -7, done: true, note: '上午',
        createdAt: 1_786_646_404_000, updatedAt: 1_786_646_405_000,
      }],
    };

    await executeLegacyImport(buildLegacyImportPlan(done), repository);

    const tasks = await database.execute('SELECT status, completed_at FROM moving_tasks');
    expect(tasks.rows[0]).toMatchObject({ status: 'completed' });
    expect(tasks.rows[0].completed_at).toEqual('2026-08-13T18:40:05.000Z');
  });

  it('rolls back every write and records a retryable receipt when a box references a missing room', async () => {
    await repository.ensureProject('搬家', 1_786_665_600_000);
    const broken: MovingState = { ...moving, rooms: [] };
    const plan = buildLegacyImportPlan(broken);

    const failed = await executeLegacyImport(plan, repository);

    expect(failed).toMatchObject({ status: 'retryable', attemptCount: 1 });
    expect(failed.lastError).toBeTruthy();
    await expect(repository.getReceipt(plan.sourceStorageVersion)).resolves.toMatchObject({
      status: 'retryable',
    });

    for (const table of ['rooms', 'moving_boxes', 'moving_items', 'moving_tasks']) {
      const rows = await database.execute(`SELECT COUNT(*) AS value FROM ${table}`);
      expect(Number(rows.rows[0].value)).toBe(0);
    }
  });

  it('completes on retry after a failed attempt', async () => {
    await repository.ensureProject('搬家', 1_786_665_600_000);
    const brokenPlan = buildLegacyImportPlan({ ...moving, rooms: [] });
    await executeLegacyImport(brokenPlan, repository);

    const receipt = await executeLegacyImport(buildLegacyImportPlan(moving), repository);

    expect(receipt).toMatchObject({ status: 'completed', attemptCount: 2 });
    const boxes = await database.execute('SELECT COUNT(*) AS value FROM moving_boxes');
    expect(Number(boxes.rows[0].value)).toBe(1);
  });
});
