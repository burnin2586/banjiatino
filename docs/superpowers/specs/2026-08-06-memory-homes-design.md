# 阶段 1 设计：回忆核心（留住住过的家）

## 1. 背景与目标

人一辈子会住过很多房子，重要的回忆常随搬家消散。本 app 在已有的「搬家整理」之外，新增「留住回忆」能力：用户用拍照 + 手动画房间平面图，把住过的家在本地重建出来，照片贴在墙上、配上故事，全本地存储、零网络。

本 spec 只覆盖**阶段 1：回忆核心**。目标是独立可用的「回忆」功能，验证核心价值，不改动现有搬家整理。

### 成功标准

- 用户能新建/编辑/删除「房子」，每个房子下能新建多个「房间」。
- 每个房间能在一个网格画布上画墙（线段，吸附网格）。
- 每段墙上能贴一张或多张照片（来自相册/相机），照片存本地沙盒。
- 每张照片能写一段回忆文字；房间有一条整体备注。
- 全程无任何网络请求；卸载 app 即清除全部数据。
- 类型检查、lint、单元测试全绿。

## 2. 范围

### 本阶段做

- 新增底部第 5 个 tab「回忆」。
- 房子列表（CRUD）、房间列表（CRUD）、房间平面图编辑器（画墙 / 删墙 / 贴照片 / 拖照片 / 写回忆）。
- 照片本地选取、本地持久化、本地展示。
- 独立的状态层与持久化，与搬家数据完全隔离。

### 本阶段不做（留给阶段 2/3）

- 顶层信息架构重构（首页改房子列表）、搬家迁移到房子下、「回忆 | 搬家」双 tab。
- 整套户型图（一张画布画多房间、共享墙）。
- 照片相册、入住/搬出时间线、导出/备份、全景图、AR/3D。

## 3. 信息架构

底部 tab 增加一项「回忆」（现有「进度/物品/箱子/查找」不动）。点「回忆」进入房子列表，再逐级进入房间列表、房间平面图编辑器（栈式导航）。

## 4. 数据模型（`src/types/memory.ts`）

完全独立于搬家数据（不碰 `Room/MovingBox/MovingItem`）。

```ts
export type MemoryHouse = {
  id: string;
  name: string;            // 「朝阳的那间小公寓」
  coverColor: string;      // 列表卡片主色
  movedInAt?: number;      // 入住时间（可选，毫秒）
  movedOutAt?: number;     // 搬出时间（可选；空=正在住）
  note?: string;           // 房子整体回忆（可选）
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type Wall = {
  id: string;
  x1: number; y1: number;  // 网格坐标，整数格点
  x2: number; y2: number;
};

export type RoomPhoto = {
  id: string;
  wallId: string;          // 挂在哪段墙上
  t: number;               // 沿墙位置，0~1
  imageUri: string;        // 本地文件 uri（app 沙盒）
  caption?: string;        // 这张照片的回忆文字
  createdAt: number;
};

export type MemoryRoom = {
  id: string;
  houseId: string;
  name: string;            // 「卧室」
  color: string;
  walls: Wall[];
  photos: RoomPhoto[];
  note?: string;           // 房间整体备注
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type MemoryState = {
  schemaVersion: 1;
  houses: MemoryHouse[];
  rooms: MemoryRoom[];     // 所有房子的房间平铺，靠 houseId 关联
};
```

命名说明：用 `MemoryHouse / MemoryRoom` 前缀，避免和搬家的 `Room` 冲突。

## 5. 存储层（`src/context/memory-context.tsx`）

完全同构于现有 `MovingContext`，复用已验证模式（参考 `src/context/moving-context.tsx`）。

