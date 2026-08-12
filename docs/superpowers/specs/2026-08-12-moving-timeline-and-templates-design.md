# 搬家时间清单 + 房间物品模板 — 设计

- **日期:** 2026-08-12
- **状态:** 待评审
- **作者:** brainstorming 会话
- **关联:** 复用现有 `MovingState` / `MovingContext` / `ui-kit` / presentation + logic 分层模式

## 1. 背景与目标

「搬家条理」当前是一个纯本地、无后端的 iOS 搬家整理 App，已有房间、箱子、物品、储物照片、记忆等模块。两个痛点尚未覆盖：

1. **缺少时间维度**：搬家是带 deadline 的一次性项目，现有 App 只有静态台账，没有"今天该做什么、还剩几天"的节奏感。
2. **冷启动录入负担重**：用户从零逐件录入物品，成本高，易放弃。

本设计新增两个轻量化功能：

- **搬家时间清单**：以「搬家日」为锚点的倒计时 + 预设任务时间线（任务相对搬家日自动推算建议完成日，预设当起点、可增删改）。
- **房间物品模板**：按房间打包的常见物品预设，一键导入到清单，导入后逐条可改。

定位原则：**轻量化**。复用现有数据模型、组件、路由模式；不引入后端、通知、多项目等复杂度；除纯 JS 日期滚轮外不新增任何原生依赖。

## 2. 不在范围（明确不做，锁死 scope）

- ❌ 系统通知 / 推送提醒（README 宣传的「待办提醒」本次**不实现**；需另行对齐 README 文案或后续单独立项）
- ❌ 任务依赖 / 子任务 / 优先级 / 重复任务
- ❌ 自定义模板编辑器、模板云同步（内置 5 个房间预设，固定只读源）
- ❌ 多套搬家项目（只有一个全局 `movingDate`）
- ❌ 日期精度只到「日」，不做时分
- ❌ 任何原生依赖（日期选择器自建纯 JS）

## 3. 数据模型

### 3.1 schema 升级（3 → 4）

`src/types/moving.ts`：

```ts
export type MovingTask = {
  id: string;
  title: string;
  dueOffsetDays: number;  // 相对搬家日：负=搬家前，0=当天，正=入住后
  done: boolean;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type MovingState = {
  schemaVersion: 4;        // 3 → 4
  movingDate: number | null;  // 搬家日 0 点时间戳；null = 未设置
  tasks: MovingTask[];        // 新增
  rooms: Room[];
  boxes: MovingBox[];
  items: MovingItem[];
  storagePhotos: StoragePhoto[];
};
```

### 3.2 迁移

`src/logic/moving.ts` 的 `migrateStoredState`：

- 旧数据（无 `schemaVersion` 或 `< 4`）补 `movingDate: null`、`tasks: []`，置 `schemaVersion: 4`。
- 沿用现有容错风格（字段缺失走默认值）。老用户无感升级，不丢数据。
- 照片目录、rooms/boxes/items 迁移逻辑不变。

### 3.3 初始数据

`src/data/initial-data.ts`：

- `initialMovingState` 加 `movingDate: null`、`tasks: []`。
- **不预填任务/搬家日**：搬家日强个人化；demo 的 boxes/items 保留（供"随便点点"），但时间线留空，由用户在 TaskTimeline 页主动导入预设或自建。

## 4. 预设数据（只读源，不进 state）

### 4.1 任务预设 `src/data/task-presets.ts`

```ts
export type TaskPreset = { title: string; dueOffsetDays: number };
export const TASK_PRESETS: TaskPreset[] = [ /* 见下 */ ];
```

完整内容（12 条，覆盖搬家前 3 周到入住后 1 周）：

