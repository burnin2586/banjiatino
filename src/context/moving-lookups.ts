import type { MovingBox, MovingItem, MovingState, Room } from '@/types/moving';

export type Lookups = {
  roomById: Map<string, Room>;
  boxById: Map<string, MovingBox>;
  itemsByBox: Map<string, MovingItem[]>;
  boxesByStoragePhoto: Map<string, MovingBox[]>;
  sourceRooms: Room[];
  destinationRooms: Room[];
};

/** Shared projection indexes for both the legacy local context and the collaboration context. */
export function buildLookups(state: MovingState): Lookups {
  const roomById = new Map<string, Room>();
  const boxById = new Map<string, MovingBox>();
  const itemsByBox = new Map<string, MovingItem[]>();
  const boxesByStoragePhoto = new Map<string, MovingBox[]>();

  for (const room of state.rooms) {
    roomById.set(room.id, room);
  }
  for (const box of state.boxes) {
    boxById.set(box.id, box);
  }
  for (const item of state.items) {
    if (!item.boxId) continue;
    const list = itemsByBox.get(item.boxId);
    if (list) {
      list.push(item);
    } else {
      itemsByBox.set(item.boxId, [item]);
    }
  }
  for (const box of state.boxes) {
    if (!box.storagePhotoId) continue;
    const list = boxesByStoragePhoto.get(box.storagePhotoId);
    if (list) {
      list.push(box);
    } else {
      boxesByStoragePhoto.set(box.storagePhotoId, [box]);
    }
  }

  const sortByOrder = (a: Room, b: Room) => a.order - b.order;
  return {
    roomById,
    boxById,
    itemsByBox,
    boxesByStoragePhoto,
    sourceRooms: state.rooms.filter(room => room.kind === 'source').sort(sortByOrder),
    destinationRooms: state.rooms.filter(room => room.kind === 'destination').sort(sortByOrder),
  };
}