- `MemoryProvider` + `useMemory()` hook。
- 持久化：`expo-sqlite/kv-store`，key = `banjiatino-memory-state-v1`，存 `MemoryState` 的 JSON。
- 首次启动 hydrate：读 KV → 解析；解析失败回退**空 state**（`{ schemaVersion:1, houses:[], rooms:[] }`），**不注入任何示例数据**（这是用户私人记忆）。
- 写入：每次状态变更同步写 KV（与 `MovingContext` 的 `updateState` 同模式）。
- 派生 `lookups`（`useMemo`）：`roomsByHouse: Map<string, MemoryRoom[]>`，给房间列表页用。
- CRUD 方法：
  - `addHouse / updateHouse / deleteHouse`（删 house 时级联删除其所有 rooms 及其照片文件）。
  - `addRoom / updateRoom / deleteRoom`（删 room 时删除其照片文件）。
  - `addWall(roomId, wall) / removeWall(roomId, wallId)`。
  - `addPhoto(roomId, photo) / updatePhotoCaption(roomId, photoId, caption) / removePhoto(roomId, photoId) / setPhotoT(roomId, photoId, t)`。

### 照片文件管理

- 选取后用 `expo-file-system` 把图片复制到 `FileSystem.documentDirectory + 'memory-photos/'`，文件名用生成的 id（如 `<photoId>.jpg`）。
- DB 只存 `imageUri`（本地文件 uri）。
- 删除任何 photo / room / house 时，通过 `FileSystem.deleteAsync` 清理对应文件；文件删除失败只记录 warn，不阻塞 DB 删除（DB 是真源）。

## 6. 纯逻辑模块（`src/logic/memory.ts` + 单测）

参考 `src/logic/moving.ts` 模式，把无副作用逻辑抽出，便于单测：

```ts
export const GRID_SIZE = 24;            // 每格像素
export function snapToGrid(v: number): number;              // 吸附到整数格点
export function snapPoint(x: number, y: number): { x: number; y: number };
export function pointOnWall(wall: Wall, t: number): { x: number; y: number }; // 墙上 t 处的网格坐标
export function wallLength(wall: Wall): number;
export function nextWallOrder(walls: Wall[]): number;
export function migrateMemoryState(value: unknown): MemoryState; // 容错解析 + 后续迁移
```

坐标约定：墙端点存**网格整数坐标**；渲染时 `screen = grid * GRID_SIZE * zoom + pan`。`pointOnWall` 返回网格坐标，渲染层负责转屏幕坐标。

## 7. 路由结构（expo-router）

```
src/app/memory/
  _layout.tsx            Stack（房子列表 → 房间列表 → 编辑器），headerShown 按需
  index.tsx              房子列表
  [houseId]/
    index.tsx            房间列表
    [roomId].tsx         房间平面图编辑器
```

底部 tab 注册：在 `src/app/_layout.tsx` 的 `Tabs` 增加 `<Tabs.Screen name="memory" options={{ title: '回忆' }} />`，图标沿用现有字符图标风格（与「进度/物品/箱子/查找」一致）。

## 8. 平面图编辑器（`src/components/memory/floorplan-canvas.tsx`）— 核心

### 状态

```ts
type CanvasMode = 'edit' | 'view';
// 组件内 state：mode, zoom, pan{x,y}, pendingStart?{x,y}, selectedWallId?
// 数据来自 useMemory：room.walls, room.photos
```

### 渲染（react-native-svg）

- `<Defs><Pattern>` 画网格背景。
- 墙：`<Line>` × walls；选中墙高亮。
- 照片：在每张 photo 的 `pointOnWall(wall, t)` 处放一组 `<G>`：`<Rect>`（边框）+ `<Image href={imageUri}>`（小缩略图）。`expo-image` 不直接进 SVG，照片缩略图用 SVG `<Image>`（支持本地 uri）。**风险与备选**：若 `react-native-svg` 的 `<Image>` 对本地 `file://` uri 渲染不稳定，备选是画布仍用 SVG 画墙/网格，照片缩略图改用绝对定位的 `expo-image` 叠在 SVG 之上（按 `pointOnWall` 换算屏幕坐标对齐，缩放/平移时同步更新）。
- 模式切换按钮、备注按钮浮在画布上方（绝对定位 `View`）。

### 手势（gesture-handler + reanimated）