| dueOffsetDays | title |
|---|---|
| -21 | 断舍离：清理不再需要的物品（丢弃/赠送/出售） |
| -14 | 联系搬家公司，比价并预约 |
| -10 | 准备打包材料：纸箱、胶带、气泡膜、记号笔 |
| -7 | 开始打包非必需品（反季衣物、装饰、藏书） |
| -5 | 通知物业/房东退租，确认交接时间 |
| -3 | 预约旧家和新家的搬家电梯/车位 |
| -2 | 打包厨房非日用的锅碗餐具 |
| -1 | 打包「搬家当天必需包」（换洗衣物、洗漱、充电器、证件） |
| 0 | 搬家当天：逐箱清点数量，确认到达 |
| +1 | 入住后：检查贵重物品、家电是否完好 |
| +2 | 拆必需品箱子，恢复日常起居 |
| +7 | 更新收件地址、快递、银行卡、订阅 |

### 4.2 房间物品模板 `src/data/item-templates.ts`

```ts
import type { ItemAction } from '@/types/moving';
export type ItemTemplateEntry = { name: string; quantity: number; suggestedAction: ItemAction };
export type RoomItemTemplate = { roomName: string; items: ItemTemplateEntry[] };
export const ROOM_ITEM_TEMPLATES: RoomItemTemplate[] = [ /* 5 房间 */ ];
```

5 个房间（`suggestedAction` 默认 `带走`，少数标 `待决定`）。**注**：列表中「若干 / 一批」类物品 `quantity` 一律记 `1`（语义为 1 批/组），用户导入后按实际改数量。

- **厨房**：锅具套装×1、碗盘×6、筷子餐具×6、水杯×4、微波炉×1、电饭煲×1、调料×1批、冰箱食物×1批、砧板刀具×1套、保鲜盒×若干
- **卧室**：当季衣物×若干、反季衣物(收纳)×若干、被子×2、枕头×2、床品四件套×2、首饰配饰×1批、床头物品(眼镜/充电线)×若干
- **书房**：电脑/笔记本×1、书籍×若干、文具×1批、打印机×1、数据线/充电器×1批、桌面电子配件×若干
- **客厅**：电视×1、遥控器×若干、沙发套×1、装饰画/摆件×若干、绿植×若干、茶具×1套
- **卫生间**：洗漱用品(牙刷/牙膏/洗面奶)×1批、毛巾浴巾×若干、清洁用品×1批、洗衣机×1、护肤/化妆品×1批

## 5. 导航与页面

### 5.1 路由变更（`App.tsx`）

- `RootStackParamList` 新增 `TaskTimeline`（无参）。
- `RootStack` 加一屏 `<RootStack.Screen name="TaskTimeline" component={TaskTimelineScreen} />`。
- 不新增底部 tab。模板导入走 `ModalSheet`，不开路由。

### 5.2 Home 倒计时卡（`src/app/index.tsx`）

插在 hero 进度卡**上方**，条件渲染：

- `movingDate === null` → 引导卡：「设置搬家日，开始倒计时」+ 两个按钮：[设置搬家日]（开日期滚轮 ModalSheet）、[一键导入搬家任务]（调 `importTaskPresets`）。
- `movingDate !== null` → 倒计时卡：
  - 主文：「距搬家还有 X 天」/「已搬家 X 天」（`computeCountdown`）。
  - 副文：「下一个任务：{title}（建议 MM-DD 完成）」（`nextPendingTask`）；无待办时显示「所有任务已完成 🎉」。
  - 整卡 `onPress` → 导航到 `TaskTimeline`。

### 5.3 TaskTimeline 页（`src/app/task-timeline.tsx`）

- `PageHeader`：eyebrow「时间线」、title「搬家节奏」；右上角 `TextButton`「改日期」开日期滚轮 ModalSheet，显示当前搬家日（`movingDate=null` 时显示「未设置」，任务的建议完成日列显示「待设置搬家日」）。
- `tasks` 为空 → `EmptyState`（icon 📅、「还没有任务」「从预设导入，或自己加一条」）+ `PrimaryButton`「导入预设任务」。
- `tasks` 非空 → 按 `groupTasksByPhase` 分三段渲染：**搬家前 / 搬家当天 / 入住后**，每段一个 `SectionTitle` + 任务卡列表。
- 任务卡：左侧勾选框（`done`）、标题（完成时划线灰色）、建议完成日（`computeSuggestedDate`）。**过期判定**：建议完成日（按日取整）< 今天（按日取整）且 `done=false` → 标黄。右侧编辑/删除入口。
- 顶部固定 `AddButton`「+」→ 新增任务 ModalSheet。

