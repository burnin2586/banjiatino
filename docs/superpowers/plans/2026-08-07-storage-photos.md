# Storage Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给搬家整理加「拍照收纳」：拍实物照，在照片上拖拽框出箱子区域（每个框 = 一个 MovingBox），点框看/编辑该箱子的物品 list。

**Architecture:** 复用现有 `MovingBox`/`MovingItem`（区域就是箱子）、`MovingContext`、`@/` 别名、SQLite KV、ui-kit、photo-store 模式。schema v2→v3 migration（MovingBox 加 `storagePhotoId`/`markerRect`，新 `StoragePhoto` 实体）。标注组件用 RN 原生 `Pressable`（onPressIn/Move/End 拖拽画框），**不用 gesture-handler/reanimated**（Expo Go 54 native 崩，已验证）。

**Tech Stack:** Expo SDK 54, expo-router 6, React 19, expo-image-picker, expo-file-system, expo-image, react-native-svg（仅箱子列表缩略图可用 expo-image），jest-expo。

## Global Constraints

- Expo SDK 54，跑在 Expo Go；**禁止使用 react-native-gesture-handler / react-native-reanimated**（Expo Go 54 native 崩），所有手势用 RN 原生 `Pressable`（onPress/onLongPress/onPressIn/onPressMove/onPressEnd）。
- markerRect 坐标**归一化 0~1**（相对照片宽高），存 `{x,y,w,h}`。
- 数据完全本地、零网络；照片存 `FileSystem.documentDirectory + 'storage-photos/'`。
- 不破坏现有搬家逻辑：只给 MovingBox **加可选字段**、加新实体 StoragePhoto、schemaVersion 2→3。
- `@/` 别名 → `src/`；UI 文案中文；commit message 英文、不加 `Co-Authored-By`。
- 每个任务结束前 `npx tsc --noEmit` 必须通过；纯逻辑任务 `npm test` 必须通过。

---

### Task 1: 数据模型 + schema v3 migration

**Files:**
- Modify: `src/types/moving.ts`
- Modify: `src/logic/moving.ts`（`migrateStoredState` 升 v3）
- Modify: `src/data/initial-data.ts`（schemaVersion 3 + storagePhotos: []）
- Modify: `src/logic/moving.test.ts`（migration 断言更新）

**Interfaces:**
- Produces: `MarkerRect`、`StoragePhoto` 类型；`MovingBox.storagePhotoId?`、`MovingBox.markerRect?`；`MovingState.schemaVersion: 3` + `storagePhotos`。

- [ ] **Step 1: 改 `src/types/moving.ts`**

在文件中加 `MarkerRect` 和 `StoragePhoto`，给 `MovingBox` 加两个可选字段，`MovingState` 升 v3 + `storagePhotos`：

```ts
export type MarkerRect = { x: number; y: number; w: number; h: number };
```

`MovingBox` 改为（在 `note` 之后、`createdAt` 之前加两字段）：
```ts
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
```

新增 `StoragePhoto`（放在 `MovingItem` 之后）：
```ts
export type StoragePhoto = {
  id: string;
  imageUri: string;
  title?: string;
  createdAt: number;
};
```

`MovingState` 改为：
```ts
export type MovingState = {
  schemaVersion: 3;
  rooms: Room[];
  boxes: MovingBox[];
  items: MovingItem[];
  storagePhotos: StoragePhoto[];
};
```

- [ ] **Step 2: 改 `src/logic/moving.ts` 的 `migrateStoredState`**

把返回值的 `schemaVersion` 从 `2` 改 `3`，并加 `storagePhotos`。函数末尾的 return 改为：
```ts
  const storagePhotos = Array.isArray((stored as any).storagePhotos)
    ? (stored as any).storagePhotos
    : [];
  return { schemaVersion: 3, rooms, boxes, items, storagePhotos };
```
（`stored` 是函数参数里已解析的对象；在 return 前加这两行，return 加 `storagePhotos`。）

- [ ] **Step 3: 改 `src/data/initial-data.ts`**

`initialMovingState` 的 `schemaVersion: 2` 改为 `3`，并加 `storagePhotos: []`：
```ts
export const initialMovingState: MovingState = {
  schemaVersion: 3,
  rooms: [ ... ],       // 不变
  boxes: [ ... ],       // 不变
  items: [ ... ],       // 不变
  storagePhotos: [],
};
```

