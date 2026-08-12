import { buildItemsFromTemplate, matchRoomByName } from '@/logic/item-template';
import type { Room } from '@/types/moving';

const rooms: Room[] = [
  { id: 'room-kitchen', name: '厨房', color: '#fff', kind: 'source', order: 0 },
  { id: 'room-bedroom', name: '卧室', color: '#fff', kind: 'source', order: 1 },
  { id: 'dest-kitchen', name: '厨房', color: '#fff', kind: 'destination', order: 0 },
];

describe('matchRoomByName', () => {
  it('在 source 房间里按名匹配（大小写不敏感、去空白）', () => {
    expect(matchRoomByName(rooms, '厨房')?.id).toBe('room-kitchen');
    expect(matchRoomByName(rooms, '  厨房 ')?.id).toBe('room-kitchen');
  });
  it('只匹配 source，不匹配 destination', () => {
    expect(matchRoomByName(rooms, '厨房')?.id).not.toBe('dest-kitchen');
  });
  it('匹配不到返回 null', () => {
    expect(matchRoomByName(rooms, '阁楼')).toBeNull();
  });
});

describe('buildItemsFromTemplate', () => {
  it('originalLocation 填房间名，boxId=null，status 由模板给定', () => {
    const seeds = buildItemsFromTemplate(
      [{ name: '马克杯', quantity: 4, suggestedAction: '带走' }],
      '厨房',
    );
    expect(seeds).toEqual([
      {
        name: '马克杯',
        quantity: 4,
        originalLocation: '厨房',
        destinationLocation: '',
        boxId: null,
        action: '带走',
        note: '',
      },
    ]);
  });
  it('quantity < 1 回退为 1', () => {
    const seeds = buildItemsFromTemplate(
      [{ name: 'x', quantity: 0, suggestedAction: '带走' }],
      '厨房',
    );
    expect(seeds[0].quantity).toBe(1);
  });
});