**任务新增/编辑 ModalSheet**：标题（TextInput）、相对天数（数字键盘，注明「负数=搬家前，0=当天，正数=入住后」）、备注（TextInput）。

### 5.4 模板入口与导入流（`src/app/items.tsx` + `src/components/template-picker.tsx`）

- Items 页 header 右侧或列表上方加 `TextButton`「从模板添加」。
- 点击 → `ModalSheet`「选择房间模板」：列出 5 个房间名 + 物品数量（如「厨房 · 10 项」）。
- 选房间 → 进入预览态（同一 ModalSheet 内）：
  - 顶部目标房间选择器：默认 `matchRoomByName(rooms, roomName)`，匹配不到显示「选择目标房间」下拉（source rooms 列表）。
  - 物品列表，每行：勾选框（默认全选）+ 名称 + 数量步进（可改）。
  - 底部 `PrimaryButton`「导入勾选的 N 项」→ 调 `addItemsFromTemplate` 批量追加 → 关闭 ModalSheet。

## 6. 模板与 Room 的关联逻辑

- 模板用 `roomName` 字符串匹配用户已有的 source room（精确匹配，大小写不敏感）。
- 匹配到 → 物品 `originalLocation` 留空、`destinationLocation` 留空、`boxId=null`、`action=suggestedAction`、`status=待整理`。
- 匹配不到 → 预览页让用户选一个 source room；不强制创建房间（保持轻量）。
- 导入是**纯追加**，不删不改现有物品；不去重（用户可在预览页手动取消勾选）。
- **边界**：若用户无任何 source room，预览页禁用导入并提示「请先在 Home 添加房间」。

## 7. 自建日期滚轮（`src/components/date-wheel.tsx` + `src/logic/date-wheel.ts`）

- 三列（年/月/日）垂直滚轮，基于 RN `ScrollView` + `snapToInterval` 吸附；选中行高亮（对齐蓝玩具：`AppColors.primary` 强调、`AppRadius.control` 圆角）。
- 年份范围：当前年 ± 5 年。
- 逻辑抽纯函数 `src/logic/date-wheel.ts`：
  - `getDaysInMonth(year, month)` — 处理闰年、大小月
  - `clampDay(year, month, day)` — 月份切换时天数回夹
  - `toDateStamp(year, month, day)` — 归一到当日 0 点时间戳
  - `fromDateStamp(ts)` → `{ year, month, day }`
- 零原生依赖，不需 `pod install`。

## 8. MovingContext 新增方法

`src/context/moving-context.tsx`：

```ts
setMovingDate: (date: number | null) => void;
addTask: (input: { title: string; dueOffsetDays: number; note?: string }) => void;
updateTask: (taskId: string, input: { title: string; dueOffsetDays: number; note?: string }) => void;
deleteTask: (taskId: string) => void;
toggleTask: (taskId: string) => void;
importTaskPresets: () => void;  // 用 TASK_PRESETS 生成 tasks 追加（已存在的标题可重复，不去重）
addItemsFromTemplate: (entries: ItemTemplateEntry[], targetRoomId: string) => void;
```

- `updateState` 模式与现有一致（同步 setState + 异步写 AsyncStorage）。
- `importTaskPresets` 用 `createId` 生成 id、`Date.now()` 时间戳；`dueOffsetDays` 取预设值。
- `addItemsFromTemplate` 的 `entries` 为用户在预览页确认后的条目（已含数量调整）；`targetRoomId` 为按名匹配或用户手选的 source room。

## 9. 纯函数与测试

沿用现有「presentation 抽离 + logic 纯函数 + jest」模式。

