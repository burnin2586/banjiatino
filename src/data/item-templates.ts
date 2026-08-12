import type { ItemAction } from '@/types/moving';

export type ItemTemplateEntry = { name: string; quantity: number; suggestedAction: ItemAction };
export type RoomItemTemplate = { roomName: string; items: ItemTemplateEntry[] };

export const ROOM_ITEM_TEMPLATES: RoomItemTemplate[] = [
  {
    roomName: '厨房',
    items: [
      { name: '锅具套装', quantity: 1, suggestedAction: '带走' },
      { name: '碗盘', quantity: 6, suggestedAction: '带走' },
      { name: '筷子餐具', quantity: 6, suggestedAction: '带走' },
      { name: '水杯', quantity: 4, suggestedAction: '带走' },
      { name: '微波炉', quantity: 1, suggestedAction: '带走' },
      { name: '电饭煲', quantity: 1, suggestedAction: '带走' },
      { name: '调料', quantity: 1, suggestedAction: '带走' },
      { name: '冰箱食物', quantity: 1, suggestedAction: '待决定' },
      { name: '砧板刀具', quantity: 1, suggestedAction: '带走' },
      { name: '保鲜盒', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '卧室',
    items: [
      { name: '当季衣物', quantity: 1, suggestedAction: '带走' },
      { name: '反季衣物（收纳）', quantity: 1, suggestedAction: '带走' },
      { name: '被子', quantity: 2, suggestedAction: '带走' },
      { name: '枕头', quantity: 2, suggestedAction: '带走' },
      { name: '床品四件套', quantity: 2, suggestedAction: '带走' },
      { name: '首饰配饰', quantity: 1, suggestedAction: '带走' },
      { name: '床头物品（眼镜/充电线）', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '书房',
    items: [
      { name: '电脑/笔记本', quantity: 1, suggestedAction: '带走' },
      { name: '书籍', quantity: 1, suggestedAction: '待决定' },
      { name: '文具', quantity: 1, suggestedAction: '带走' },
      { name: '打印机', quantity: 1, suggestedAction: '待决定' },
      { name: '数据线/充电器', quantity: 1, suggestedAction: '带走' },
      { name: '桌面电子配件', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '客厅',
    items: [
      { name: '电视', quantity: 1, suggestedAction: '带走' },
      { name: '遥控器', quantity: 1, suggestedAction: '带走' },
      { name: '沙发套', quantity: 1, suggestedAction: '带走' },
      { name: '装饰画/摆件', quantity: 1, suggestedAction: '待决定' },
      { name: '绿植', quantity: 1, suggestedAction: '待决定' },
      { name: '茶具', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '卫生间',
    items: [
      { name: '洗漱用品（牙刷/牙膏/洗面奶）', quantity: 1, suggestedAction: '带走' },
      { name: '毛巾浴巾', quantity: 1, suggestedAction: '带走' },
      { name: '清洁用品', quantity: 1, suggestedAction: '带走' },
      { name: '洗衣机', quantity: 1, suggestedAction: '带走' },
      { name: '护肤/化妆品', quantity: 1, suggestedAction: '带走' },
    ],
  },
];