- [ ] **Step 4: 更新 `src/logic/moving.test.ts`**

把 `migrateStoredState` 相关断言里的 `schemaVersion` 期望从 `2` 改 `3`，并加 storagePhotos 断言：
```ts
  it('null 或非对象时回退到示例数据', () => {
    expect(migrateStoredState(null).schemaVersion).toBe(3);
    expect(migrateStoredState(null).storagePhotos).toEqual([]);
    // ...其余不变
  });
```

- [ ] **Step 5: 跑测试 + 类型**

Run: `npm test -- src/logic/moving.test.ts && npx tsc --noEmit`
Expected: 测试全 PASS（含新断言），tsc 通过。

- [ ] **Step 6: Commit**

```bash
git add src/types/moving.ts src/logic/moving.ts src/data/initial-data.ts src/logic/moving.test.ts
git commit -m "Bump schema to v3: add StoragePhoto + box marker fields"
```

---

### Task 2: 纯逻辑 storage-marker（TDD）

**Files:**
- Create: `src/logic/storage-marker.ts`
- Create: `src/logic/storage-marker.test.ts`

**Interfaces:**
- Produces: `normalizeRect(screen, photoSize): MarkerRect`、`denormalizeRect(rect, photoSize): {x,y,w,h}`（屏幕像素）、`isValidMarkerSize(rect): boolean`、`MIN_MARKER`。

- [ ] **Step 1: 写失败测试**

Create `src/logic/storage-marker.test.ts`:
```ts
import { MIN_MARKER, denormalizeRect, isValidMarkerSize, normalizeRect } from '@/logic/storage-marker';

describe('normalizeRect / denormalizeRect', () => {
  const photo = { width: 400, height: 300 };

  it('屏幕像素归一化到 0~1', () => {
    expect(normalizeRect({ x: 100, y: 60, w: 200, h: 150 }, photo)).toEqual({
      x: 0.25, y: 0.2, w: 0.5, h: 0.5,
    });
  });

  it('归一化再反归一化往返一致', () => {
    const rect = { x: 0.25, y: 0.2, w: 0.5, h: 0.5 };
    const back = denormalizeRect(rect, photo);
    expect(back).toEqual({ x: 100, y: 60, w: 200, h: 150 });
  });

  it('clamp 到 [0,1]，不超出照片', () => {
    const r = normalizeRect({ x: -10, y: -10, w: 1000, h: 1000 }, photo);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.w).toBeLessThanOrEqual(1);
    expect(r.h).toBeLessThanOrEqual(1);
  });
});

describe('isValidMarkerSize', () => {
  it('小于最小尺寸判 false', () => {
    expect(isValidMarkerSize({ x: 0, y: 0, w: 0.01, h: 0.01 })).toBe(false);
    expect(isValidMarkerSize({ x: 0, y: 0, w: MIN_MARKER, h: MIN_MARKER })).toBe(true);
  });
});
```

- [ ] **Step 2: 跑确认失败**

Run: `npm test -- src/logic/storage-marker.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

Create `src/logic/storage-marker.ts`:
```ts
import type { MarkerRect } from '@/types/moving';

export const MIN_MARKER = 0.05;