### 9.1 新增 logic

- `src/logic/task-timeline.ts`：
  - `computeSuggestedDate(movingDate, offsetDays)` → 时间戳
  - `groupTasksByPhase(tasks)` → `{ before: MovingTask[]; dayOf: MovingTask[]; after: MovingTask[] }`（按 offset 分组，组内按 offset 升序）
  - `computeCountdown(movingDate, today)` → `{ days: number; label: string; isPast: boolean }`
  - `nextPendingTask(tasks, movingDate, today)` → `MovingTask | null`（未完成任务按建议完成日升序，取第一条；供 Home「下一个任务」展示）
- `src/logic/item-template.ts`：
  - `matchRoomByName(rooms, roomName)` → `Room | null`
  - `buildItemsFromTemplate(entries, targetRoomId)` → `ItemInput[]`
- `src/logic/date-wheel.ts`：见 §7

### 9.2 新增 presentation（纯样式函数）

- `src/app/task-timeline-presentation.ts`：分组标题文案、过期样式判定等。
- 倒计时卡样式可并入现有 `home-presentation.ts` 或新增 `home-countdown-presentation.ts`。

### 9.3 测试覆盖

每个 logic 配 `*.test.ts`，覆盖：负 offset、跨月/闰年、`movingDate=null`、room 匹配不上、空模板、边界天数（1/28/29/30/31）、`computeCountdown` 的正/零/负（已搬家）。

presentation 配样式契约测试（沿用 `ui-kit-style.test.ts` 套路）。**不引入组件渲染测试**（保持项目现状）。

## 10. 文件清单

**新增：**
- `src/data/task-presets.ts`
- `src/data/item-templates.ts`
- `src/logic/task-timeline.ts` + `src/logic/task-timeline.test.ts`
- `src/logic/item-template.ts` + `src/logic/item-template.test.ts`
- `src/logic/date-wheel.ts` + `src/logic/date-wheel.test.ts`
- `src/components/date-wheel.tsx`
- `src/components/template-picker.tsx`
- `src/app/task-timeline.tsx`
- `src/app/task-timeline-presentation.ts` + 样式契约测试

**改动：**
- `App.tsx`（+ `TaskTimeline` 路由、`RootStackParamList` 类型）
- `src/types/moving.ts`（schemaV4、`movingDate`、`tasks`、`MovingTask`）
- `src/logic/moving.ts`（`migrateStoredState` 补字段、schemaV4）
- `src/data/initial-data.ts`（+ `movingDate: null`、`tasks: []`）
- `src/context/moving-context.tsx`（+ 7 个方法、`Lookups` 视需要）
- `src/app/index.tsx`（倒计时卡 + 入口）
- `src/app/items.tsx`（「从模板添加」入口）

## 11. 风险与回滚

- **schema 迁移**：3→4 只加字段，向后兼容；回滚到旧版 App 时新字段被旧 `migrateStoredState` 忽略，不崩（旧版看不到 `tasks`/`movingDate`，但 rooms/boxes/items 仍可用）。
- **无原生依赖**：不涉及 `pod install` / Xcode build 配置变更，构建风险低。
- **scope 锁定**：§2 明确不做项，防止实施期扩张；任何越界需求走新 spec。
- **遗留项**：README「待办提醒」文案与实现不符，本设计不实现通知，需在发布前另行对齐（删文案 or 后续实现），不属本次范围。

## 12. 验收标准

- 首次启动：Home 不显示倒计时卡（`movingDate=null`），显示引导卡。
- 设置搬家日后：Home 显示倒计时；改搬家日，所有任务建议日联动。
- TaskTimeline：导入预设 → 12 条任务按三段分组；勾选/增/删/改可用；过期未完成标黄。
- Items 从模板添加：选房间 → 预览勾选 → 导入，物品追加到清单、关联到正确 source room。
- `npm run typecheck` / `lint` / `test --runInBand` 全绿；schema 迁移测试覆盖旧数据升级。
