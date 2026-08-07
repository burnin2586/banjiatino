# Memory Homes (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有搬家 app 里新增独立的「回忆」tab，让用户用房间的网格平面图 + 墙上贴照片 + 文字留住住过的家，全本地、零网络。

**Architecture:** 复用现有「context + SQLite KV + 纯 logic 模块 + ui-kit + @/ 别名」模式，新增一套完全独立的 `Memory*` 数据/状态/页面。平面图编辑器用 `react-native-svg` 画墙/网格/照片，`react-native-gesture-handler` + `react-native-reanimated` 处理画墙/拖动/缩放手势。照片用 `expo-image-picker` 选取、`expo-file-system` 存 app 沙盒。

**Tech Stack:** Expo SDK 54, expo-router 6, React 19, react-native-svg, react-native-gesture-handler, react-native-reanimated, expo-image-picker, expo-file-system, expo-image, jest-expo。

## Global Constraints

- Expo SDK 54；所有新依赖必须用 `npx expo install <pkg>` 安装（自动选 SDK 54 兼容版本）。
- 数据**完全本地、零网络请求**；照片仅存 `FileSystem.documentDirectory + 'memory-photos/'`。
- SQLite KV key = `banjiatino-moving-state-v1`（搬家）之外的 `banjiatino-memory-state-v1`（回忆）。
- 回忆首次启动**不注入示例数据**，回退空 state。
- 类型/hook 命名带 `Memory` 前缀，避免与搬家 `Room` 冲突。
- import 一律用 `@/` 别名（映射到 `src/`，已在 tsconfig 配好）。
- UI 文案中文；commit message 英文、不加 `Co-Authored-By`。
- 每个任务结束前必须 `npx tsc --noEmit` 通过；纯逻辑任务必须 `npm test` 通过。
- 不改动现有搬家代码（`moving-context` / `items.tsx` / `boxes.tsx` / `search.tsx` / `index.tsx`），仅在本任务 10 给 `_layout.tsx` 加一个 tab 入口。

---

### Task 1: 安装新依赖

**Files:**
- Modify: `package.json`（由 expo install 自动改）

**Interfaces:** 无（基础设施）。

- [ ] **Step 1: 安装**

Run:
```bash
npx expo install react-native-svg expo-image-picker expo-file-system expo-image react-native-gesture-handler react-native-reanimated
```
Expected: 输出 "Installed N SDK 54.0.0 compatible native modules"，package.json 新增 6 个依赖。

- [ ] **Step 2: 验证版本已写入**

Run: `grep -E 'svg|image-picker|file-system|gesture-handler|reanimated|"expo-image"' package.json`
Expected: 6 个依赖都出现在 dependencies。

- [ ] **Step 3: 类型/lint 仍通过**

Run: `npx tsc --noEmit && npm run lint`
Expected: 全绿（新依赖不影响现有代码）。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add memory feature dependencies (svg, image-picker, file-system, gesture, reanimated, image)"
```

---

### Task 2: 数据类型 types/memory.ts

**Files:**
- Create: `src/types/memory.ts`

**Interfaces:**
- Produces: `MemoryHouse`, `Wall`, `RoomPhoto`, `MemoryRoom`, `MemoryState`（后续所有任务依赖）。

- [ ] **Step 1: 写类型文件**

Create `src/types/memory.ts`:
```ts
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
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/types/memory.ts
git commit -m "Add memory data types (house, wall, photo, room, state)"
```

---

### Task 3: 纯逻辑 logic/memory.ts（TDD）

**Files:**
- Create: `src/logic/memory.ts`
- Test: `src/logic/memory.test.ts`

**Interfaces:**
- Produces: `GRID_SIZE`, `snapToGrid(v): number`, `snapPoint(x,y): {x,y}`, `pointOnWall(wall, t): {x,y}`, `wallLength(wall): number`, `nextWallOrder(walls): number`, `migrateMemoryState(value): MemoryState`。

- [ ] **Step 1: 写失败测试**

Create `src/logic/memory.test.ts`:
```ts
import {
  GRID_SIZE,
  migrateMemoryState,
  nextWallOrder,
  pointOnWall,
  snapPoint,
  snapToGrid,
  wallLength,
} from '@/logic/memory';
import type { Wall } from '@/types/memory';

describe('snapToGrid', () => {
  it('吸附到最近的整数格点', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(GRID_SIZE)).toBe(1);
    expect(snapToGrid(GRID_SIZE * 2.4)).toBe(2);
    expect(snapToGrid(GRID_SIZE * 2.6)).toBe(3);
    expect(snapToGrid(-GRID_SIZE * 0.4)).toBe(0);
    expect(snapToGrid(-GRID_SIZE * 0.6)).toBe(-1);
  });
});