export type ScreenRect = { x: number; y: number; w: number; h: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function normalizeRect(s: ScreenRect, photo: { width: number; height: number }): MarkerRect {
  const x = clamp01(s.x / photo.width);
  const y = clamp01(s.y / photo.height);
  const w = clamp01(s.w / photo.width);
  const h = clamp01(s.h / photo.height);
  return { x, y, w, h };
}

export function denormalizeRect(r: MarkerRect, photo: { width: number; height: number }): ScreenRect {
  return {
    x: r.x * photo.width,
    y: r.y * photo.height,
    w: r.w * photo.width,
    h: r.h * photo.height,
  };
}

export function isValidMarkerSize(r: MarkerRect): boolean {
  return r.w >= MIN_MARKER && r.h >= MIN_MARKER;
}
```

- [ ] **Step 4: 跑确认通过**

Run: `npm test -- src/logic/storage-marker.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/logic/storage-marker.ts src/logic/storage-marker.test.ts
git commit -m "Add storage marker pure logic (normalize/denormalize/isValid)"
```

---

### Task 3: photo-store 加收纳照片存储（TDD）

**Files:**
- Modify: `src/logic/photo-store.ts`
- Modify: `src/logic/photo-store.test.ts`

**Interfaces:**
- Produces: `STORAGE_PHOTO_DIR`、`saveStoragePhoto(sourceUri, photoId): Promise<string>`、`deleteStoragePhotoFile(uri): Promise<void>`（沿用现有 ensurePhotoDir 模式）。

- [ ] **Step 1: 加测试**

在 `src/logic/photo-store.test.ts` 末尾追加：
```ts
import { STORAGE_PHOTO_DIR, deleteStoragePhotoFile, saveStoragePhoto } from '@/logic/photo-store';

describe('storage photo store', () => {
  it('STORAGE_PHOTO_DIR 在 documentDirectory 下', () => {
    expect(STORAGE_PHOTO_DIR).toContain('storage-photos');
  });

  it('saveStoragePhoto 拷到 STORAGE_PHOTO_DIR 并返回 uri', async () => {
    const uri = await saveStoragePhoto('file:///tmp/s.jpg', 'sp-1');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/s.jpg',
      to: `${STORAGE_PHOTO_DIR}sp-1.jpg`,
    });
    expect(uri).toBe(`${STORAGE_PHOTO_DIR}sp-1.jpg`);
  });

  it('deleteStoragePhotoFile 调 deleteAsync', async () => {
    await deleteStoragePhotoFile(`${STORAGE_PHOTO_DIR}sp-1.jpg`);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${STORAGE_PHOTO_DIR}sp-1.jpg`, {
      idempotent: true,
    });
  });
});
```

- [ ] **Step 2: 跑确认失败**

Run: `npm test -- src/logic/photo-store.test.ts`
Expected: FAIL（导出不存在）。

- [ ] **Step 3: 加实现到 `src/logic/photo-store.ts` 末尾**

```ts
export const STORAGE_PHOTO_DIR = `${FileSystem.documentDirectory}storage-photos/`;

export async function ensureStoragePhotoDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(STORAGE_PHOTO_DIR, { intermediates: true });
}

export async function saveStoragePhoto(sourceUri: string, photoId: string): Promise<string> {
  await ensureStoragePhotoDir();
  const dest = `${STORAGE_PHOTO_DIR}${photoId}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deleteStoragePhotoFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('删除收纳照片文件失败', uri, error);
  }
}
```

- [ ] **Step 4: 跑确认通过**

Run: `npm test -- src/logic/photo-store.test.ts`
Expected: 全 PASS（含新测试 + 旧测试）。

- [ ] **Step 5: Commit**

```bash
git add src/logic/photo-store.ts src/logic/photo-store.test.ts
git commit -m "Add storage photo file storage helpers"
```

---

### Task 4: MovingContext 扩展（StoragePhoto CRUD + box marker）

**Files:**
- Modify: `src/context/moving-context.tsx`

**Interfaces:**
- Consumes: `saveStoragePhoto`/`deleteStoragePhotoFile`（Task 3）、`StoragePhoto`/`MarkerRect`（Task 1）。
- Produces: context 新增方法 `addStoragePhoto(uri, title?) → string`、`deleteStoragePhoto(id) → Promise<void>`、`clearBoxMarker(boxId)`、`setBoxMarker(boxId, photoId, rect)`；`BoxInput` 加 `storagePhotoId?`/`markerRect?`；`lookups.boxesByStoragePhoto`。

- [ ] **Step 1: 扩展 `BoxInput` 和 `addBox`**

在 `BoxInput` 类型加可选字段：
```ts
type BoxInput = {
  name: string;
  sourceRoomId: string;
  destinationRoomId: string;
  note?: string;
  storagePhotoId?: string;
  markerRect?: MarkerRect;
};
```
（`MarkerRect` 从 `@/types/moving` import。）

`addBox` 创建箱子的对象里加这两字段（在 `note` 之后）：
```ts
storagePhotoId: input.storagePhotoId,
markerRect: input.markerRect,
```

- [ ] **Step 2: 加 StoragePhoto CRUD + marker 方法**

import 加 `deleteStoragePhotoFile, saveStoragePhoto`（从 `@/logic/photo-store`）。

`MovingContextValue` 类型加：
```ts
addStoragePhoto: (imageUri: string, title?: string) => string;
deleteStoragePhoto: (photoId: string) => Promise<void>;
setBoxMarker: (boxId: string, photoId: string, rect: MarkerRect) => void;
clearBoxMarker: (boxId: string) => void;
```

在 `MovingProvider` 内（其它 useCallback 旁边）加：
```ts
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
```

- [ ] **Step 3: 加 lookups.boxesByStoragePhoto**

`lookups` 的 useMemo 里加：
```ts
const boxesByStoragePhoto = new Map<string, MovingBox[]>();
for (const box of state.boxes) {
  if (!box.storagePhotoId) continue;
  const list = boxesByStoragePhoto.get(box.storagePhotoId);
  if (list) list.push(box);
  else boxesByStoragePhoto.set(box.storagePhotoId, [box]);
}
```
return 加 `boxesByStoragePhoto`。`Lookups` 类型加 `boxesByStoragePhoto: Map<string, MovingBox[]>`。useMemo 依赖已是 `[state.rooms, state.boxes, state.items]`（boxes 含），无需改。

- [ ] **Step 4: 暴露新方法**

value 对象 + useMemo deps 加 `addStoragePhoto, deleteStoragePhoto, setBoxMarker, clearBoxMarker`。

- [ ] **Step 5: 类型检查 + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 通过。

- [ ] **Step 6: Commit**

```bash
git add src/context/moving-context.tsx
git commit -m "Extend MovingContext with StoragePhoto CRUD and box markers"
```

---

### Task 5: 标注组件 photo-marker-canvas

**Files:**
- Create: `src/components/storage/photo-marker-canvas.tsx`

**Interfaces:**
- Consumes: `MarkerRect`、`MovingBox`、`denormalizeRect`/`normalizeRect`/`isValidMarkerSize`（Task 2）、`expo-image`。
- Produces: `PhotoMarkerCanvas` 组件。

- [ ] **Step 1: 写组件**

Create `src/components/storage/photo-marker-canvas.tsx`:
```tsx
import { Image } from 'expo-image';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors, AppSpacing } from '@/constants/app-theme';
import { denormalizeRect, isValidMarkerSize, normalizeRect, type ScreenRect } from '@/logic/storage-marker';
import type { MarkerRect, MovingBox, StoragePhoto } from '@/types/moving';

