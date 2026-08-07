import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { initialMovingState } from '@/data/initial-data';
import { deleteStoragePhotoFile } from '@/logic/photo-store';
import { itemStatusForBox, migrateStoredState, nextBoxCode } from '@/logic/moving';
import type {
  BoxStatus,
  ItemAction,
  ItemStatus,
  MarkerRect,
  MovingBox,
  MovingItem,
  MovingState,
  Room,
  RoomKind,
} from '@/types/moving';

const STORAGE_KEY = 'banjiatino-moving-state-v1';

type RoomInput = {
  name: string;
  color: string;
  kind: RoomKind;
};

type BoxInput = {
  name: string;
  sourceRoomId: string;
  destinationRoomId: string;
  note?: string;
  storagePhotoId?: string;
  markerRect?: MarkerRect;
};

type ItemInput = {
  name: string;
  quantity: number;
  originalLocation: string;
  destinationLocation: string;
  boxId: string | null;
  action: ItemAction;
  note?: string;
};

export type Lookups = {
  roomById: Map<string, Room>;
  boxById: Map<string, MovingBox>;
  itemsByBox: Map<string, MovingItem[]>;
  boxesByStoragePhoto: Map<string, MovingBox[]>;
  sourceRooms: Room[];
  destinationRooms: Room[];
};

type MovingContextValue = {
  state: MovingState;
  isLoading: boolean;
  lookups: Lookups;
  addRoom: (input: RoomInput) => void;
  updateRoom: (roomId: string, input: Pick<RoomInput, 'name' | 'color'>) => void;
  deleteRoom: (roomId: string) => boolean;
  addBox: (input: BoxInput) => void;
  updateBox: (boxId: string, input: BoxInput) => void;
  deleteBox: (boxId: string) => void;
  setBoxStatus: (boxId: string, status: BoxStatus) => void;
  addItem: (input: ItemInput) => void;
  updateItem: (itemId: string, input: ItemInput) => void;
  deleteItem: (itemId: string) => void;
  setItemStatus: (itemId: string, status: ItemStatus) => void;
  addStoragePhoto: (imageUri: string, title?: string) => string;
  deleteStoragePhoto: (photoId: string) => Promise<void>;
  setBoxMarker: (boxId: string, photoId: string, rect: MarkerRect) => void;
  clearBoxMarker: (boxId: string) => void;
  resetToDemo: () => void;
  startFresh: () => void;
};