describe('snapPoint', () => {
  it('返回网格整数坐标', () => {
    expect(snapPoint(GRID_SIZE * 1.4, GRID_SIZE * 2.6)).toEqual({ x: 1, y: 3 });
  });
});

describe('pointOnWall', () => {
  const horizontal: Wall = { id: 'w1', x1: 0, y1: 0, x2: 4, y2: 0 };
  const vertical: Wall = { id: 'w2', x1: 2, y1: 0, x2: 2, y2: 6 };

  it('水平墙端点与中点', () => {
    expect(pointOnWall(horizontal, 0)).toEqual({ x: 0, y: 0 });
    expect(pointOnWall(horizontal, 0.5)).toEqual({ x: 2, y: 0 });
    expect(pointOnWall(horizontal, 1)).toEqual({ x: 4, y: 0 });
  });

  it('垂直墙', () => {
    expect(pointOnWall(vertical, 0.5)).toEqual({ x: 2, y: 3 });
  });
});

describe('wallLength', () => {
  it('欧氏距离（网格单位）', () => {
    expect(wallLength({ id: 'w', x1: 0, y1: 0, x2: 3, y2: 4 })).toBe(5);
  });
});

describe('nextWallOrder', () => {
  it('最大 order +1，空为 0', () => {
    expect(nextWallOrder([])).toBe(0);
    expect(nextWallOrder([{ order: 1 }, { order: 3 }] as any)).toBe(4);
  });
});

