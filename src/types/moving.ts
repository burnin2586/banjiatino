export const BOX_STATUSES = ['待整理', '已装箱', '已搬走', '已到达', '已拆箱'] as const;
export const ITEM_STATUSES = ['待整理', '已装箱', '已到达', '已安置'] as const;
export const ITEM_ACTIONS = ['带走', '丢弃', '赠送', '出售', '待决定'] as const;
export const ROOM_KINDS = ['source', 'destination'] as const;

export type BoxStatus = (typeof BOX_STATUSES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ItemAction = (typeof ITEM_ACTIONS)[number];
export type RoomKind = (typeof ROOM_KINDS)[number];

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
  code: string;
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

export type MovingState = {
  schemaVersion: 3;
  rooms: Room[];
  boxes: MovingBox[];
  items: MovingItem[];
  storagePhotos: StoragePhoto[];
};
