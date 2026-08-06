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

import { deletePhotoFile, savePhotoFile } from '@/logic/photo-store';
import { migrateMemoryState } from '@/logic/memory';
import type {
  MemoryHouse,
  MemoryRoom,
  MemoryState,
  RoomPhoto,
  Wall,
} from '@/types/memory';

const STORAGE_KEY = 'banjiatino-memory-state-v1';
const EMPTY_STATE: MemoryState = { schemaVersion: 1, houses: [], rooms: [] };

type HouseInput = { name: string; coverColor: string; note?: string };
type RoomInput = { name: string; color: string; note?: string };

type MemoryContextValue = {
  state: MemoryState;
  isLoading: boolean;
  lookups: { roomsByHouse: Map<string, MemoryRoom[]> };
  addHouse: (input: HouseInput) => void;
  updateHouse: (houseId: string, input: HouseInput) => void;
  deleteHouse: (houseId: string) => Promise<void>;
  addRoom: (houseId: string, input: RoomInput) => string;
  updateRoom: (roomId: string, input: RoomInput) => void;
  deleteRoom: (roomId: string) => Promise<void>;
  addWall: (roomId: string, wall: Wall) => void;
  removeWall: (roomId: string, wallId: string) => void;
  addPhoto: (roomId: string, wallId: string, sourceUri: string, t: number) => Promise<void>;
  updatePhotoCaption: (roomId: string, photoId: string, caption: string) => void;
  setPhotoT: (roomId: string, photoId: string, t: number) => void;
  removePhoto: (roomId: string, photoId: string) => Promise<void>;
};

