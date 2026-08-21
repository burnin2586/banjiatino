import Storage from '@react-native-async-storage/async-storage';
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
import { type ItemTemplateEntry } from '@/data/item-templates';
import { TASK_PRESETS } from '@/data/task-presets';
import { LEGACY_MOVING_STORAGE_KEY } from '@/features/collaboration/legacy-import';
import { buildItemsFromTemplate } from '@/logic/item-template';
import { itemStatusForBox, migrateStoredState, nextBoxCode } from '@/logic/moving';
import { deleteStoragePhotoFile } from '@/logic/photo-store';
import { buildTasksFromPresets } from '@/logic/task-timeline';
import type {
  BoxStatus,
  ItemAction,
  ItemStatus,
  MarkerRect,
  MovingBox,
  MovingItem,
  MovingState,
  MovingTask,
  Room,
  RoomKind,
} from '@/types/moving';

const STORAGE_KEY = LEGACY_MOVING_STORAGE_KEY;

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

import { useSession } from '@/context/session-context';
import {
  ProjectDataProvider,
  useProjectData,
} from '@/context/project-data-context';
import { buildLookups, type Lookups } from './moving-lookups';

export type { Lookups };

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
  setMovingDate: (date: number | null) => void;
  addTask: (input: { title: string; dueOffsetDays: number; note?: string }) => void;
  updateTask: (
    taskId: string,
    input: { title: string; dueOffsetDays: number; note?: string },
  ) => void;
  deleteTask: (taskId: string) => void;
  toggleTask: (taskId: string) => void;
  importTaskPresets: () => void;
  addItemsFromTemplate: (entries: ItemTemplateEntry[], roomName: string) => void;
  resetToDemo: () => void;
  startFresh: () => void;
};

const MovingContext = createContext<MovingContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function LegacyMovingProvider({ children }: PropsWithChildren) {
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

  const setMovingDate = useCallback(
    (date: number | null) => {
      updateState((prev) => ({ ...prev, movingDate: date }));
    },
    [updateState],
  );

  const addTask = useCallback(
    (input: { title: string; dueOffsetDays: number; note?: string }) => {
      updateState((prev) => {
        const now = Date.now();
        return {
          ...prev,
          tasks: [
            {
              id: createId('task'),
              title: input.title.trim(),
              dueOffsetDays: input.dueOffsetDays,
              done: false,
              note: input.note?.trim() ?? '',
              createdAt: now,
              updatedAt: now,
            },
            ...prev.tasks,
          ],
        };
      });
    },
    [updateState],
  );

  const updateTask = useCallback(
    (taskId: string, input: { title: string; dueOffsetDays: number; note?: string }) => {
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                title: input.title.trim(),
                dueOffsetDays: input.dueOffsetDays,
                note: input.note?.trim() ?? '',
                updatedAt: Date.now(),
              }
            : t,
        ),
      }));
    },
    [updateState],
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }));
    },
    [updateState],
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, done: !t.done, updatedAt: Date.now() } : t,
        ),
      }));
    },
    [updateState],
  );

  const importTaskPresets = useCallback(() => {
    updateState((prev) => {
      const now = Date.now();
      const seeds = buildTasksFromPresets(TASK_PRESETS);
      const created = seeds.map((s, i) => ({
        id: createId('task'),
        title: s.title,
        dueOffsetDays: s.dueOffsetDays,
        done: s.done,
        note: s.note,
        createdAt: now + i,
        updatedAt: now + i,
      }));
      return { ...prev, tasks: [...created, ...prev.tasks] };
    });
  }, [updateState]);

  const addItemsFromTemplate = useCallback(
    (entries: ItemTemplateEntry[], roomName: string) => {
      updateState((prev) => {
        const now = Date.now();
        const seeds = buildItemsFromTemplate(entries, roomName);
        const created = seeds.map((s, i) => ({
          id: createId('item'),
          ...s,
          status: '待整理' as const,
          createdAt: now + i,
          updatedAt: now + i,
        }));
        return { ...prev, items: [...created, ...prev.items] };
      });
    },
    [updateState],
  );

  const resetToDemo = useCallback(() => {
    updateState((previous) => ({
      ...initialMovingState,
      storagePhotos: previous.storagePhotos,
    }));
  }, [updateState]);

  const startFresh = useCallback(() => {
    updateState((previous) => ({
      schemaVersion: 4,
      movingDate: null,
      tasks: [],
      rooms: previous.rooms,
      boxes: [],
      items: [],
      storagePhotos: previous.storagePhotos,
    }));
  }, [updateState]);

  const lookups = useMemo<Lookups>(() => buildLookups(state), [state]);

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
      setMovingDate,
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
      importTaskPresets,
      addItemsFromTemplate,
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
      setMovingDate,
      addTask,
      updateTask,
      deleteTask,
      toggleTask,
      importTaskPresets,
      addItemsFromTemplate,
      resetToDemo,
      startFresh,
    ],
  );

  return <MovingContext.Provider value={value}>{children}</MovingContext.Provider>;
}

