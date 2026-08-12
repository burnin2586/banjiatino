import type { ItemAction, MovingItem, Room } from '@/types/moving';
import type { ItemTemplateEntry } from '@/data/item-templates';

export function matchRoomByName(rooms: Room[], roomName: string): Room | null {
  const target = roomName.trim().toLowerCase();
  return (
    rooms.find((r) => r.kind === 'source' && r.name.trim().toLowerCase() === target) ?? null
  );
}

export type ItemInputSeed = Pick<
  MovingItem,
  'name' | 'quantity' | 'originalLocation' | 'destinationLocation' | 'boxId' | 'action' | 'note'
>;

export function buildItemsFromTemplate(
  entries: ItemTemplateEntry[],
  roomName: string,
): ItemInputSeed[] {
  return entries.map((e) => ({
    name: e.name,
    quantity: Math.max(1, e.quantity),
    originalLocation: roomName,
    destinationLocation: '',
    boxId: null,
    action: e.suggestedAction,
    note: '',
  }));
}

export type { ItemAction };
