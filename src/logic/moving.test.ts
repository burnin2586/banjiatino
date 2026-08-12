import {
  itemStatusForBox,
  migrateStoredState,
  nextBoxCode,
} from '@/logic/moving';
import type { MovingBox, MovingState } from '@/types/moving';

describe('itemStatusForBox', () => {
  it('把“已拆箱”映射为“已安置”', () => {
    expect(itemStatusForBox('已拆箱')).toBe('已安置');
  });

  it('把“已到达”映射为“已到达”', () => {
    expect(itemStatusForBox('已到达')).toBe('已到达');
  });

  it.each(['已装箱', '已搬走'] as const)('把“%s”映射为“已装箱”', (status) => {
    expect(itemStatusForBox(status)).toBe('已装箱');
  });

  it('把“待整理”映射为“待整理”', () => {
    expect(itemStatusForBox('待整理')).toBe('待整理');
  });
});

describe('nextBoxCode', () => {
  it('没有箱子时生成 BOX-001', () => {
    expect(nextBoxCode([])).toBe('BOX-001');
  });

  it('取现有最大箱号 +1', () => {
    const boxes = [{ code: 'BOX-001' }, { code: 'BOX-003' }] as MovingBox[];
    expect(nextBoxCode(boxes)).toBe('BOX-004');
  });

  it('箱号补零到三位', () => {
    const boxes = [{ code: 'BOX-009' }] as MovingBox[];
    expect(nextBoxCode(boxes)).toBe('BOX-010');
  });

  it('忽略不含数字的箱号', () => {
    const boxes = [{ code: '临时箱' }, { code: 'BOX-002' }] as MovingBox[];
    expect(nextBoxCode(boxes)).toBe('BOX-003');
  });
});

describe('migrateStoredState', () => {
  it('null 或非对象时回退到示例数据', () => {
    expect(migrateStoredState(null).schemaVersion).toBe(4);
    expect(migrateStoredState(null).storagePhotos).toEqual([]);
    expect(migrateStoredState('hello').rooms.length).toBeGreaterThan(0);
    expect(migrateStoredState(undefined).boxes).toBeDefined();
  });

  it('完整 V2 数据保留房间与箱子结构', () => {
    const state: MovingState = {
      schemaVersion: 4,
      movingDate: null,
      tasks: [],
      rooms: [
        { id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 },
        { id: 'dest-a', name: '客厅', color: '#fff', kind: 'destination', order: 0 },
      ],
      boxes: [
        {
          id: 'box-1',
          code: 'BOX-001',
          name: '杂物',
          sourceRoomId: 'room-a',
          destinationRoomId: 'dest-a',
          status: '已装箱',
          note: '',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      items: [],
      storagePhotos: [],
    };
    const result = migrateStoredState(state);
    expect(result.rooms).toHaveLength(2);
    expect(result.boxes[0].code).toBe('BOX-001');
    expect(result.boxes[0].sourceRoomId).toBe('room-a');
    expect(result.boxes[0].destinationRoomId).toBe('dest-a');
  });

  it('V1 箱子（只有 roomId）补全来源房间', () => {
    const stored = {
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [
        { id: 'box-1', code: 'BOX-001', name: '杂物', roomId: 'room-a', status: '已装箱' },
      ],
      items: [],
    };
    const result = migrateStoredState(stored);
    expect(result.boxes).toHaveLength(1);
    expect(result.boxes[0].sourceRoomId).toBe('room-a');
    expect(result.boxes[0].destinationRoomId).not.toBe('');
  });

  it('缺失目标房间时从来源房间派生', () => {
    const stored = {
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [],
    };
    const result = migrateStoredState(stored);
    const destinations = result.rooms.filter((room) => room.kind === 'destination');
    expect(destinations).toHaveLength(1);
    expect(destinations[0].name).toBe('客厅');
  });

  it('物品 boxId 指向不存在的箱子时清空', () => {
    const stored = {
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [
        { id: 'item-1', name: '台灯', boxId: 'ghost-box', action: '带走', status: '待整理' },
      ],
    };
    const result = migrateStoredState(stored);
    expect(result.items[0].boxId).toBeNull();
  });

  it('数量为 0 或非法时回退为 1', () => {
    const stored = {
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [{ id: 'item-1', name: '台灯', quantity: 0, action: '带走', status: '待整理' }],
    };
    const result = migrateStoredState(stored);
    expect(result.items[0].quantity).toBe(1);
  });

  it('旧数据补 movingDate=null 与空 tasks，schema 升到 4', () => {
    const stored = {
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [],
    };
    const result = migrateStoredState(stored);
    expect(result.schemaVersion).toBe(4);
    expect(result.movingDate).toBeNull();
    expect(result.tasks).toEqual([]);
  });

  it('保留已有的 movingDate 与 tasks', () => {
    const stored = {
      schemaVersion: 4,
      movingDate: 1_700_000_000_000,
      tasks: [
        { id: 'task-1', title: '约搬家公司', dueOffsetDays: -7, done: false, note: '', createdAt: 1, updatedAt: 2 },
      ],
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [],
    };
    const result = migrateStoredState(stored);
    expect(result.movingDate).toBe(1_700_000_000_000);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('约搬家公司');
  });

  it('tasks 缺 id/title/dueOffsetDays 的非法项被丢弃', () => {
    const stored = {
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [],
      tasks: [
        { id: '', title: '空id', dueOffsetDays: 0, done: false },
        { id: 'ok', title: '缺offset', done: false },
        { id: 'good', title: '合法', dueOffsetDays: -3, done: false },
      ],
    };
    const result = migrateStoredState(stored);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe('good');
    expect(result.tasks[0].title).toBe('合法');
  });
});