const MovingContext = createContext<MovingContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MovingProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<MovingState>(initialMovingState);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const savedState = await Storage.getItem(STORAGE_KEY);
        const nextState = savedState
          ? migrateStoredState(JSON.parse(savedState) as unknown)
          : initialMovingState;
        if (isMounted) {
          setState(nextState);
        }
        await Storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch (error) {
        console.warn('读取搬家数据失败，已使用示例数据。', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void hydrate();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateState = useCallback((updater: (previous: MovingState) => MovingState) => {
    setState((previous) => {
      const next = updater(previous);
      void Storage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
        console.warn('保存搬家数据失败。', error);
      });
      return next;
    });
  }, []);

  const addRoom = useCallback(
    (input: RoomInput) => {
      updateState((previous) => ({
        ...previous,
        rooms: [
          ...previous.rooms,
          {
            id: createId(input.kind === 'source' ? 'room' : 'dest'),
            name: input.name.trim(),
            color: input.color,
            kind: input.kind,
            order: previous.rooms.filter((room) => room.kind === input.kind).length,
          },
        ],
      }));
    },
    [updateState],
  );

  const updateRoom = useCallback(
    (roomId: string, input: Pick<RoomInput, 'name' | 'color'>) => {
      updateState((previous) => ({
        ...previous,
        rooms: previous.rooms.map((room) =>
          room.id === roomId
            ? { ...room, name: input.name.trim(), color: input.color }
            : room,
        ),
      }));
    },
    [updateState],
  );

  const deleteRoom = useCallback(
    (roomId: string) => {
      const inUse = state.boxes.some(
        (box) => box.sourceRoomId === roomId || box.destinationRoomId === roomId,
      );
      if (inUse) return false;
      updateState((previous) => ({
        ...previous,
        rooms: previous.rooms.filter((room) => room.id !== roomId),
      }));
      return true;
    },
    [state.boxes, updateState],
  );

  const addBox = useCallback(
    (input: BoxInput) => {
      updateState((previous) => {
        const now = Date.now();
        return {
          ...previous,
          boxes: [
            {
              id: createId('box'),
              code: nextBoxCode(previous.boxes),
              name: input.name.trim(),
              sourceRoomId: input.sourceRoomId,
              destinationRoomId: input.destinationRoomId,
              status: '待整理',
              note: input.note?.trim() ?? '',
              storagePhotoId: input.storagePhotoId,
              markerRect: input.markerRect,
              createdAt: now,
              updatedAt: now,
            },
            ...previous.boxes,
          ],
        };
      });
    },
    [updateState],
  );

  const updateBox = useCallback(
    (boxId: string, input: BoxInput) => {
      updateState((previous) => ({
        ...previous,
        boxes: previous.boxes.map((box) =>
          box.id === boxId
            ? {
                ...box,
                name: input.name.trim(),
                sourceRoomId: input.sourceRoomId,
                destinationRoomId: input.destinationRoomId,
                note: input.note?.trim() ?? '',
                updatedAt: Date.now(),
              }
            : box,
        ),
      }));
    },
    [updateState],
  );

  const deleteBox = useCallback(
    (boxId: string) => {
      updateState((previous) => ({
        ...previous,
        boxes: previous.boxes.filter((box) => box.id !== boxId),
        items: previous.items.map((item) =>
          item.boxId === boxId
            ? { ...item, boxId: null, status: '待整理', updatedAt: Date.now() }
            : item,
        ),
      }));
    },
    [updateState],
  );

  const setBoxStatus = useCallback(
    (boxId: string, status: BoxStatus) => {
      updateState((previous) => ({
        ...previous,
        boxes: previous.boxes.map((box) =>
          box.id === boxId ? { ...box, status, updatedAt: Date.now() } : box,
        ),
        items: previous.items.map((item) =>
          item.boxId === boxId && item.action === '带走'
            ? { ...item, status: itemStatusForBox(status), updatedAt: Date.now() }
            : item,
        ),
      }));
    },
    [updateState],
  );

  const addItem = useCallback(
    (input: ItemInput) => {
      updateState((previous) => {
        const now = Date.now();
        return {
          ...previous,
          items: [
            {
              id: createId('item'),
              name: input.name.trim(),
              quantity: Math.max(1, input.quantity),
              originalLocation: input.originalLocation.trim(),
              destinationLocation: input.destinationLocation.trim(),
              boxId: input.action === '带走' ? input.boxId : null,
              action: input.action,
              status: input.boxId && input.action === '带走' ? '已装箱' : '待整理',
              note: input.note?.trim() ?? '',
              createdAt: now,
              updatedAt: now,
            },
            ...previous.items,
          ],
        };
      });
    },
    [updateState],
  );

  const updateItem = useCallback(
    (itemId: string, input: ItemInput) => {
      updateState((previous) => ({
        ...previous,
        items: previous.items.map((item) => {
          if (item.id !== itemId) return item;
          const boxId = input.action === '带走' ? input.boxId : null;
          const status =
            input.action !== '带走' || !boxId
              ? '待整理'
              : boxId !== item.boxId || item.status === '待整理'
                ? '已装箱'
                : item.status;
          return {
            ...item,
            name: input.name.trim(),
            quantity: Math.max(1, input.quantity),
            originalLocation: input.originalLocation.trim(),
            destinationLocation: input.destinationLocation.trim(),
            boxId,
            action: input.action,
            status,
            note: input.note?.trim() ?? '',
            updatedAt: Date.now(),
          };
        }),
      }));
    },
    [updateState],
  );

  const deleteItem = useCallback(
    (itemId: string) => {
      updateState((previous) => ({
        ...previous,
        items: previous.items.filter((item) => item.id !== itemId),
      }));
    },
    [updateState],
  );

  const setItemStatus = useCallback(
    (itemId: string, status: ItemStatus) => {
      updateState((previous) => ({
        ...previous,
        items: previous.items.map((item) =>
          item.id === itemId ? { ...item, status, updatedAt: Date.now() } : item,
        ),
      }));
    },
    [updateState],
  );

  const addStoragePhoto = useCallback(
    (imageUri: string, title?: string) => {
      const id = createId('sp');
      updateState((prev) => ({
        ...prev,
        storagePhotos: [
          { id, imageUri, title, createdAt: Date.now() },
          ...prev.storagePhotos,
        ],
      }));
      return id;
    },
    [updateState],
  );

  const deleteStoragePhoto = useCallback(
    async (photoId: string) => {
      const photo = state.storagePhotos.find((p) => p.id === photoId);
      updateState((prev) => ({
        ...prev,
        storagePhotos: prev.storagePhotos.filter((p) => p.id !== photoId),
        boxes: prev.boxes.map((b) =>
          b.storagePhotoId === photoId
            ? { ...b, storagePhotoId: undefined, markerRect: undefined, updatedAt: Date.now() }
            : b,
        ),
      }));
      if (photo) await deleteStoragePhotoFile(photo.imageUri);
    },
    [state.storagePhotos, updateState],
  );

  const setBoxMarker = useCallback(
    (boxId: string, photoId: string, rect: MarkerRect) => {
      updateState((prev) => ({
        ...prev,
        boxes: prev.boxes.map((b) =>
          b.id === boxId ? { ...b, storagePhotoId: photoId, markerRect: rect, updatedAt: Date.now() } : b,
        ),
      }));
    },
    [updateState],
  );

  const clearBoxMarker = useCallback(
    (boxId: string) => {
      updateState((prev) => ({
        ...prev,
        boxes: prev.boxes.map((b) =>
          b.id === boxId ? { ...b, storagePhotoId: undefined, markerRect: undefined, updatedAt: Date.now() } : b,
        ),
      }));
    },
    [updateState],
  );

  const resetToDemo = useCallback(() => {
    updateState(() => initialMovingState);
  }, [updateState]);

  const startFresh = useCallback(() => {
    updateState((previous) => ({
      schemaVersion: 3,
      rooms: previous.rooms,
      boxes: [],
      items: [],
      storagePhotos: [],
    }));
  }, [updateState]);

  const lookups = useMemo<Lookups>(() => {
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
      sourceRooms: state.rooms.filter((room) => room.kind === 'source').sort(sortByOrder),
      destinationRooms: state.rooms
        .filter((room) => room.kind === 'destination')
        .sort(sortByOrder),
    };
  }, [state.rooms, state.boxes, state.items]);

  const value = useMemo(
    () => ({
      state,
      isLoading,
      lookups,
      addRoom,
      updateRoom,
      deleteRoom,
      addBox,
      updateBox,
      deleteBox,
      setBoxStatus,
      addItem,
      updateItem,
      deleteItem,
      setItemStatus,
      addStoragePhoto,
      deleteStoragePhoto,
      setBoxMarker,
      clearBoxMarker,
      resetToDemo,
      startFresh,
    }),
    [
      state,
      isLoading,
      lookups,
      addRoom,
      updateRoom,
      deleteRoom,
      addBox,
      updateBox,
      deleteBox,
      setBoxStatus,
      addItem,
      updateItem,
      deleteItem,
      setItemStatus,
      addStoragePhoto,
      deleteStoragePhoto,
      setBoxMarker,
      clearBoxMarker,
      resetToDemo,
      startFresh,
    ],
  );

  return <MovingContext.Provider value={value}>{children}</MovingContext.Provider>;
}

export function useMoving() {
  const context = useContext(MovingContext);
  if (!context) {
    throw new Error('useMoving 必须在 MovingProvider 内使用。');
  }
  return context;
}
