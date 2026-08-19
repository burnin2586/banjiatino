import {
  ProjectDataController,
} from './project-data-context';
import { resetDatabaseForTesting, setDatabaseForTesting } from '@/storage/database/connection';
import {
  closeTestDatabase,
  createTestDatabase,
  type TestDatabase,
} from '@/storage/database/test-database';
import { OutboxRepository } from '@/repositories/outbox-repository';
import { notifyProjectCommitted } from '@/storage/database/connection';
import type { KeyValueStorage } from './project-data-context';

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: async key => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
  };
}

const projectId = 'project-1';
const outbox = new OutboxRepository();

describe('ProjectDataController', () => {
  let database: TestDatabase;
  let controller: ProjectDataController;
  let syncFailures: number;
  let commits: number;

  beforeEach(async () => {
    database = await createTestDatabase();
    setDatabaseForTesting(database);
    syncFailures = 0;
    commits = 0;
    controller = new ProjectDataController({
      projectId,
      actorId: 'user-1',
      now: () => 1_786_646_400_000,
      generateId: (() => {
        let counter = 0;
        return () => {
          counter += 1;
          return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
        };
      })(),
      storage: createMemoryStorage(),
      onLocalCommit: () => {
        commits += 1;
        if (syncFailures > 0) throw new Error('sync engine offline');
      },
    });
    await database.execute(
      `INSERT INTO moving_projects (id, name, created_by, created_at, updated_at)
       VALUES (?, 'p', 'user-1', '2026-08-16T00:00:00Z', '2026-08-16T00:00:00Z')`,
      [projectId],
    );
    await controller.load();
  });

  afterEach(async () => {
    await controller.dispose();
    resetDatabaseForTesting();
    if (database) await closeTestDatabase(database);
  });

  it('works on a joined device whose local project row does not exist yet', async () => {
    await database.execute('DELETE FROM moving_projects WHERE id = ?', [projectId]);
    await controller.load();

    await controller.addRoom({ name: '旧厨房', color: '#BFDCCB', kind: 'source' });

    expect(controller.getState().state.rooms.map(room => room.name)).toEqual(['旧厨房']);
    const projects = await database.execute('SELECT COUNT(*) AS value FROM moving_projects');
    expect(Number(projects.rows[0].value)).toBe(1);
  });

  it('exposes repository rows through the shared moving state', async () => {
    await controller.addRoom({ name: '旧厨房', color: '#BFDCCB', kind: 'source' });
    await controller.addBox({
      name: '餐具',
      sourceRoomId: '00000000-0000-4000-8000-000000000001',
      destinationRoomId: '00000000-0000-4000-8000-000000000001',
    });

    const { state } = controller.getState();

    expect(state.rooms.map(room => room.name)).toEqual(['旧厨房']);
    expect(state.boxes).toHaveLength(1);
    expect(state.boxes[0].name).toBe('餐具');
    expect(state.boxes[0].status).toBe('待整理');
    expect(controller.getState().isLoading).toBe(false);
  });

  it('writes the entity and its outbox operation in one commit and wakes the sync engine', async () => {
    await controller.addRoom({ name: '书房', color: '#eee', kind: 'source' });

    const operations = await outbox.listPending(projectId);
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      entityType: 'room',
      action: 'create',
      baseVersion: 0,
      payload: { name: '书房', room_kind: 'source' },
    });
    expect(commits).toBe(1);
  });

  it('keeps locally written data visible when the sync trigger fails', async () => {
    syncFailures = 1;

    await controller.addRoom({ name: '卧室', color: '#fff', kind: 'destination' });

    expect(controller.getState().state.rooms.map(room => room.name)).toEqual(['卧室']);
    expect(await outbox.listPending(projectId)).toHaveLength(1);
  });

  it('reloads when another writer commits to the same project', async () => {
    const listener = jest.fn();
    controller.subscribe(listener);
    await controller.addRoom({ name: '阳台', color: '#fff', kind: 'source' });
    expect(listener).toHaveBeenCalled();

    await database.execute(
      `INSERT INTO rooms (id, project_id, name, room_kind, created_by, updated_by, created_at, updated_at)
       VALUES ('99999999-9999-4999-8999-999999999999', ?, '远端房间', 'source', 'user-2', 'user-2', ?, ?)`,
      [projectId, new Date().toISOString(), new Date().toISOString()],
    );
    notifyProjectCommitted(projectId);
    await controller.whenIdle();

    expect(controller.getState().state.rooms.map(room => room.name)).toEqual(['阳台', '远端房间']);
  });

  it('removes soft-deleted rows from the projection and enqueues a soft_delete operation', async () => {
    await controller.addRoom({ name: '书房', color: '#eee', kind: 'source' });
    const roomId = controller.getState().state.rooms[0].id;
    await controller.deleteRoom(roomId);

    expect(controller.getState().state.rooms).toEqual([]);
    const operations = await outbox.listPending(projectId);
    expect(operations.map(operation => operation.action)).toEqual(['create', 'soft_delete']);
    const rows = await database.execute('SELECT deleted_at FROM rooms WHERE id = ?', [roomId]);
    expect(rows.rows[0].deleted_at).not.toBeNull();
  });

  it('shows 待编号 until the server assigns a display number through a pulled change', async () => {
    await controller.addRoom({ name: '旧厨房', color: '#BFDCCB', kind: 'source' });
    const roomId = controller.getState().state.rooms[0].id;
    await controller.addBox({ name: '餐具', sourceRoomId: roomId, destinationRoomId: roomId });

    const boxId = controller.getState().state.boxes[0].id;
    expect(controller.getState().state.boxes[0].code).toBeNull();

    await database.execute(
      'UPDATE moving_boxes SET display_number = 12 WHERE id = ?',
      [boxId],
    );
    notifyProjectCommitted(projectId);
    await controller.whenIdle();

    expect(controller.getState().state.boxes[0].code).toBe('BOX-012');
  });

  it('maps legacy box statuses onto the collaboration ladder in both directions', async () => {
    await controller.addRoom({ name: '旧厨房', color: '#BFDCCB', kind: 'source' });
    const roomId = controller.getState().state.rooms[0].id;
    await controller.addBox({ name: '餐具', sourceRoomId: roomId, destinationRoomId: roomId });
    const boxId = controller.getState().state.boxes[0].id;

    await controller.setBoxStatus(boxId, '已搬走');

    const operations = await outbox.listPending(projectId);
    expect(operations[operations.length - 1]).toMatchObject({
      entityType: 'box',
      action: 'set_status',
      payload: { status: 'moved' },
    });
    expect(controller.getState().state.boxes[0].status).toBe('已搬走');
    const rows = await database.execute('SELECT status FROM moving_boxes WHERE id = ?', [boxId]);
    expect(rows.rows[0].status).toBe('moved');
  });
});