describe('migrateMemoryState', () => {
  it('null/非对象回退空 state', () => {
    const empty = migrateMemoryState(null);
    expect(empty.schemaVersion).toBe(1);
    expect(empty.houses).toEqual([]);
    expect(empty.rooms).toEqual([]);
    expect(migrateMemoryState('x').houses).toEqual([]);
  });

  it('合法数据保留', () => {
    const state = {
      schemaVersion: 1,
      houses: [{ id: 'h1', name: 'A', order: 0 }],
      rooms: [],
    };
    expect(migrateMemoryState(state).houses).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- src/logic/memory.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

Create `src/logic/memory.ts`:
```ts
import type { MemoryState, Wall } from '@/types/memory';

export const GRID_SIZE = 24;

export function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE);
}

export function snapPoint(x: number, y: number): { x: number; y: number } {
  return { x: snapToGrid(x), y: snapToGrid(y) };
}

export function pointOnWall(wall: Wall, t: number): { x: number; y: number } {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    x: wall.x1 + (wall.x2 - wall.x1) * clamped,
    y: wall.y1 + (wall.y2 - wall.y1) * clamped,
  };
}

export function wallLength(wall: Wall): number {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function nextWallOrder(walls: { order: number }[]): number {
  return walls.reduce((max, w) => Math.max(max, w.order), -1) + 1;
}

const EMPTY_STATE: MemoryState = { schemaVersion: 1, houses: [], rooms: [] };

export function migrateMemoryState(value: unknown): MemoryState {
  if (!value || typeof value !== 'object') return { ...EMPTY_STATE };
  const v = value as Partial<MemoryState>;
  const houses = Array.isArray(v.houses) ? v.houses : [];
  const rooms = Array.isArray(v.rooms) ? v.rooms : [];
  return { schemaVersion: 1, houses, rooms };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- src/logic/memory.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/logic/memory.ts src/logic/memory.test.ts
git commit -m "Add memory pure logic (grid snap, wall point, migration) with tests"
```

---

### Task 4: 照片文件存储 logic/photo-store.ts

**Files:**
- Create: `src/logic/photo-store.ts`
- Test: `src/logic/photo-store.test.ts`

**Interfaces:**
- Produces: `savePhotoFile(sourceUri, photoId): Promise<string>`（返回沙盒 uri），`deletePhotoFile(uri: string): Promise<void>`，`PHOTO_DIR`。

- [ ] **Step 1: 写失败测试**

Create `src/logic/photo-store.test.ts`:
```ts
import * as FileSystem from 'expo-file-system';

import { PHOTO_DIR, deletePhotoFile, savePhotoFile } from '@/logic/photo-store';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///docs/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
}));

describe('photo-store', () => {
  it('PHOTO_DIR 在 documentDirectory 下', () => {
    expect(PHOTO_DIR.startsWith('file:///docs/')).toBe(true);
    expect(PHOTO_DIR).toContain('memory-photos');
  });

  it('savePhotoFile 拷到 PHOTO_DIR 并返回新 uri', async () => {
    const uri = await savePhotoFile('file:///tmp/x.jpg', 'photo-9');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/x.jpg',
      to: `${PHOTO_DIR}photo-9.jpg`,
    });
    expect(uri).toBe(`${PHOTO_DIR}photo-9.jpg`);
  });

  it('savePhotoFile 先确保目录存在', async () => {
    await savePhotoFile('file:///tmp/y.jpg', 'photo-10');
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(PHOTO_DIR, {
      intermediates: true,
    });
  });

  it('deletePhotoFile 调 deleteAsync', async () => {
    await deletePhotoFile(`${PHOTO_DIR}photo-9.jpg`);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${PHOTO_DIR}photo-9.jpg`, {
      idempotent: true,
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- src/logic/photo-store.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

Create `src/logic/photo-store.ts`:
```ts
import * as FileSystem from 'expo-file-system';

export const PHOTO_DIR = `${FileSystem.documentDirectory}memory-photos/`;

export async function ensurePhotoDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

export async function savePhotoFile(sourceUri: string, photoId: string): Promise<string> {
  await ensurePhotoDir();
  const dest = `${PHOTO_DIR}${photoId}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('删除照片文件失败', uri, error);
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- src/logic/photo-store.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/logic/photo-store.ts src/logic/photo-store.test.ts
git commit -m "Add photo file storage helpers (copy/delete in sandbox)"
```

---

### Task 5: 状态层 context/memory-context.tsx

**Files:**
- Create: `src/context/memory-context.tsx`

**Interfaces:**
- Consumes: `migrateMemoryState`（Task 3）、`savePhotoFile` / `deletePhotoFile`（Task 4）、`MemoryState` 等类型（Task 2）。
- Produces: `MemoryProvider` 组件、`useMemory()` hook（暴露 state、isLoading、lookups、所有 CRUD 方法）。

- [ ] **Step 1: 写 context**

Create `src/context/memory-context.tsx`:
```tsx
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
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/context/memory-context.tsx
git commit -m "Add MemoryProvider with CRUD, KV persistence, photo file hooks"
```

---

### Task 6: 平面图编辑器 floorplan-canvas.tsx

**Files:**
- Create: `src/components/memory/floorplan-canvas.tsx`

**Interfaces:**
- Consumes: `MemoryRoom`、`pointOnWall`、`snapPoint`、`GRID_SIZE`、`RoomPhoto`、`Wall`。
- Produces: `FloorplanCanvas` 组件（props 见下）。

- [ ] **Step 1: 写组件**

Create `src/components/memory/floorplan-canvas.tsx`:
```tsx
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, { Circle, Defs, G, Image as SvgImage, Line, Pattern, Rect } from 'react-native-svg';

import { AppColors, AppSpacing } from '@/constants/app-theme';
import { GRID_SIZE, pointOnWall, snapPoint } from '@/logic/memory';
import type { MemoryRoom, RoomPhoto, Wall } from '@/types/memory';

type Mode = 'edit' | 'view';

type Props = {
  room: MemoryRoom;
  onAddPhoto: (wallId: string) => void;
  onPhotoPress: (photo: RoomPhoto) => void;
  onWallAdd: (wall: Wall) => void;
  onWallRemove: (wallId: string) => void;
};

const CANVAS = 320; // 画布逻辑尺寸（用于命中），实际铺满父容器

export function FloorplanCanvas({
  room,
  onAddPhoto,
  onPhotoPress,
  onWallAdd,
  onWallRemove,
}: Props) {
  const [mode, setMode] = useState<Mode>('edit');
  const [pendingStart, setPendingStart] = useState<{ x: number; y: number } | null>(null);

  function toGrid(sx: number, sy: number) {
    return snapPoint(sx, sy);
  }

  const tap = Gesture.Tap().onEnd((e) => {
    if (mode !== 'edit') return;
    const p = toGrid(e.x, e.y);
    if (!pendingStart) {
      setPendingStart(p);
      return;
    }
    if (p.x === pendingStart.x && p.y === pendingStart.y) {
      setPendingStart(null);
      return;
    }
    onWallAdd({
      id: `wall-${Date.now()}`,
      x1: pendingStart.x,
      y1: pendingStart.y,
      x2: p.x,
      y2: p.y,
    });
    setPendingStart(null);
  });

  const longPress = Gesture.LongPress().onEnd((e) => {
    if (mode !== 'edit') return;
    const p = toGrid(e.x, e.y);
    const hit = room.walls.find((w) => nearWall(w, p));
    if (hit) {
      Alert.alert('删除这段墙？', '墙上的照片也会一起删除。', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => onWallRemove(hit.id) },
      ]);
    }
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <ModeChip label="编辑" active={mode === 'edit'} onPress={() => setMode('edit')} />
        <ModeChip label="查看" active={mode === 'view'} onPress={() => setMode('view')} />
        <Text style={styles.hint}>
          {mode === 'edit' ? '点两点画墙 · 长按墙删除 · 点墙可贴照片' : '只读浏览模式（切回编辑以修改）'}
        </Text>
      </View>

      <GestureHandlerRootView>
        <GestureDetector gesture={Gesture.Exclusive(longPress, tap)}>
          <View style={styles.canvas}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
              <Defs>
                <Pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                  <Circle cx={1} cy={1} r={1} fill={AppColors.border} />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width={CANVAS} height={CANVAS} fill="url(#grid)" />

              {pendingStart ? (
                <Circle
                  cx={pendingStart.x * GRID_SIZE}
                  cy={pendingStart.y * GRID_SIZE}
                  r={6}
                  fill={AppColors.accent}
                />
              ) : null}

              {room.walls.map((w) => (
                <G key={w.id}>
                  <Line
                    x1={w.x1 * GRID_SIZE}
                    y1={w.y1 * GRID_SIZE}
                    x2={w.x2 * GRID_SIZE}
                    y2={w.y2 * GRID_SIZE}
                    stroke={AppColors.text}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <Circle cx={w.x1 * GRID_SIZE} cy={w.y1 * GRID_SIZE} r={4} fill={AppColors.text} />
                  <Circle cx={w.x2 * GRID_SIZE} cy={w.y2 * GRID_SIZE} r={4} fill={AppColors.text} />
                </G>
              ))}

              {room.photos.map((photo) => {
                const wall = room.walls.find((w) => w.id === photo.wallId);
                if (!wall) return null;
                const p = pointOnWall(wall, photo.t);
                const cx = p.x * GRID_SIZE;
                const cy = p.y * GRID_SIZE;
                return (
                  <G key={photo.id} onPress={() => onPhotoPress(photo)}>
                    <Rect x={cx - 14} y={cy - 14} width={28} height={28} rx={4} fill={AppColors.surface} stroke={AppColors.primary} strokeWidth={2} />
                    <SvgImage x={cx - 12} y={cy - 12} width={24} height={24} href={photo.imageUri} preserveAspectRatio="xMidYMid slice" />
                  </G>
                );
              })}
            </Svg>

            {room.walls.length === 0 ? (
              <View style={styles.emptyOverlay}>
                <Text style={styles.emptyText}>先点两点画出一段墙</Text>
                <Text style={styles.emptySub}>墙画好后就能往上面贴照片</Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>

      <View style={styles.wallList}>
        {room.walls.map((w) => (
          <Pressable
            key={w.id}
            style={styles.wallChip}
            onPress={() =>
              mode === 'edit'
                ? Alert.alert('给这段墙贴照片？', undefined, [
                    { text: '取消', style: 'cancel' },
                    { text: '选照片', onPress: () => onAddPhoto(w.id) },
                  ])
                : null
            }
          >
            <Text style={styles.wallChipText}>
              墙 · {w.x1},{w.y1} → {w.x2},{w.y2}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function nearWall(w: Wall, p: { x: number; y: number }): boolean {
  // 点到线段距离（网格单位），容差 1 格
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - w.x1, p.y - w.y1) <= 1;
  let t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  const cx = w.x1 + t * dx;
  const cy = w.y1 + t * dy;
  return Math.hypot(p.x - cx, p.y - cy) <= 1;
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeChip, active && styles.modeChipActive]}
      hitSlop={6}
    >
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: AppSpacing.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  hint: { color: AppColors.textMuted, fontSize: 12, flex: 1, flexWrap: 'wrap' },
  canvas: {
    height: CANVAS,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  emptyOverlay: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 4 },
  emptyText: { color: AppColors.textMuted, fontSize: 15, fontWeight: '700' },
  emptySub: { color: AppColors.textMuted, fontSize: 12 },
  wallList: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  wallChip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: AppColors.surface,
  },
  wallChipText: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
  modeChip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: AppColors.surface,
  },
  modeChipActive: { borderColor: AppColors.primary, backgroundColor: AppColors.primarySoft },
  modeChipText: { color: AppColors.textMuted, fontSize: 13, fontWeight: '700' },
  modeChipTextActive: { color: AppColors.primary },
});
```

> 注：照片缩略图先用 SVG `<Image>`（`SvgImage`）。若在真机渲染本地 file uri 不稳，按 spec §8 备选：把照片缩略图改成绝对定位的 `expo-image` 叠在 SVG 上（用 `pointOnWall` 换算屏幕坐标）。判断方式在 Task 11 验收时确认。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/memory/floorplan-canvas.tsx
git commit -m "Add floorplan canvas editor (SVG grid, draw wall, pin photo)"
```

---

### Task 7: 回忆 tab 路由 + 房子列表页

**Files:**
- Create: `src/app/memory/_layout.tsx`
- Create: `src/app/memory/index.tsx`

**Interfaces:**
- Consumes: `useMemory`（Task 5）、`ui-kit`、`AppColors`。
- Produces: 房子列表页（router 路由 `memory/index`）。

- [ ] **Step 1: 写 Stack 布局**

Create `src/app/memory/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

import { useMoving } from '@/context/moving-context'; // 仅参考已有 LoadingScreen 用法
import { LoadingScreen } from '@/components/ui-kit';

export default function MemoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[houseId]" />
    </Stack>
  );
}
```

> 注意：`MemoryProvider` 在 Task 10 接到根 `_layout.tsx`。本任务先用内联的临时方式跑通：在 `memory/_layout.tsx` 里包一层 `MemoryProvider`，Task 10 改到根布局时移除内联包层。

修正版本（先把 provider 包在 memory 路由内，Task 10 再上移）：
```tsx
import { Stack } from 'expo-router';

import { MemoryProvider } from '@/context/memory-context';

export default function MemoryLayout() {
  return (
    <MemoryProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[houseId]" />
      </Stack>
    </MemoryProvider>
  );
}
```

- [ ] **Step 2: 写房子列表页**

Create `src/app/memory/index.tsx`:
```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddButton, Card, EmptyState, LoadingScreen, ModalSheet, PageHeader, PrimaryButton, Screen } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';

const HOUSE_COLORS = ['#D8CBE8', '#BFDCCB', '#F0CF9F', '#BCD7E8', '#F3B9B1'];

export default function MemoryHomeScreen() {
  const { state, isLoading, addHouse, deleteHouse } = useMemory();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(HOUSE_COLORS[0]);

  function close() {
    setModalVisible(false);
    setName('');
    setColor(HOUSE_COLORS[0]);
  }

  function submit() {
    if (!name.trim()) {
      Alert.alert('还差一步', '给这个家起个名字。');
      return;
    }
    addHouse({ name, coverColor: color });
    close();
  }

  function confirmDelete(id: string, houseName: string) {
    Alert.alert('删除这个家？', `「${houseName}」的所有房间和照片都会删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteHouse(id) },
    ]);
  }

  if (isLoading) return <LoadingScreen label="正在打开回忆…" />;

  return (
    <>
      <Screen>
        <PageHeader
          eyebrow="留住住过的家"
          title="回忆的家"
          description="把每个家画下来、贴上照片，留住当时的故事。"
          action={<AddButton label="新增家" onPress={() => setModalVisible(true)} />}
        />
        {state.houses.length === 0 ? (
          <EmptyState icon="⌂" title="还没有家" description="把第一个住过的家加进来吧。" />
        ) : (
          <View style={styles.list}>
            {state.houses.map((h) => (
              <Card key={h.id} style={styles.houseCard}>
                <PressableHouse
                  color={h.coverColor}
                  name={h.name}
                  roomCount={state.rooms.filter((r) => r.houseId === h.id).length}
                  onOpen={() => router.push(`/memory/${h.id}`)}
                  onDelete={() => confirmDelete(h.id, h.name)}
                />
              </Card>
            ))}
          </View>
        )}
      </Screen>

      <ModalSheet visible={modalVisible} title="新增家" onClose={close}>
        <View style={styles.field}>
          <Text style={styles.label}>家的名字 *</Text>
          <TextInput style={styles.input} autoFocus placeholder="例如：朝阳的小公寓" placeholderTextColor={AppColors.textMuted} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>主色</Text>
          <View style={styles.colorRow}>
            {HOUSE_COLORS.map((c) => (
              <PressableColor key={c} color={c} selected={color === c} onPress={() => setColor(c)} />
            ))}
          </View>
        </View>
        <PrimaryButton label="创建" onPress={submit} />
      </ModalSheet>
    </>
  );
}

