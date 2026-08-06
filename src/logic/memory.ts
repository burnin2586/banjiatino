import type { MemoryState, Wall } from '@/types/memory';

export const GRID_SIZE = 24;

export function snapToGrid(v: number): number {
  const result = Math.round(v / GRID_SIZE);
  return Object.is(result, -0) ? 0 : result;
}

export function snapPoint(x: number, y: number): { x: number; y: number } {
  return { x: snapToGrid(x), y: snapToGrid(y) };
}

export function pointOnWall(wall: Wall, t: number): { x: number; y: number } {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    x: wall.x1 + (wall.x2 - wall.x1) * clamped,
    y: wall.y1 + (wall.y2 - wall.y1) * clamped,
  };
}

export function wallLength(wall: Wall): number {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function nextWallOrder(walls: { order: number }[]): number {
  return walls.reduce((max, w) => Math.max(max, w.order), -1) + 1;
}

const EMPTY_STATE: MemoryState = { schemaVersion: 1, houses: [], rooms: [] };

export function migrateMemoryState(value: unknown): MemoryState {
  if (!value || typeof value !== 'object') return { ...EMPTY_STATE };
  const v = value as Partial<MemoryState>;
  const houses = Array.isArray(v.houses) ? v.houses : [];
  const rooms = Array.isArray(v.rooms) ? v.rooms : [];
  return { schemaVersion: 1, houses, rooms };
}