type Props = {
  photo: StoragePhoto;
  boxes: MovingBox[];
  mode: 'edit' | 'view';
  onMarkerCreate: (rect: MarkerRect) => void;
  onMarkerPress: (boxId: string) => void;
};

export function PhotoMarkerCanvas({ photo, boxes, mode, onMarkerCreate, onMarkerPress }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<ScreenRect | null>(null);
  const [start, setStart] = useState({ x: 0, y: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  function pressIn(e: any) {
    if (mode !== 'edit') return;
    const { locationX, locationY } = e.nativeEvent;
    setStart({ x: locationX, y: locationY });
    setDraft({ x: locationX, y: locationY, w: 0, h: 0 });
  }
  function pressMove(e: any) {
    if (mode !== 'edit' || !draft) return;
    const { locationX, locationY } = e.nativeEvent;
    setDraft({
      x: Math.min(start.x, locationX),
      y: Math.min(start.y, locationY),
      w: Math.abs(locationX - start.x),
      h: Math.abs(locationY - start.y),
    });
  }
  function pressEnd() {
    if (mode !== 'edit' || !draft) return;
    if (size.width > 0 && size.height > 0) {
      const rect = normalizeRect(draft, size);
      if (isValidMarkerSize(rect)) onMarkerCreate(rect);
    }
    setDraft(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.frame} onLayout={onLayout}>
        <Image source={photo.imageUri} style={StyleSheet.absoluteFill} contentFit="contain" />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={pressIn}
          onPressMove={pressMove}
          onPress={pressEnd}
        >
          {boxes.map((b) => {
            if (!b.markerRect || size.width === 0) return null;
            const s = denormalizeRect(b.markerRect, size);
            return (
              <Pressable
                key={b.id}
                onPress={() => onMarkerPress(b.id)}
                style={[
                  styles.marker,
                  { left: s.x, top: s.y, width: s.w, height: s.h },
                ]}
              >
                <Text style={styles.markerLabel} numberOfLines={1}>
                  {b.code} {b.name}
                </Text>
              </Pressable>
            );
          })}
          {draft ? (
            <View
              style={[
                styles.draft,
                { left: draft.x, top: draft.y, width: draft.w, height: draft.h },
              ]}
            />
          ) : null}
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {mode === 'edit' ? '在照片上拖拽画一个框 = 新建箱子' : '点框看里面的物品'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: AppSpacing.sm },
  frame: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: AppColors.surfaceMuted,
    borderRadius: 12,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: AppColors.primary,
    backgroundColor: 'rgba(47,107,79,0.12)',
    borderRadius: 4,
    padding: 2,
    justifyContent: 'flex-end',
  },
  markerLabel: {
    color: AppColors.primary,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 3,
    alignSelf: 'flex-start',
    borderRadius: 3,
    overflow: 'hidden',
  },
  draft: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: AppColors.accent,
    backgroundColor: 'rgba(217,122,71,0.12)',
  },
  hint: { color: AppColors.textMuted, fontSize: 12 },
});
```

- [ ] **Step 2: 类型检查 + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/storage/photo-marker-canvas.tsx
git commit -m "Add photo marker canvas (drag-rect box annotation, RN native)"
```

