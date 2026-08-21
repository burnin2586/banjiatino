export const BOX_STATUSES = ['待整理', '已装箱', '已搬走', '已到达', '已拆箱'] as const;
export const ITEM_STATUSES = ['待整理', '已装箱', '已到达', '已安置'] as const;
export const ITEM_ACTIONS = ['带走', '丢弃', '赠送', '出售', '待决定'] as const;
export const ROOM_KINDS = ['source', 'destination'] as const;

export type BoxStatus = (typeof BOX_STATUSES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ItemAction = (typeof ITEM_ACTIONS)[number];
export type RoomKind = (typeof ROOM_KINDS)[number];

/** 展示箱号；离线新建、服务端尚未分配编号的箱子显示“待编号”。 */
export function formatBoxCode(box: { code: string | null }): string {
  return box.code ?? '待编号';
}

export type Room = {
  id: string;
  name: string;
  color: string;
  kind: RoomKind;
  order: number;
};

export type MarkerRect = { x: number; y: number; w: number; h: number };

export type MovingBox = {
  id: string;
  /** 正式箱号由服务端分配；离线新建时为 null，界面显示“待编号”。 */
  code: string | null;
  name: string;
  sourceRoomId: string;
  destinationRoomId: string;
  status: BoxStatus;
  note: string;
  storagePhotoId?: string;
  markerRect?: MarkerRect;
  createdAt: number;
  updatedAt: number;
};

export type MovingItem = {
  id: string;
  name: string;
  quantity: number;
  originalLocation: string;
  destinationLocation: string;
  boxId: string | null;
  action: ItemAction;
  status: ItemStatus;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type StoragePhoto = {
  id: string;
  imageUri: string;
  title?: string;
  createdAt: number;
};

export type MovingTask = {
  id: string;
  title: string;
  dueOffsetDays: number; // 相对搬家日：负=搬家前，0=当天，正=入住后
  done: boolean;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type MovingState = {
  schemaVersion: 4;
  movingDate: number | null; // 搬家日 0 点时间戳；null = 未设置
  tasks: MovingTask[];
  rooms: Room[];
  boxes: MovingBox[];
  items: MovingItem[];
  storagePhotos: StoragePhoto[];
};