function PressableHouse({ color, name, roomCount, onOpen, onDelete }: { color: string; name: string; roomCount: number; onOpen: () => void; onDelete: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md }}>
      <Pressable onPress={onOpen} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md }}>
        <View style={{ width: 10, height: 38, borderRadius: 999, backgroundColor: color }} />
        <View style={{ gap: 2 }}>
          <Text style={{ color: AppColors.text, fontSize: 17, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: AppColors.textMuted, fontSize: 12 }}>{roomCount} 个房间</Text>
        </View>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Text style={{ color: '#B4483D', fontSize: 13, fontWeight: '700' }}>删除</Text>
      </Pressable>
    </View>
  );
}

function PressableColor({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.colorDot, { backgroundColor: color, borderColor: selected ? AppColors.primary : 'transparent' }]} />
  );
}

const styles = StyleSheet.create({
  list: { gap: AppSpacing.md },
  houseCard: { padding: AppSpacing.md },
  field: { gap: AppSpacing.sm },
  label: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: AppColors.border, borderRadius: 12, backgroundColor: AppColors.surface, paddingHorizontal: 12, fontSize: 16 },
  colorRow: { flexDirection: 'row', gap: AppSpacing.sm },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
});
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过（如有未用 import 警告，移除 `useMoving`/`useMemo` 等未用项）。