---

### Task 6: 收纳标注页 storage/[photoId].tsx

**Files:**
- Create: `src/app/storage/_layout.tsx`（Stack）
- Create: `src/app/storage/[photoId].tsx`

**Interfaces:**
- Consumes: `useMoving`（Task 4）、`PhotoMarkerCanvas`（Task 5）、`ui-kit`、`expo-image-picker`。

- [ ] **Step 1: Stack 布局**

Create `src/app/storage/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

export default function StorageLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[photoId]" />
    </Stack>
  );
}
```

- [ ] **Step 2: 标注页**

Create `src/app/storage/[photoId].tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoMarkerCanvas } from '@/components/storage/photo-marker-canvas';
import { LoadingScreen, ModalSheet, PrimaryButton, TextButton } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import type { MarkerRect, MovingBox } from '@/types/moving';

export default function StoragePhotoScreen() {
  const { photoId } = useLocalSearchParams<{ photoId: string }>();
  const {
    state,
    lookups,
    addBox,
    updateBox,
    deleteBox,
    clearBoxMarker,
    deleteStoragePhoto,
    addItem,
    updateItem,
    deleteItem,
  } = useMoving();
  const photo = state.storagePhotos.find((p) => p.id === photoId);
  const boxes = (lookups.boxesByStoragePhoto.get(photoId) ?? []);

  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');

  if (!photo) return <LoadingScreen label="正在打开照片…" />;

  const activeBox = activeBoxId ? state.boxes.find((b) => b.id === activeBoxId) : null;
  const activeItems = activeBox ? state.items.filter((i) => i.boxId === activeBox.id) : [];

  function handleCreate(rect: MarkerRect) {
    const id = addBox({
      name: '未命名箱子',
      sourceRoomId: state.rooms.find((r) => r.kind === 'source')?.id ?? '',
      destinationRoomId: state.rooms.find((r) => r.kind === 'destination')?.id ?? '',
      storagePhotoId: photo!.id,
      markerRect: rect,
    });
    // 也可直接打开新建箱子
    void id;
  }

  function openBox(boxId: string) {
    setActiveBoxId(boxId);
    setItemName('');
  }

  function addOneItem() {
    if (!activeBox || !itemName.trim()) return;
    addItem({
      name: itemName.trim(),
      quantity: 1,
      originalLocation: '',
      destinationLocation: '',
      boxId: activeBox.id,
      action: '带走',
    });
    setItemName('');
  }

  function confirmRemoveFromPhoto() {
    if (!activeBox) return;
    Alert.alert('从照片移除？', '箱子保留（出现在箱子列表），只是不在照片上标注。', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: () => {
          clearBoxMarker(activeBox.id);
          setActiveBoxId(null);
        },
      },
    ]);
  }

  function confirmDeletePhoto() {
    Alert.alert('删除这张收纳照片？', '照片和文件会删除；上面的箱子保留（只是取消标注）。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const id = photo!.id;
          router.back();
          void deleteStoragePhoto(id);
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: AppColors.background }}>
      <View style={styles.header}>
        <Text onPress={() => router.back()} style={styles.back}>‹ 返回</Text>
        <Text style={styles.title}>{photo.title || '收纳照片'}</Text>
        <Text onPress={confirmDeletePhoto} style={styles.danger}>删除</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: AppSpacing.sm, marginBottom: AppSpacing.sm }}>
        <Chip label="编辑" active={mode === 'edit'} onPress={() => setMode('edit')} />
        <Chip label="查看" active={mode === 'view'} onPress={() => setMode('view')} />
      </View>

      <View style={{ flex: 1, padding: AppSpacing.lg }}>
        <PhotoMarkerCanvas
          photo={photo}
          boxes={boxes}
          mode={mode}
          onMarkerCreate={handleCreate}
          onMarkerPress={openBox}
        />
      </View>

      <ModalSheet visible={!!activeBox} title={activeBox?.code ?? '箱子'} onClose={() => setActiveBoxId(null)}>
        {activeBox ? (
          <View style={{ gap: AppSpacing.md }}>
            <BoxMetaEditor box={activeBox} onRename={(n) => updateBox(activeBox.id, {
              name: n,
              sourceRoomId: activeBox.sourceRoomId,
              destinationRoomId: activeBox.destinationRoomId,
            })} />
            <Text style={styles.label}>物品（{activeItems.length}）</Text>
            {activeItems.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}</Text>
                <TextButton label="删" tone="danger" onPress={() => deleteItem(it.id)} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: AppSpacing.sm }}>
              <TextInput
                style={styles.input}
                placeholder="添加物品…"
                placeholderTextColor={AppColors.textMuted}
                value={itemName}
                onChangeText={setItemName}
              />
              <PrimaryButton compact label="加" onPress={addOneItem} />
            </View>
            <TextButton label="从照片移除标注" tone="danger" onPress={confirmRemoveFromPhoto} />
          </View>
        ) : null}
      </ModalSheet>
    </SafeAreaView>
  );
}

function BoxMetaEditor({ box, onRename }: { box: MovingBox; onRename: (name: string) => void }) {
  const [name, setName] = useState(box.name);
  return (
    <View style={{ gap: AppSpacing.xs }}>
      <Text style={styles.label}>箱子名</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        onBlur={() => name.trim() && name !== box.name && onRename(name.trim())}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} hitSlop={6}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.lg, paddingVertical: AppSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppColors.border,
  },
  back: { color: AppColors.primary, fontSize: 16, fontWeight: '700' },
  title: { color: AppColors.text, fontSize: 16, fontWeight: '800' },
  danger: { color: '#B4483D', fontSize: 15, fontWeight: '700' },
  label: { color: AppColors.textMuted, fontSize: 12, fontWeight: '700' },
  input: {
    flex: 1, minHeight: 40, borderWidth: 1, borderColor: AppColors.border,
    borderRadius: 10, paddingHorizontal: 10, backgroundColor: AppColors.surface, fontSize: 15,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName: { color: AppColors.text, fontSize: 15 },
  chip: {
    borderWidth: 1, borderColor: AppColors.border, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: AppColors.surface,
  },
  chipActive: { borderColor: AppColors.primary, backgroundColor: AppColors.primarySoft },
  chipText: { color: AppColors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: AppColors.primary },
});
```

