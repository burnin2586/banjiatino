# 收纳照片（Storage Photos）设计

## 1. 背景与目标

现有搬家整理是纯数据（箱子/物品清单），缺少空间可视化。新增「拍照收纳」：用户拍一张实物照（柜子/房间一角），在照片上拖拽框出箱子区域，每个区域 = 一个搬家箱子（关联其物品 list）。收纳即搬家前置整理——既帮助日常收纳（知道东西放哪），又服务搬家规划（每个箱子内容一目了然，方便打包/拆包）。

融入现有搬家整理（不新增独立 tab），完全复用 `MovingBox` / `MovingItem`，照片只是箱子的「实物位置标注」。

### 成功标准

- 箱子页有「收纳照片」入口，能拍/选照片。
- 进标注页能拖拽画框，每个框自动创建一个箱子（BOX-XXX）。
- 点框能打开该箱子，看/编辑里面的物品（MovingItem）。
- 标注创建的箱子是普通箱子，出现在箱子列表、进度统计里。
- 全本地存储、零网络；类型检查 / lint / 单测全绿。

## 2. 范围

### 本期做

- 箱子页加「收纳照片」区块（入口）。
- 拍照/选图（expo-image-picker）→ 存沙盒（expo-file-system）。
- 标注页：照片 + 拖拽画框 + 点框开箱子。
- 数据模型 schema v2→v3 迁移（MovingBox 加照片位置字段 + StoragePhoto 实体）。
- 箱子物品 list 复用现有 MovingItem 编辑能力。

### 本期不做（YAGNI）

- 一个箱子关联多张照片。
- 非矩形区域（圆形/多边形）。
- 照片裁剪、拼接、滤镜。
- 收纳照片与「回忆」房间照片互通。

## 3. 数据模型（schemaVersion 2 → 3）

### 修改 `src/types/moving.ts`

```ts
export type MarkerRect = { x: number; y: number; w: number; h: number };

export type MovingBox = {
  id: string;
  code: string;
  name: string;
  sourceRoomId: string;
  destinationRoomId: string;
  status: BoxStatus;
  note: string;
  storagePhotoId?: string;        // 新：在哪家收纳照片上
  markerRect?: MarkerRect;        // 新：归一化坐标 0~1（相对照片宽高）
  createdAt: number;
  updatedAt: number;
};

export type StoragePhoto = {
  id: string;
  imageUri: string;               // 本地沙盒 uri
  title?: string;
  createdAt: number;
};

export type MovingState = {
  schemaVersion: 3;               // 升级
  rooms: Room[];
  boxes: MovingBox[];
  items: MovingItem[];
  storagePhotos: StoragePhoto[];  // 新
};
```

### 迁移（`src/logic/moving.ts` 的 `migrateStoredState`）

- 把 `schemaVersion` 输出为 3。
- `storagePhotos` 缺失时回退 `[]`。
- 旧箱子无 `storagePhotoId` / `markerRect`（可选字段，正常）。
- 现有 V1→V2 迁移逻辑保留；在其结果上加 `storagePhotos: []` 和 `schemaVersion: 3`。

## 4. 入口（箱子页 `src/app/boxes.tsx`）

在箱子页 `PageHeader` 下方、箱子列表上方，加「收纳照片」区块：
- 标题「收纳照片」+ 详情「N 张」。
- 横向滚动的照片缩略图（`expo-image`，圆角），点缩略图进标注页。
- 末尾一个「📷 拍照收纳」按钮 → 调 image-picker → 存文件 → 建 `StoragePhoto` → 跳转 `/storage/[photoId]`。

不新增底部 tab。

## 5. 标注页（新 `src/app/storage/[photoId].tsx`）

- 从 `useLocalSearchParams` 取 photoId，找 `StoragePhoto`。
- 顶部：返回 + 照片标题（可编辑）+ 编辑/查看切换。
- 主体：`<PhotoMarkerCanvas>`（照片 + 区域叠加）。
- 交互：
  - **编辑模式**：在照片上拖拽 → 画框 → `onPressEnd` 时校验最小尺寸（如 w/h ≥ 0.05）→ 创建 `MovingBox`（自动 BOX-XXX，写 `storagePhotoId` + `markerRect`）。
  - **点框**：弹底部 modal——箱子名/房间可编辑 + 该箱子的物品 list（`MovingItem` where boxId = 该箱子，可加/删/改名/改数量）。
  - **删框**：modal 里「从照片移除」（清箱子的 storagePhotoId/markerRect，箱子保留）或「删除箱子」（确认，连带物品）。