- [ ] **Step 4: Commit**

```bash
git add src/app/memory/_layout.tsx src/app/memory/index.tsx
git commit -m "Add memory tab stack layout and houses list page"
```

---

### Task 8: 房间列表页

**Files:**
- Create: `src/app/memory/[houseId]/index.tsx`

**Interfaces:**
- Consumes: `useMemory`、`expo-router`（`useLocalSearchParams`）、`ui-kit`。
- Produces: 房间列表页（路由 `memory/[houseId]`）。

- [ ] **Step 1: 写房间列表页**

Create `src/app/memory/[houseId]/index.tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddButton, Card, EmptyState, LoadingScreen, ModalSheet, PageHeader, PrimaryButton, Screen, TextButton } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';

const ROOM_COLORS = ['#D8CBE8', '#BFDCCB', '#F0CF9F', '#BCD7E8', '#F3B9B1'];

export default function RoomsScreen() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>();
  const { state, isLoading, lookups, addRoom, updateRoom, deleteRoom } = useMemory();
  const house = state.houses.find((h) => h.id === houseId);
  const rooms = (lookups.roomsByHouse.get(houseId) ?? []).sort((a, b) => a.order - b.order);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(ROOM_COLORS[0]);

  if (isLoading || !house) return <LoadingScreen label="正在打开…" />;

  function openNew() {
    setEditingId(null);
    setName('');
    setColor(ROOM_COLORS[0]);
    setModalVisible(true);
  }

  function openEdit(id: string, n: string, c: string) {
    setEditingId(id);
    setName(n);
    setColor(c);
    setModalVisible(true);
  }

  function submit() {
    if (!name.trim()) {
      Alert.alert('还差一步', '给房间起个名字。');
      return;
    }
    if (editingId) updateRoom(editingId, { name, color });
    else addRoom(houseId, { name, color });
    setModalVisible(false);
  }

  function confirmDelete(id: string, n: string) {
    Alert.alert('删除房间？', `「${n}」的平面图和照片都会删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteRoom(id) },
    ]);
  }

  return (
    <>
      <Screen>
        <PageHeader
          eyebrow={house.name}
          title="房间"
          description="给这个家的每个房间画一张平面图、贴上照片。"
          action={<AddButton label="新增房间" onPress={openNew} />}
        />
        {rooms.length === 0 ? (
          <EmptyState icon="□" title="还没有房间" description="从卧室或客厅开始吧。" />
        ) : (
          <View style={styles.list}>
            {rooms.map((r) => (
              <Card key={r.id} style={styles.roomCard}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/memory/${houseId}/${r.id}`)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md }}>
                    <View style={{ width: 10, height: 34, borderRadius: 999, backgroundColor: r.color }} />
                    <View style={{ gap: 2 }}>
                      <Text style={{ color: AppColors.text, fontSize: 16, fontWeight: '700' }}>{r.name}</Text>
                      <Text style={{ color: AppColors.textMuted, fontSize: 12 }}>
                        {r.walls.length} 段墙 · {r.photos.length} 张照片
                      </Text>
                    </View>
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: AppSpacing.sm }}>
                  <TextButton label="编辑" onPress={() => openEdit(r.id, r.name, r.color)} />
                  <TextButton label="删除" tone="danger" onPress={() => confirmDelete(r.id, r.name)} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </Screen>

      <ModalSheet visible={modalVisible} title={editingId ? '编辑房间' : '新增房间'} onClose={() => setModalVisible(false)}>
        <View style={styles.field}>
          <Text style={styles.label}>房间名 *</Text>
          <TextInput style={styles.input} autoFocus placeholder="例如：卧室" placeholderTextColor={AppColors.textMuted} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>主色</Text>
          <View style={styles.colorRow}>
            {ROOM_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorDot, { backgroundColor: c, borderColor: color === c ? AppColors.primary : 'transparent' }]} />
            ))}
          </View>
        </View>
        <PrimaryButton label={editingId ? '保存' : '创建'} onPress={submit} />
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: AppSpacing.md },
  roomCard: { padding: AppSpacing.md, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  field: { gap: AppSpacing.sm },
  label: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: AppColors.border, borderRadius: 12, backgroundColor: AppColors.surface, paddingHorizontal: 12, fontSize: 16 },
  colorRow: { flexDirection: 'row', gap: AppSpacing.sm },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
});
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add "src/app/memory/[houseId]/index.tsx"
git commit -m "Add rooms list page for a house"
```

---

### Task 9: 房间平面图编辑器页

**Files:**
- Create: `src/app/memory/[houseId]/[roomId].tsx`

**Interfaces:**
- Consumes: `useMemory`、`FloorplanCanvas`（Task 6）、`expo-image-picker`、`ui-kit`（`ModalSheet`）。

- [ ] **Step 1: 写编辑器页**

Create `src/app/memory/[houseId]/[roomId].tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloorplanCanvas } from '@/components/memory/floorplan-canvas';
import { LoadingScreen, ModalSheet, PrimaryButton } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';
import type { RoomPhoto, Wall } from '@/types/memory';

export default function RoomEditorScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const {
    state,
    isLoading,
    addWall,
    removeWall,
    addPhoto,
    updatePhotoCaption,
    removePhoto,
    updateRoom,
  } = useMemory();
  const room = state.rooms.find((r) => r.id === roomId);

  const [activePhoto, setActivePhoto] = useState<RoomPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  if (isLoading || !room) return <LoadingScreen label="正在打开房间…" />;

  async function pickAndAdd(wallId: string) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await addPhoto(room!.id, wallId, result.assets[0].uri, 0.5);
  }

  function openPhoto(p: RoomPhoto) {
    setActivePhoto(p);
    setCaption(p.caption ?? '');
  }

  function saveCaption() {
    if (activePhoto) updatePhotoCaption(room!.id, activePhoto.id, caption);
    setActivePhoto(null);
  }

  function openNote() {
    setNoteDraft(room!.note ?? '');
    setNoteVisible(true);
  }

  function saveNote() {
    updateRoom(room!.id, { name: room!.name, color: room!.color, note: noteDraft });
    setNoteVisible(false);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: AppColors.background }}>
      <View style={styles.header}>
        <Text onPress={() => router.back()} style={styles.back}>‹ 返回</Text>
        <Text style={styles.title}>{room.name}</Text>
        <Text onPress={openNote} style={styles.noteBtn}>备注</Text>
      </View>

      <View style={{ flex: 1, padding: AppSpacing.lg }}>
        <FloorplanCanvas
          room={room}
          onAddPhoto={pickAndAdd}
          onPhotoPress={openPhoto}
          onWallAdd={(w: Wall) => addWall(room.id, w)}
          onWallRemove={(id) => removeWall(room.id, id)}
        />
        {room.note ? <Text style={styles.notePreview}>房间备注：{room.note}</Text> : null}
      </View>

      <ModalSheet visible={!!activePhoto} title="照片回忆" onClose={() => setActivePhoto(null)}>
        {activePhoto ? (
          <View style={{ gap: AppSpacing.md }}>
            <Text style={styles.label}>这一张的故事</Text>
            <TextInput
              style={styles.input}
              multiline
              autoFocus
              placeholder="在这里发生过的、你想记住的事……"
              placeholderTextColor={AppColors.textMuted}
              textAlignVertical="top"
              value={caption}
              onChangeText={setCaption}
            />
            <PrimaryButton label="保存回忆" onPress={saveCaption} />
            <Text
              style={styles.deleteText}
              onPress={() =>
                Alert.alert('删除这张照片？', undefined, [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                      const id = activePhoto.id;
                      setActivePhoto(null);
                      void removePhoto(room.id, id);
                    },
                  },
                ])
              }
            >
              删除这张照片
            </Text>
          </View>
        ) : null}
      </ModalSheet>

      <ModalSheet visible={noteVisible} title="房间备注" onClose={() => setNoteVisible(false)}>
        <View style={{ gap: AppSpacing.md }}>
          <TextInput
            style={styles.input}
            multiline
            placeholder="这个房间整体给你的感觉……"
            placeholderTextColor={AppColors.textMuted}
            textAlignVertical="top"
            value={noteDraft}
            onChangeText={setNoteDraft}
          />
          <PrimaryButton label="保存备注" onPress={saveNote} />
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
  },
  back: { color: AppColors.primary, fontSize: 16, fontWeight: '700' },
  title: { color: AppColors.text, fontSize: 17, fontWeight: '800' },
  noteBtn: { color: AppColors.primary, fontSize: 15, fontWeight: '700' },
  label: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  notePreview: { color: AppColors.textMuted, fontSize: 13, lineHeight: 19, marginTop: AppSpacing.md },
  deleteText: { color: '#B4483D', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add "src/app/memory/[houseId]/[roomId].tsx"
git commit -m "Add room floorplan editor page (photo picker, caption, note)"
```

---

### Task 10: 接入 MemoryProvider 到根布局 + 底部 tab

**Files:**
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `MemoryProvider`、`memory` 路由。

- [ ] **Step 1: 移除 memory/_layout 里的内联 Provider，加到根布局**

In `src/app/memory/_layout.tsx`，把 `MemoryProvider` 包裹去掉，只留 `<Stack>`（避免 Provider 嵌套重复）：
```tsx
import { Stack } from 'expo-router';

export default function MemoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[houseId]" />
    </Stack>
  );
}
```

- [ ] **Step 2: 根布局加 Provider 和 tab**

Modify `src/app/_layout.tsx`：在 `MovingProvider` 内层包 `MemoryProvider`，并在 `tabIcons` 和 `<Tabs>` 里加 `memory`。

顶部 import 加：
```ts
import { MemoryProvider } from '@/context/memory-context';
```
`tabIcons` 对象加一项：
```ts
const tabIcons: Record<string, string> = {
  index: '⌂',
  items: '◇',
  boxes: '□',
  search: '⌕',
  memory: '◉',
};
```
`<MovingProvider>` 内把 `Tabs` 包一层 `MemoryProvider`：
```tsx
return (
  <MovingProvider>
    <MemoryProvider>
      <StatusBar style="dark" />
      <Tabs ...>
        <Tabs.Screen name="index" options={{ title: '进度' }} />
        <Tabs.Screen name="items" options={{ title: '物品' }} />
        <Tabs.Screen name="boxes" options={{ title: '箱子' }} />
        <Tabs.Screen name="search" options={{ title: '查找' }} />
        <Tabs.Screen name="memory" options={{ title: '回忆' }} />
      </Tabs>
    </MemoryProvider>
  </MovingProvider>
);
```

- [ ] **Step 3: 类型检查 + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx src/app/memory/_layout.tsx
git commit -m "Wire MemoryProvider into root layout and add memory tab"
```

---

### Task 11: 验收（类型 / lint / 单测 / 模拟器）

**Files:** 无（验证任务）。

- [ ] **Step 1: 全量类型 + lint + 单测**

Run:
```bash
npx tsc --noEmit && npm run lint && npm test
```
Expected: 全绿，memory 的纯逻辑测试 + photo-store 测试通过。

- [ ] **Step 2: 在模拟器跑起来**

Run（后台启动 Metro）:
```bash
EXPO_NO_TELEMETRY=1 npx expo start
```
等 8081 listening 后：
```bash
xcrun simctl openurl booted exp://127.0.0.1:8081
```
Expected: app 加载，bundle 成功（首次约 15-30s，含新依赖）。

- [ ] **Step 3: 手动验收（对照 spec §13 验收清单）**

逐项操作并观察：
- 底部出现「回忆」tab；进入是空房子列表，有空态引导。
- 新建一个家 → 列表出现；编辑名字/颜色；删除（确认）。
- 进入家 → 新建房间；编辑/删除。
- 进入房间 → 编辑模式下点两点画一段墙；墙出现；长按墙删除。
- 点下方墙 chip → 选相册照片 → 照片缩略图贴到墙上。
- 点照片 → 写回忆文字 → 保存；删除照片。
- 点「备注」→ 写房间备注 → 保存。
- 退出重进 app，数据/照片都在。
- 飞行模式下重进，仍可浏览（零网络）。

**关键检查**：墙上照片缩略图是否正常渲染。若 SVG `<Image>` 渲染本地 file uri 失败（空白），按 spec §8 备选：把 `floorplan-canvas.tsx` 的照片缩略图改用绝对定位的 `expo-image`（`Image` from `expo-image`）叠在 SVG 上，坐标用 `pointOnWall(wall, t)` 换算成屏幕坐标（乘 `GRID_SIZE` 再加画布偏移）。

- [ ] **Step 4: 若有修复则 commit**

```bash
git add -A
git commit -m "Fix <具体问题>"
```

- [ ] **Step 5: 最终全绿确认**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 全绿。

---

## Self-Review 结果（plan 作者自查）

- **Spec 覆盖**：§1 目标→Task 1-10；§3 IA→Task 7/10；§4 数据模型→Task 2；§5 存储→Task 4/5；§6 纯逻辑→Task 3；§7 路由→Task 7/8/9/10；§8 编辑器→Task 6/9；§9 照片隐私→Task 4/9；§10 错误处理→Task 5（console.warn + try/catch）+ Task 9（选图取消）；§11 测试→Task 3/4；§12 依赖→Task 1；§13 验收→Task 11。无遗漏。
- **占位符**：无 TBD/TODO；所有代码步骤都给了完整代码。
- **类型一致**：`Wall`、`RoomPhoto`、`MemoryRoom`、`addWall/removeWall/addPhoto/setPhotoT/removePhoto/updatePhotoCaption`、`savePhotoFile/deletePhotoFile`、`pointOnWall/snapPoint/GRID_SIZE` 跨任务名称一致。
- **已知风险**：Task 6 SVG `<Image>` 渲染本地 uri 的可靠性（spec §8 已记备选，Task 11 验收时判定）。
