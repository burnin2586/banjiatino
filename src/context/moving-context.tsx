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
import type {
  BoxStatus,
  ItemAction,
  ItemStatus,
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

type MovingContextValue = {
  state: MovingState;
  isLoading: boolean;
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
  resetToDemo: () => void;
  startFresh: () => void;
};

type StoredRoom = Partial<Room> & { id?: string; name?: string; color?: string };
type StoredBox = Partial<MovingBox> & { roomId?: string };
type StoredItem = Partial<MovingItem>;
type StoredState = {
  schemaVersion?: number;
  rooms?: StoredRoom[];
  boxes?: StoredBox[];
  items?: StoredItem[];
};

const MovingContext = createContext<MovingContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function itemStatusForBox(status: BoxStatus): ItemStatus {
  if (status === '已拆箱') return '已安置';
  if (status === '已到达') return '已到达';
  if (status === '已装箱' || status === '已搬走') return '已装箱';
  return '待整理';
}

function migrateStoredState(value: unknown): MovingState {
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

  return { schemaVersion: 2, rooms, boxes, items };
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
        const nextNumber =
          previous.boxes.reduce((largest, box) => {
            const parsed = Number(box.code.replace(/\D/g, ''));
            return Number.isFinite(parsed) ? Math.max(largest, parsed) : largest;
          }, 0) + 1;
        const now = Date.now();
        return {
          ...previous,
          boxes: [
            {
              id: createId('box'),
              code: `BOX-${String(nextNumber).padStart(3, '0')}`,
              name: input.name.trim(),
              sourceRoomId: input.sourceRoomId,
              destinationRoomId: input.destinationRoomId,
              status: '待整理',
              note: input.note?.trim() ?? '',
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

  const resetToDemo = useCallback(() => {
    updateState(() => initialMovingState);
  }, [updateState]);

  const startFresh = useCallback(() => {
    updateState((previous) => ({
      schemaVersion: 2,
      rooms: previous.rooms,
      boxes: [],
      items: [],
    }));
  }, [updateState]);

  const value = useMemo(
    () => ({
      state,
      isLoading,
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
      resetToDemo,
      startFresh,
    }),
    [
      state,
      isLoading,
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