const MemoryContext = createContext<MemoryContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MemoryProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<MemoryState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await Storage.getItem(STORAGE_KEY);
        if (mounted) setState(saved ? migrateMemoryState(JSON.parse(saved)) : EMPTY_STATE);
      } catch (error) {
        console.warn('读取回忆数据失败。', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback((updater: (prev: MemoryState) => MemoryState) => {
    setState((prev) => {
      const next = updater(prev);
      void Storage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
        console.warn('保存回忆数据失败。', error);
      });
      return next;
    });
  }, []);

  const addHouse = useCallback(
    (input: HouseInput) => {
      update((prev) => {
        const now = Date.now();
        const house: MemoryHouse = {
          id: createId('house'),
          name: input.name.trim(),
          coverColor: input.coverColor,
          note: input.note,
          order: prev.houses.length,
          createdAt: now,
          updatedAt: now,
        };
        return { ...prev, houses: [...prev.houses, house] };
      });
    },
    [update],
  );

  const updateHouse = useCallback(
    (houseId: string, input: HouseInput) => {
      update((prev) => ({
        ...prev,
        houses: prev.houses.map((h) =>
          h.id === houseId
            ? { ...h, name: input.name.trim(), coverColor: input.coverColor, note: input.note, updatedAt: Date.now() }
            : h,
        ),
      }));
    },
    [update],
  );

  const deleteHouse = useCallback(
    async (houseId: string) => {
      const rooms = state.rooms.filter((r) => r.houseId === houseId);
      await Promise.all(
        rooms.flatMap((r) => r.photos.map((p) => deletePhotoFile(p.imageUri))),
      );
      update((prev) => ({
        ...prev,
        houses: prev.houses.filter((h) => h.id !== houseId),
        rooms: prev.rooms.filter((r) => r.houseId !== houseId),
      }));
    },
    [state.rooms, update],
  );

  const addRoom = useCallback(
    (houseId: string, input: RoomInput) => {
      const id = createId('room');
      update((prev) => {
        const now = Date.now();
        const room: MemoryRoom = {
          id,
          houseId,
          name: input.name.trim(),
          color: input.color,
          walls: [],
          photos: [],
          note: input.note,
          order: prev.rooms.filter((r) => r.houseId === houseId).length,
          createdAt: now,
          updatedAt: now,
        };
        return { ...prev, rooms: [...prev.rooms, room] };
      });
      return id;
    },
    [update],
  );

  const updateRoom = useCallback(
    (roomId: string, input: RoomInput) => {
      update((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? { ...r, name: input.name.trim(), color: input.color, note: input.note, updatedAt: Date.now() }
            : r,
        ),
      }));
    },
    [update],
  );

  const deleteRoom = useCallback(
    async (roomId: string) => {
      const room = state.rooms.find((r) => r.id === roomId);
      if (room) await Promise.all(room.photos.map((p) => deletePhotoFile(p.imageUri)));
      update((prev) => ({ ...prev, rooms: prev.rooms.filter((r) => r.id !== roomId) }));
    },
    [state.rooms, update],
  );

  const addWall = useCallback(
    (roomId: string, wall: Wall) => {
      update((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? { ...r, walls: [...r.walls, { ...wall, id: wall.id || createId('wall') }], updatedAt: Date.now() }
            : r,
        ),
      }));
    },
    [update],
  );

  const removeWall = useCallback(
    (roomId: string, wallId: string) => {
      update((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                walls: r.walls.filter((w) => w.id !== wallId),
                photos: r.photos.filter((p) => p.wallId !== wallId),
                updatedAt: Date.now(),
              }
            : r,
        ),
      }));
    },
    [update],
  );

  const addPhoto = useCallback(
    async (roomId: string, wallId: string, sourceUri: string, t: number) => {
      const photoId = createId('photo');
      const imageUri = await savePhotoFile(sourceUri, photoId);
      const photo: RoomPhoto = {
        id: photoId,
        wallId,
        t,
        imageUri,
        createdAt: Date.now(),
      };
      update((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId ? { ...r, photos: [...r.photos, photo], updatedAt: Date.now() } : r,
        ),
      }));
    },
    [update],
  );

  const updatePhotoCaption = useCallback(
    (roomId: string, photoId: string, caption: string) => {
      update((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                photos: r.photos.map((p) => (p.id === photoId ? { ...p, caption } : p)),
                updatedAt: Date.now(),
              }
            : r,
        ),
      }));
    },
    [update],
  );

  const setPhotoT = useCallback(
    (roomId: string, photoId: string, t: number) => {
      update((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? { ...r, photos: r.photos.map((p) => (p.id === photoId ? { ...p, t: Math.min(1, Math.max(0, t)) } : p)) }
            : r,
        ),
      }));
    },
    [update],
  );

  const removePhoto = useCallback(
    async (roomId: string, photoId: string) => {
      const room = state.rooms.find((r) => r.id === roomId);
      const photo = room?.photos.find((p) => p.id === photoId);
      if (photo) await deletePhotoFile(photo.imageUri);
      update((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId ? { ...r, photos: r.photos.filter((p) => p.id !== photoId), updatedAt: Date.now() } : r,
        ),
      }));
    },
    [state.rooms, update],
  );

  const lookups = useMemo(() => {
    const roomsByHouse = new Map<string, MemoryRoom[]>();
    for (const room of state.rooms) {
      const list = roomsByHouse.get(room.houseId);
      if (list) list.push(room);
      else roomsByHouse.set(room.houseId, [room]);
    }
    return { roomsByHouse };
  }, [state.rooms]);

  const value = useMemo<MemoryContextValue>(
    () => ({
      state,
      isLoading,
      lookups,
      addHouse,
      updateHouse,
      deleteHouse,
      addRoom,
      updateRoom,
      deleteRoom,
      addWall,
      removeWall,
      addPhoto,
      updatePhotoCaption,
      setPhotoT,
      removePhoto,
    }),
    [
      state,
      isLoading,
      lookups,
      addHouse,
      updateHouse,
      deleteHouse,
      addRoom,
      updateRoom,
      deleteRoom,
      addWall,
      removeWall,
      addPhoto,
      updatePhotoCaption,
      setPhotoT,
      removePhoto,
    ],
  );

  return <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>;
}

export function useMemory() {
  const ctx = useContext(MemoryContext);
  if (!ctx) throw new Error('useMemory 必须在 MemoryProvider 内使用。');
  return ctx;
}