type ProjectDataAdapterProps = PropsWithChildren;

/** Bridges the repository-backed collaboration controller onto the legacy useMoving() surface. */
function ProjectDataAdapter({ children }: ProjectDataAdapterProps) {
  const { controller, snapshot } = useProjectData();
  const { state, isLoading, lookups } = snapshot;

  const value = useMemo<MovingContextValue>(() => {
    const deleteRoom = (roomId: string) => {
      const inUse = state.boxes.some(
        box => box.sourceRoomId === roomId || box.destinationRoomId === roomId,
      );
      if (inUse) return false;
      void controller.deleteRoom(roomId);
      return true;
    };

    return {
      state,
      isLoading,
      lookups,
      addRoom: input => void controller.addRoom(input),
      updateRoom: (roomId, input) => void controller.updateRoom(roomId, input),
      deleteRoom,
      addBox: input => void controller.addBox(input),
      updateBox: (boxId, input) => void controller.updateBox(boxId, input),
      deleteBox: boxId => void controller.deleteBox(boxId),
      setBoxStatus: (boxId, status) => void controller.setBoxStatus(boxId, status),
      addItem: input => void controller.addItem(input),
      updateItem: (itemId, input) => void controller.updateItem(itemId, input),
      deleteItem: itemId => void controller.deleteItem(itemId),
      setItemStatus: (itemId, status) => void controller.setItemStatus(itemId, status),
      addStoragePhoto: (imageUri, title) => {
        const pending = controller.addStoragePhoto(imageUri, title);
        void pending.catch(() => undefined);
        return `pending-${Date.now()}`;
      },
      deleteStoragePhoto: photoId => controller.deleteStoragePhoto(photoId),
      setBoxMarker: (boxId, photoId, rect) => void controller.setBoxMarker(boxId, photoId, rect),
      clearBoxMarker: boxId => void controller.clearBoxMarker(boxId),
      setMovingDate: date => void controller.setMovingDate(date),
      addTask: input => void controller.addTask(input),
      updateTask: (taskId, input) => void controller.updateTask(taskId, input),
      deleteTask: taskId => void controller.deleteTask(taskId),
      toggleTask: taskId => {
        const task = state.tasks.find(candidate => candidate.id === taskId);
        if (task) void controller.setTaskDone(taskId, !task.done);
      },
      importTaskPresets: () => {
        for (const seed of buildTasksFromPresets(TASK_PRESETS)) {
          void controller.addTask(seed);
        }
      },
      addItemsFromTemplate: (entries, roomName) => {
        for (const item of buildItemsFromTemplate(entries, roomName)) {
          void controller.addItem(item);
        }
      },
      resetToDemo: () => undefined,
      startFresh: () => {
        for (const room of state.rooms) void controller.deleteRoom(room.id);
        for (const box of state.boxes) void controller.deleteBox(box.id);
        for (const item of state.items) void controller.deleteItem(item.id);
        for (const task of state.tasks) void controller.deleteTask(task.id);
      },
    };
  }, [controller, state, isLoading, lookups]);

  return <MovingContext.Provider value={value}>{children}</MovingContext.Provider>;
}

/**
 * Chooses the data backend: a repository-backed collaboration project when the session has
 * one, otherwise the original local AsyncStorage flow for pre-collaboration usage.
 */
export function MovingProvider({ children }: PropsWithChildren) {
  const { currentProjectId, identity } = useSession();

  if (currentProjectId) {
    return (
      <ProjectDataProvider
        projectId={currentProjectId}
        actorId={identity?.userId ?? 'local-user'}>
        <ProjectDataAdapter>{children}</ProjectDataAdapter>
      </ProjectDataProvider>
    );
  }

  return <LegacyMovingProvider>{children}</LegacyMovingProvider>;
}

export function useMoving() {
  const context = useContext(MovingContext);
  if (!context) {
    throw new Error('useMoving 必须在 MovingProvider 内使用。');
  }
  return context;
}
