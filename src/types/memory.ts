export type MemoryHouse = {
  id: string;
  name: string;
  coverColor: string;
  movedInAt?: number;
  movedOutAt?: number;
  note?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type Wall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type RoomPhoto = {
  id: string;
  wallId: string;
  t: number;
  imageUri: string;
  caption?: string;
  createdAt: number;
};

export type MemoryRoom = {
  id: string;
  houseId: string;
  name: string;
  color: string;
  walls: Wall[];
  photos: RoomPhoto[];
  note?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type MemoryState = {
  schemaVersion: 1;
  houses: MemoryHouse[];
  rooms: MemoryRoom[];
};