- [ ] **Step 3: 类型检查 + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add "src/app/storage/_layout.tsx" "src/app/storage/[photoId].tsx"
git commit -m "Add storage photo annotation page (drag-rect + box item modal)"
```

---

### Task 7: 箱子页加收纳照片区块 + 拍照入口

**Files:**
- Modify: `src/app/boxes.tsx`

**Interfaces:**
- Consumes: `useMoving`（addStoragePhoto 等）、`expo-image-picker`、`expo-router`（navigation）。

- [ ] **Step 1: 改 `src/app/boxes.tsx`**

import 加：
```ts
import { Href, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { saveStoragePhoto } from '@/logic/photo-store';
```
`useMoving` 解构加 `state.storagePhotos` 和 `addStoragePhoto`。

在 `PageHeader` 之后、`<View>` 全部箱子 SectionTitle 之前，插入收纳照片区块：
```tsx
<View>
  <SectionTitle title="收纳照片" detail={`${state.storagePhotos.length} 张`} />
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: AppSpacing.md }}>
    <Pressable
      style={styles.addPhotoCard}
      onPress={async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (result.canceled || !result.assets[0]) return;
        const photoId = `sp-${Date.now()}`;
        const uri = await saveStoragePhoto(result.assets[0].uri, photoId);
        const id = addStoragePhoto(uri);
        router.push(`/storage/${id}` as Href);
      }}
    >
      <Text style={styles.addPlus}>＋</Text>
      <Text style={styles.addLabel}>拍照收纳</Text>
    </Pressable>
    {state.storagePhotos.map((p) => (
      <Pressable key={p.id} style={styles.photoCard} onPress={() => router.push(`/storage/${p.id}` as Href)}>
        <Image source={p.imageUri} style={styles.photoThumb} contentFit="cover" />
      </Pressable>
    ))}
  </ScrollView>