- **view 模式**：`PinchGestureHandler` → 改 zoom；`PanGestureHandler`（画布背景）→ 改 pan。
- **edit 模式**：
  - 画布 `Tap`：第一次 tap 记 `pendingStart`（吸附格点）；第二次 tap 画墙（起→终，吸附格点，长度 > 0 才创建），清空 `pendingStart`。tap 靠近已有墙端点时吸附到该端点（方便连墙）。
  - 墙 `LongPress`：删除该墙（连带其上的 photos）。
  - 照片 `Pan`：沿所属墙滑动，更新 `t`（clamp 0~1）。
- 屏幕坐标 ↔ 网格坐标转换函数（考虑 zoom/pan），放 `floorplan-canvas` 内或 `logic`。

### 照片交互

- 「添加照片」入口：选中一段墙 → 调 `expo-image-picker`（相册/相机）→ 拷文件到沙盒 → `addPhoto(roomId, { wallId, t: 0.5, imageUri })`。
- 点照片缩略图 → 底部 Sheet（沿用 `ui-kit` 的 `ModalSheet`）：大图 + caption 文本框 + 删除按钮。

### 边界

- 空房间（无墙）显示引导：「先画一段墙，就能贴照片」。
- zoom 限制 [0.5, 3]；pan 不做硬边界（自由拖动）。

## 9. 照片选取与隐私

- `expo-image-picker`：`launchImageLibraryAsync` / `launchCameraAsync`，`mediaTypes: Images`，`allowsEditing: false`。
- 拷到沙盒后，picker 返回的临时 uri 不再使用。
- **全本地、零网络**：不引入任何上传/分析 SDK；照片仅存 app 沙盒；权限弹窗只用相机/相册。
- 列表卡片、房间卡片用 `expo-image` 显示（占位 + 缓存）。

## 10. 错误处理

- 选图取消：无动作。
- 选图失败 / 文件拷贝失败：`Alert.alert` 提示，状态不变。
- KV 读失败：`console.warn` + 回退空 state。
- KV 写失败：`console.warn`（数据已在内存，下次启动可能丢失，提示用户）。
- 文件删除失败：`console.warn`，不阻塞 DB。

## 11. 测试策略（`src/logic/memory.test.ts`）

参考 `src/logic/moving.test.ts`，用 `jest-expo`。覆盖纯函数：

- `snapToGrid` / `snapPoint`：正负数、半格吸附。
- `pointOnWall`：t=0/0.5/1、水平/垂直/斜墙。
- `wallLength`。
- `migrateMemoryState`：null/非对象/合法/缺字段 → 正确回退。
- `nextWallOrder`。

编辑器手势与渲染不纳入单测（UI 层），靠真机/模拟器验收。

## 12. 依赖变化

新装：`react-native-svg`、`expo-image-picker`、`expo-file-system`。
加回（P0.1 删是因为当时 0 引用，现在真实用到）：`react-native-gesture-handler`、`react-native-reanimated`、`expo-image`。

均通过 `npx expo install <pkg>` 选 SDK 54 兼容版本。

## 13. 验收清单

- [ ] 「回忆」tab 出现，进入是房子列表，空态有引导。
- [ ] 新建/编辑/删除房子正常；删除带房间的房子时房间与照片文件一并清理。
- [ ] 进入房子是房间列表；新建/编辑/删除房间正常。
- [ ] 进入房间能画墙（吸附网格）、删墙、贴照片、拖照片、写照片回忆、写房间备注。
- [ ] 退出重进，数据与照片都在。
- [ ] 全程飞行模式下功能正常（验证零网络）。
- [ ] `npx tsc --noEmit` / `npm run lint` / `npm test` 全绿。

## 14. 后续阶段（不在本 spec）

- 阶段 2：顶层 IA 重构——首页改房子列表，搬家四 tab 收进房子详情的「搬家」tab，落地「回忆 | 搬家」双 tab，含搬家数据加 `houseId` 迁移。
- 阶段 3：增强——整套户型图、照片相册、入住/搬出时间线、导出/备份、全景。
