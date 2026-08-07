import { initialMovingState } from '@/data/initial-data';
import type {
  BoxStatus,
  ItemStatus,
  MovingBox,
  MovingItem,
  MovingState,
  Room,
} from '@/types/moving';

type StoredRoom = Partial<Room> & { id?: string; name?: string; color?: string };
type StoredBox = Partial<MovingBox> & { roomId?: string };
type StoredItem = Partial<MovingItem>;

type StoredState = {
  schemaVersion?: number;
  rooms?: StoredRoom[];
  boxes?: StoredBox[];
  items?: StoredItem[];
};

/** 把箱子的搬运状态映射到箱内“带走”物品的状态。 */
export function itemStatusForBox(status: BoxStatus): ItemStatus {
  if (status === '已拆箱') return '已安置';
  if (status === '已到达') return '已到达';
  if (status === '已装箱' || status === '已搬走') return '已装箱';
  return '待整理';
}

/** 根据现有箱号生成下一个连续箱号（BOX-001、BOX-002…）。 */
export function nextBoxCode(boxes: MovingBox[]): string {
  const largest = boxes.reduce((acc, box) => {
    const parsed = Number(box.code.replace(/\D/g, ''));
    return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc;
  }, 0);
  return `BOX-${String(largest + 1).padStart(3, '0')}`;
}

/** 把本地存储里的旧数据迁移/补全为当前 V2 结构。 */
export function migrateStoredState(value: unknown): MovingState {
  if (!value || typeof value !== 'object') {
    return initialMovingState;
  }

  const stored = value as StoredState;
  const storedRooms = Array.isArray(stored.rooms) ? stored.rooms : [];
  const sourceRooms: Room[] = storedRooms
    .filter((room) => room.id && room.name && room.kind !== 'destination')
    .map((room, index) => ({
      id: room.id!,
      name: room.name!.trim(),
      color: room.color || '#BFDCCB',
      kind: 'source',
      order: typeof room.order === 'number' ? room.order : index,
    }));

  if (sourceRooms.length === 0) {
    sourceRooms.push(
      ...initialMovingState.rooms.filter((room) => room.kind === 'source'),
    );
  }

  const storedDestinationRooms: Room[] = storedRooms
    .filter((room) => room.id && room.name && room.kind === 'destination')
    .map((room, index) => ({
      id: room.id!,
      name: room.name!.trim(),
      color: room.color || '#BCD7E8',
      kind: 'destination',
      order: typeof room.order === 'number' ? room.order : index,
    }));

  const destinationRooms =
    storedDestinationRooms.length > 0
      ? storedDestinationRooms
      : sourceRooms.map((room, index) => ({
          id: `dest-${room.id.replace(/^room-/, '')}`,
          name: room.name,
          color: room.color,
          kind: 'destination' as const,
          order: index,
        }));

  const sourceFallback = sourceRooms[0].id;
  const destinationFallback = destinationRooms[0].id;
  const now = Date.now();
  const rooms = [...sourceRooms, ...destinationRooms];

  const boxes: MovingBox[] = (Array.isArray(stored.boxes) ? stored.boxes : [])
    .filter((box) => box.id && box.code && box.name)
    .map((box) => {
      const sourceRoomId = box.sourceRoomId || box.roomId || sourceFallback;
      const sourceRoom = sourceRooms.find((room) => room.id === sourceRoomId);
      const matchingDestination = destinationRooms.find(
        (room) => room.name === sourceRoom?.name,
      );
      return {
        id: box.id!,
        code: box.code!,
        name: box.name!.trim(),
        sourceRoomId,
        destinationRoomId:
          box.destinationRoomId || matchingDestination?.id || destinationFallback,
        status: box.status || '待整理',
        note: box.note || '',
        createdAt: box.createdAt || now,
        updatedAt: box.updatedAt || box.createdAt || now,
      };
    });

  const items: MovingItem[] = (Array.isArray(stored.items) ? stored.items : [])
    .filter((item) => item.id && item.name)
    .map((item) => ({
      id: item.id!,
      name: item.name!.trim(),
      quantity: Math.max(1, item.quantity || 1),
      originalLocation: item.originalLocation || '',
      destinationLocation: item.destinationLocation || '',
      boxId: item.boxId && boxes.some((box) => box.id === item.boxId) ? item.boxId : null,
      action: item.action || '带走',
      status: item.status || '待整理',
      note: item.note || '',
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || item.createdAt || now,
    }));

  const storagePhotos = Array.isArray((stored as any).storagePhotos)
    ? (stored as any).storagePhotos
    : [];
  return { schemaVersion: 3, rooms, boxes, items, storagePhotos };
}