</View>
```

`ScrollView` 加到顶部 import（`import { ... ScrollView ... } from 'react-native'`）。

styles 加：
```ts
addPhotoCard: {
  width: 96, height: 96, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  borderStyle: 'dashed', borderColor: AppColors.primary, alignItems: 'center', justifyContent: 'center',
},
addPlus: { color: AppColors.primary, fontSize: 28, fontWeight: '400' },
addLabel: { color: AppColors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },
photoCard: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden' },
photoThumb: { width: '100%', height: '100%' },
```

- [ ] **Step 2: 类型检查 + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/app/boxes.tsx
git commit -m "Add storage photos section to boxes page (pick photo + open marker)"
```

---

### Task 8: 验收

**Files:** 无（验证）。

- [ ] **Step 1: 全量 tsc + lint + test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 全绿。

- [ ] **Step 2: 模拟器实操（对照 spec §11 验收清单）**

后台启 Metro：`EXPO_NO_TELEMETRY=1 npx expo start`，等 8081 listening，然后 `xcrun simctl openurl booted exp://127.0.0.1:8081`。逐项确认：
- 箱子页顶部出现「收纳照片」+「＋ 拍照收纳」。
- 点「＋」选相册照片 → 自动进标注页。
- 在照片上拖拽画框 → 创建箱子（BOX-XXX 自动编号，框上显示 code+名）。
- 点框 → modal：改箱子名、加物品（输入+加）、删物品、从照片移除标注。
- 查看模式：只能点框，不能画新框。
- 标注创建的箱子出现在箱子列表 + 首页进度统计。
- 退出重进，照片和标注都在；飞行模式可浏览。
- 画框/点框/删照片/移除标注均不崩。

- [ ] **Step 3: 若有修复则 commit**

```bash
git add -A && git commit -m "Fix <具体问题>"
```

---

## Self-Review 结果

- **Spec 覆盖**：§1 目标→T1-7；§3 数据模型→T1；§5 标注页→T6；§6 组件→T5；§4 入口→T7；§7 整合→T4（addBox 带 marker，箱子是普通箱子）；§8 隐私→T3/T7；§9 错误处理→T6（取消/确认/最小尺寸）；§10 测试→T1/T2/T3。无遗漏。
- **占位符**：无 TBD/TODO；所有代码步骤给完整代码。
- **类型一致**：`MarkerRect`、`StoragePhoto`、`storagePhotoId/markerRect`、`addStoragePhoto/deleteStoragePhoto/setBoxMarker/clearBoxMarker`、`normalizeRect/denormalizeRect/isValidMarkerSize/MIN_MARKER`、`STORAGE_PHOTO_DIR/saveStoragePhoto/deleteStoragePhotoFile`、`PhotoMarkerCanvas` props 跨任务一致。
- **约束遵守**：所有手势用 RN 原生 Pressable（无 gesture-handler/reanimated）；坐标归一化 0~1；schema v3 migration；本地存储。
