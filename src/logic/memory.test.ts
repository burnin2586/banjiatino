import {
  GRID_SIZE,
  migrateMemoryState,
  nextWallOrder,
  pointOnWall,
  snapPoint,
  snapToGrid,
  wallLength,
} from '@/logic/memory';
import type { Wall } from '@/types/memory';

describe('snapToGrid', () => {
  it('吸附到最近的整数格点', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(GRID_SIZE)).toBe(1);
    expect(snapToGrid(GRID_SIZE * 2.4)).toBe(2);
    expect(snapToGrid(GRID_SIZE * 2.6)).toBe(3);
    expect(snapToGrid(-GRID_SIZE * 0.4)).toBe(0);
    expect(snapToGrid(-GRID_SIZE * 0.6)).toBe(-1);
  });
});

describe('snapPoint', () => {
  it('返回网格整数坐标', () => {
    expect(snapPoint(GRID_SIZE * 1.4, GRID_SIZE * 2.6)).toEqual({ x: 1, y: 3 });
  });
});

describe('pointOnWall', () => {
  const horizontal: Wall = { id: 'w1', x1: 0, y1: 0, x2: 4, y2: 0 };
  const vertical: Wall = { id: 'w2', x1: 2, y1: 0, x2: 2, y2: 6 };

  it('水平墙端点与中点', () => {
    expect(pointOnWall(horizontal, 0)).toEqual({ x: 0, y: 0 });
    expect(pointOnWall(horizontal, 0.5)).toEqual({ x: 2, y: 0 });
    expect(pointOnWall(horizontal, 1)).toEqual({ x: 4, y: 0 });
  });

  it('垂直墙', () => {
    expect(pointOnWall(vertical, 0.5)).toEqual({ x: 2, y: 3 });
  });
});

describe('wallLength', () => {
  it('欧氏距离（网格单位）', () => {
    expect(wallLength({ id: 'w', x1: 0, y1: 0, x2: 3, y2: 4 })).toBe(5);
  });
});

describe('nextWallOrder', () => {
  it('最大 order +1，空为 0', () => {
    expect(nextWallOrder([])).toBe(0);
    expect(nextWallOrder([{ order: 1 }, { order: 3 }] as any)).toBe(4);
  });
});

describe('migrateMemoryState', () => {
  it('null/非对象回退空 state', () => {
    const empty = migrateMemoryState(null);
    expect(empty.schemaVersion).toBe(1);
    expect(empty.houses).toEqual([]);
    expect(empty.rooms).toEqual([]);
    expect(migrateMemoryState('x').houses).toEqual([]);
  });

  it('合法数据保留', () => {
    const state = {
      schemaVersion: 1,
      houses: [{ id: 'h1', name: 'A', order: 0 }],
      rooms: [],
    };
    expect(migrateMemoryState(state).houses).toHaveLength(1);
  });
});