- 查看模式：只显示框 + 点框看物品，不能画新框。

## 6. 标注组件（新 `src/components/storage/photo-marker-canvas.tsx`）

- 照片：`expo-image`，宽度铺满、高度按比例（`aspectRatio`）。
- 叠加层：绝对定位 `View`，包住照片。区域框 = 绝对定位 `View`（`left/top/width/height` = `markerRect × 照片实测尺寸`）。
- 拖拽画框：用 RN 原生 `Pressable` 的 `onPressIn`（记起点）/`onPressMove`（实时预览框，本地 state）/`onPressEnd`（落定，回调 `onMarkerCreate(rect)`）。
- 现有框：`Pressable`（`onPress` → `onMarkerPress(boxId)`），`hitSlop` 方便点中。
- 坐标归一化：拖拽用屏幕像素，落定时除以照片实测尺寸 → 归一化 0~1 存 `markerRect`；渲染时再乘尺寸。
- **不使用 gesture-handler / reanimated**（Expo Go 54 native 崩，已验证），纯 RN 原生 Pressable。

### Props

```ts
type Props = {
  photo: StoragePhoto;
  boxes: MovingBox[];                          // 该照片上的箱子（已过滤）
  onMarkerCreate: (rect: MarkerRect) => void;  // 创建箱子
  onMarkerPress: (boxId: string) => void;      // 点框
  mode: 'edit' | 'view';
};
```

## 7. 与搬家的整合

- 标注创建的箱子 = 普通 `MovingBox`：自动编号（复用 `nextBoxCode`）、默认 status「待整理」、source/destination 房间用默认（用户可在 modal 改）。
- 这些箱子出现在箱子页列表、首页进度统计、搜索。
- 物品 = `MovingItem`（boxId 关联），完全复用。

## 8. 照片选取与隐私

- `expo-image-picker.launchImageLibraryAsync`（相册）+ `launchCameraAsync`（相机），`mediaTypes: Images`，`quality: 0.8`。
- 选中后 `expo-file-system.copyAsync` 到 `DocumentDirectory/storage-photos/<photoId>.jpg`（复用 `src/logic/photo-store.ts` 的模式，可加 `STORAGE_PHOTO_DIR`）。
- DB 只存 `imageUri`。删照片时清理文件 + 解绑所有关联箱子的 storagePhotoId/markerRect。
- 全本地、零网络、沙盒隔离。

## 9. 错误处理

- 选图取消：无动作。
- 选图/存盘失败：`Alert`，状态不脏。
- 拖拽画框太小（< 最小尺寸）：忽略，不创建箱子。
- 删照片：先解绑箱子（清字段，箱子保留），再删文件 + StoragePhoto 记录。

## 10. 测试（`src/logic/moving.test.ts` 扩展 + 新 `photo-marker-logic.test.ts`）

- `migrateStoredState`：V2 数据 → V3（加 `storagePhotos: []`，`schemaVersion: 3`）；旧箱子字段保留。
- `nextBoxCode`：不受 storagePhotoId 影响。
- 新纯逻辑（`src/logic/storage-marker.ts`）：
  - `normalizeRect(screenRect, photoSize): MarkerRect`（归一化）。
  - `denormalizeRect(markerRect, photoSize): ScreenRect`（渲染）。
  - `isValidMarkerSize(rect): boolean`（最小尺寸校验）。

标注拖拽交互不纳入单测（UI），靠模拟器验收。

## 11. 验收清单

- [ ] 箱子页出现「收纳照片」区块 + 「拍照收纳」按钮。
- [ ] 拍/选照片 → 进标注页 → 拖拽画框 → 箱子创建（BOX-XXX 自动编号）。
- [ ] 框显示在照片正确位置（归一化坐标，旋转/缩放后仍对）。
- [ ] 点框 → modal 看物品 list + 加/删物品 + 改箱子名/房间。
- [ ] 标注创建的箱子出现在箱子页列表 + 进度统计。
- [ ] 退出重进，照片和标注都在。
- [ ] 飞行模式下功能正常（零网络）。
- [ ] `npx tsc --noEmit` / `npm run lint` / `npm test` 全绿。
- [ ] 模拟器实操：画框、点框、删框、删照片，均不崩。
