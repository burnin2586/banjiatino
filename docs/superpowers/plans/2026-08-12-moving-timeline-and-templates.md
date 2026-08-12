# 搬家时间清单 + 房间物品模板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为「搬家条理」App 新增 (1) 以搬家日为锚点的倒计时 + 预设任务时间线，(2) 按房间打包的物品模板一键导入，两个轻量化功能。

**Architecture:** schemaVersion 3→4，在 `MovingState` 加 `movingDate` + `tasks`。沿用项目现有「presentation 抽离 + logic 纯函数 + jest」模式：所有日期/分组/倒计时逻辑抽到 `src/logic/`，UI 用 `ui-kit` 复用组件。日期选择器自建纯 JS 滚轮（零原生依赖）。任务/模板预设放 `src/data/` 只读源，导入后变成用户可编辑实体。

**Tech Stack:** React Native 0.81 (Community CLI)、TypeScript strict、jest(preset react-native)、`@react-navigation/native-stack`、AsyncStorage。`@/` → `src/`。

## Global Constraints

- **分支：** 在 feature 分支（或 worktree）上执行，每个 task 的 commit 直接提交到该分支；勿直接提交 `master`。
- **commit message 用英文，不加 `Co-Authored-By` 或工具前缀。**
- **零原生依赖：** 不新增任何需要 `pod install` / Xcode 重新 build 的包。日期选择器自建纯 JS。
- **不写组件渲染测试**（保持项目现状）；可测逻辑必须抽纯函数进 `src/logic/` 并配 `*.test.ts`。
- **路径别名 `@/` → `src/`**（jest 与 tsconfig 都已配）。
- **TDD：** 每个 logic 任务先写失败测试 → 跑红 → 实现 → 跑绿 → commit。
- **质量门禁：** 每个 task 结束跑 `npm run typecheck && npm run lint && npm test -- --runInBand`，全绿才进入下一个 task。
- **MovingItem 无 `roomId` 字段**（只有 `boxId` + 自由文本 `originalLocation`）。物品模板导入的"房间归属"落地为 `originalLocation` 填房间名（详见 Task 8/9）。
- **spec 文档：** `docs/superpowers/specs/2026-08-12-moving-timeline-and-templates-design.md`。本 plan 是其落地，与之冲突处以 spec 为准（除 Global Constraints 里明确细化的点）。

---

## File Structure

**新增（logic + data + 组件 + 页面）：**
- `src/data/task-presets.ts` — 任务预设只读源
- `src/data/item-templates.ts` — 房间物品模板只读源
- `src/logic/task-timeline.ts` — 任务时间线纯函数（建议日/分组/倒计时/下一任务/预设转种子）
- `src/logic/task-timeline.test.ts`
- `src/logic/date-wheel.ts` — 日期滚轮纯函数（闰年/夹值/时间戳转换）
- `src/logic/date-wheel.test.ts`
- `src/logic/item-template.ts` — 模板匹配/转物品种子
- `src/logic/item-template.test.ts`
- `src/components/date-wheel.tsx` — 自建三列滚轮组件
- `src/components/template-picker.tsx` — 模板选择 + 预览 ModalSheet
- `src/app/task-timeline.tsx` — 时间线页面
- `src/app/task-timeline-presentation.ts` — 时间线纯样式函数
- `src/app/task-timeline-presentation.test.ts`

**修改：**
- `src/types/moving.ts` — `MovingTask`、`MovingState` schemaV4
- `src/data/initial-data.ts` — `movingDate: null`、`tasks: []`
- `src/logic/moving.ts` — `migrateStoredState` 补字段、schemaV4
- `src/logic/moving.test.ts` — 更新受影响断言
- `src/context/moving-context.tsx` — 7 个新方法
- `App.tsx` — `TaskTimeline` 路由 + 类型
- `src/navigation/types.ts` — `RootStackParamList` 加 `TaskTimeline`
- `src/app/index.tsx` — Home 倒计时卡 + 入口
- `src/app/items.tsx` — 「从模板添加」入口

---

## Task 1: Schema 3→4（types + initial-data + 迁移）

**Files:**
- Modify: `src/types/moving.ts`
- Modify: `src/data/initial-data.ts`
- Modify: `src/logic/moving.ts`
- Modify: `src/logic/moving.test.ts`

**Interfaces:**
- Produces: `MovingTask` 类型、`MovingState.movingDate: number | null`、`MovingState.tasks: MovingTask[]`、`MovingState.schemaVersion: 4`；`migrateStoredState` 对旧数据补 `movingDate: null`、`tasks: []`。后续所有 task 依赖这些。

- [ ] **Step 1: 改类型**

`src/types/moving.ts` — 在 `StoragePhoto` 类型之后、`MovingState` 之前加 `MovingTask`；改 `MovingState`：

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
  schemaVersion: 4;
  movingDate: number | null;   // 搬家日 0 点时间戳；null = 未设置
  tasks: MovingTask[];
  rooms: Room[];
  boxes: MovingBox[];
  items: MovingItem[];
  storagePhotos: StoragePhoto[];
};
```

- [ ] **Step 2: 改 initial-data**

`src/data/initial-data.ts` — `initialMovingState` 顶部加两个字段，`schemaVersion` 改 4：

```ts
export const initialMovingState: MovingState = {
  schemaVersion: 4,
  movingDate: null,
  tasks: [],
  rooms: [ /* 不变 */ ],
  boxes: [ /* 不变 */ ],
  items: [ /* 不变 */ ],
  storagePhotos: [],
};
```

- [ ] **Step 3: 写失败测试（迁移新字段）**

在 `src/logic/moving.test.ts` 的 `describe('migrateStoredState', ...)` 内追加：

```ts
  it('旧数据补 movingDate=null 与空 tasks，schema 升到 4', () => {
    const stored = {
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [],
    };
    const result = migrateStoredState(stored);
    expect(result.schemaVersion).toBe(4);
    expect(result.movingDate).toBeNull();
    expect(result.tasks).toEqual([]);
  });

  it('保留已有的 movingDate 与 tasks', () => {
    const stored = {
      schemaVersion: 4,
      movingDate: 1_700_000_000_000,
      tasks: [
        { id: 'task-1', title: '约搬家公司', dueOffsetDays: -7, done: false, note: '', createdAt: 1, updatedAt: 2 },
      ],
      rooms: [{ id: 'room-a', name: '客厅', color: '#fff', kind: 'source', order: 0 }],
      boxes: [],
      items: [],
    };
    const result = migrateStoredState(stored);
    expect(result.movingDate).toBe(1_700_000_000_000);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('约搬家公司');
  });
```

同时把现有这条断言（约第 49 行）的 `3` 改成 `4`：

```ts
  it('null 或非对象时回退到示例数据', () => {
    expect(migrateStoredState(null).schemaVersion).toBe(4);
    expect(migrateStoredState(null).storagePhotos).toEqual([]);
    expect(migrateStoredState('hello').rooms.length).toBeGreaterThan(0);
    expect(migrateStoredState(undefined).boxes).toBeDefined();
  });
```

并把「完整 V2 数据保留房间与箱子结构」用例（约第 56 行）的 `const state: MovingState` 补字段（避免 strict 报错）：

```ts
    const state: MovingState = {
      schemaVersion: 4,
      movingDate: null,
      tasks: [],
      rooms: [ /* 原内容不变 */ ],
      boxes: [ /* 原内容不变 */ ],
      items: [],
      storagePhotos: [],
    };
```

- [ ] **Step 4: 跑测试确认迁移用例失败**

Run: `npm test -- --runInBand src/logic/moving.test.ts`
Expected: 新加的两条 `migrateStoredState` 用例 FAIL（`movingDate`/`tasks` 为 undefined 或 schema 仍 3）。

- [ ] **Step 5: 实现迁移**

`src/logic/moving.ts` 的 `migrateStoredState` 末尾返回处补字段、改 schemaVersion。把最后的 `return { schemaVersion: 3, rooms, boxes, items, storagePhotos };` 改为：

```ts
  const raw = stored as { movingDate?: unknown; tasks?: unknown };
  const movingDate =
    typeof raw.movingDate === 'number' ? raw.movingDate : null;
  const tasks: MovingTask[] = Array.isArray(raw.tasks)
    ? raw.tasks
        .filter((t): t is MovingTask => {
          return (
            !!t && typeof t === 'object' &&
            typeof (t as MovingTask).id === 'string' &&
            typeof (t as MovingTask).title === 'string' &&
            typeof (t as MovingTask).dueOffsetDays === 'number'
          );
        })
        .map((t) => ({
          id: t.id,
          title: t.title.trim(),
          dueOffsetDays: t.dueOffsetDays,
          done: !!t.done,
          note: t.note ?? '',
          createdAt: t.createdAt ?? now,
          updatedAt: t.updatedAt ?? t.createdAt ?? now,
        }))
    : [];
  return { schemaVersion: 4, movingDate, tasks, rooms, boxes, items, storagePhotos };
```

并在文件顶部 `import type { ... } from '@/types/moving'` 中加入 `MovingTask`。

- [ ] **Step 6: 跑测试确认全绿**

Run: `npm test -- --runInBand src/logic/moving.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 7: 全量门禁**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand`
Expected: 全绿。

- [ ] **Step 8: Commit**

```bash
git add src/types/moving.ts src/data/initial-data.ts src/logic/moving.ts src/logic/moving.test.ts
git commit -m "Bump moving state schema to v4 with movingDate and tasks"
```

---

## Task 2: 任务预设 + 时间线 logic

**Files:**
- Create: `src/data/task-presets.ts`
- Create: `src/logic/task-timeline.ts`
- Create: `src/logic/task-timeline.test.ts`

**Interfaces:**
- Consumes: `MovingTask` from Task 1, `TaskPreset`（本 task 定义）
- Produces: `computeSuggestedDate(movingDate, offsetDays) → number|null`、`groupTasksByPhase(tasks) → {before,dayOf,after}`、`computeCountdown(movingDate, today) → {days,label,isPast}`、`nextPendingTask(tasks, movingDate, today) → MovingTask|null`、`buildTasksFromPresets(presets) → NewTaskSeed[]`、`phaseForOffset(offset) → 'before'|'dayOf'|'after'`、`TaskPhase`、`NewTaskSeed`。Task 4/6/7 依赖。

- [ ] **Step 1: 建预设数据**

`src/data/task-presets.ts`:

```ts
export type TaskPreset = { title: string; dueOffsetDays: number };

export const TASK_PRESETS: TaskPreset[] = [
  { title: '断舍离：清理不再需要的物品（丢弃/赠送/出售）', dueOffsetDays: -21 },
  { title: '联系搬家公司，比价并预约', dueOffsetDays: -14 },
  { title: '准备打包材料：纸箱、胶带、气泡膜、记号笔', dueOffsetDays: -10 },
  { title: '开始打包非必需品（反季衣物、装饰、藏书）', dueOffsetDays: -7 },
  { title: '通知物业/房东退租，确认交接时间', dueOffsetDays: -5 },
  { title: '预约旧家和新家的搬家电梯/车位', dueOffsetDays: -3 },
  { title: '打包厨房非日用的锅碗餐具', dueOffsetDays: -2 },
  { title: '打包「搬家当天必需包」（换洗衣物、洗漱、充电器、证件）', dueOffsetDays: -1 },
  { title: '搬家当天：逐箱清点数量，确认到达', dueOffsetDays: 0 },
  { title: '入住后：检查贵重物品、家电是否完好', dueOffsetDays: 1 },
  { title: '拆必需品箱子，恢复日常起居', dueOffsetDays: 2 },
  { title: '更新收件地址、快递、银行卡、订阅', dueOffsetDays: 7 },
];
```

- [ ] **Step 2: 写失败测试**

`src/logic/task-timeline.test.ts`:

```ts
import {
  buildTasksFromPresets,
  computeCountdown,
  computeSuggestedDate,
  groupTasksByPhase,
  nextPendingTask,
  phaseForOffset,
} from '@/logic/task-timeline';
import type { MovingTask } from '@/types/moving';
import { TASK_PRESETS } from '@/data/task-presets';

const DAY = 86_400_000;
const localMidnight = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

const task = (over: Partial<MovingTask> = {}): MovingTask => ({
  id: 't',
  title: 'x',
  dueOffsetDays: 0,
  done: false,
  note: '',
  createdAt: 1,
  updatedAt: 2,
  ...over,
});

describe('computeSuggestedDate', () => {
  it('movingDate 为 null 时返回 null', () => {
    expect(computeSuggestedDate(null, -3)).toBeNull();
  });
  it('按 offset 天数偏移', () => {
    expect(computeSuggestedDate(1_000_000, -2)).toBe(1_000_000 - 2 * DAY);
    expect(computeSuggestedDate(1_000_000, 3)).toBe(1_000_000 + 3 * DAY);
  });
});

describe('phaseForOffset', () => {
  it('负数=before，0=dayOf，正数=after', () => {
    expect(phaseForOffset(-1)).toBe('before');
    expect(phaseForOffset(0)).toBe('dayOf');
    expect(phaseForOffset(1)).toBe('after');
  });
});

describe('groupTasksByPhase', () => {
  it('按 offset 分组并组内升序', () => {
    const tasks = [
      task({ id: 'a', dueOffsetDays: -1 }),
      task({ id: 'b', dueOffsetDays: -5 }),
      task({ id: 'c', dueOffsetDays: 0 }),
      task({ id: 'd', dueOffsetDays: 2 }),
    ];
    const g = groupTasksByPhase(tasks);
    expect(g.before.map((t) => t.id)).toEqual(['b', 'a']);
    expect(g.dayOf.map((t) => t.id)).toEqual(['c']);
    expect(g.after.map((t) => t.id)).toEqual(['d']);
  });
});

describe('computeCountdown', () => {
  it('未来日期返回剩余天数', () => {
    const today = localMidnight(2026, 8, 12);
    const moving = localMidnight(2026, 8, 15);
    expect(computeCountdown(moving, today)).toEqual({ days: 3, label: '距搬家还有 3 天', isPast: false });
  });
  it('同一天返回今天搬家', () => {
    const ts = localMidnight(2026, 8, 12);
    expect(computeCountdown(ts, ts)).toEqual({ days: 0, label: '今天搬家', isPast: false });
  });
  it('过去日期返回已搬家 N 天', () => {
    const today = localMidnight(2026, 8, 12);
    const moving = localMidnight(2026, 8, 10);
    expect(computeCountdown(moving, today)).toEqual({ days: 2, label: '已搬家 2 天', isPast: true });
  });
});

describe('nextPendingTask', () => {
  it('返回未完成任务中建议日最早的一条', () => {
    const tasks = [
      task({ id: 'late', dueOffsetDays: -1, done: false }),
      task({ id: 'soon', dueOffsetDays: -7, done: false }),
      task({ id: 'done', dueOffsetDays: -10, done: true }),
    ];
    const moving = localMidnight(2026, 8, 12);
    expect(nextPendingTask(tasks, moving, localMidnight(2026, 8, 1))?.id).toBe('soon');
  });
  it('全部完成返回 null', () => {
    const tasks = [task({ done: true })];
    expect(nextPendingTask(tasks, 1_000_000, 1)).toBeNull();
  });
  it('movingDate 为 null 时仍按 offset 升序取第一条', () => {
    const tasks = [
      task({ id: 'a', dueOffsetDays: 3 }),
      task({ id: 'b', dueOffsetDays: -2 }),
    ];
    expect(nextPendingTask(tasks, null, 1)?.id).toBe('b');
  });
});

describe('buildTasksFromPresets', () => {
  it('把预设转成 done=false、note 空的种子', () => {
    const seeds = buildTasksFromPresets(TASK_PRESETS);
    expect(seeds).toHaveLength(TASK_PRESETS.length);
    expect(seeds[0]).toEqual({
      title: TASK_PRESETS[0].title,
      dueOffsetDays: TASK_PRESETS[0].dueOffsetDays,
      done: false,
      note: '',
    });
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npm test -- --runInBand src/logic/task-timeline.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现**

`src/logic/task-timeline.ts`:

```ts
import type { TaskPreset } from '@/data/task-presets';
import type { MovingTask } from '@/types/moving';

const DAY_MS = 86_400_000;

export function computeSuggestedDate(
  movingDate: number | null,
  offsetDays: number,
): number | null {
  if (movingDate === null) return null;
  return movingDate + offsetDays * DAY_MS;
}

export type TaskPhase = 'before' | 'dayOf' | 'after';

export function phaseForOffset(offsetDays: number): TaskPhase {
  if (offsetDays < 0) return 'before';
  if (offsetDays === 0) return 'dayOf';
  return 'after';
}

export function groupTasksByPhase(tasks: MovingTask[]): {
  before: MovingTask[];
  dayOf: MovingTask[];
  after: MovingTask[];
} {
  const byPhase = {
    before: [] as MovingTask[],
    dayOf: [] as MovingTask[],
    after: [] as MovingTask[],
  };
  for (const t of tasks) byPhase[phaseForOffset(t.dueOffsetDays)].push(t);
  const asc = (a: MovingTask, b: MovingTask) => a.dueOffsetDays - b.dueOffsetDays;
  byPhase.before.sort(asc);
  byPhase.dayOf.sort(asc);
  byPhase.after.sort(asc);
  return byPhase;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeCountdown(
  movingDate: number,
  today: number,
): { days: number; label: string; isPast: boolean } {
  const days = Math.round((startOfDay(movingDate) - startOfDay(today)) / DAY_MS);
  if (days < 0) return { days: -days, label: `已搬家 ${-days} 天`, isPast: true };
  if (days === 0) return { days: 0, label: '今天搬家', isPast: false };
  return { days, label: `距搬家还有 ${days} 天`, isPast: false };
}

export function nextPendingTask(
  tasks: MovingTask[],
  movingDate: number | null,
  _today: number,
): MovingTask | null {
  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => a.dueOffsetDays - b.dueOffsetDays);
  return pending[0] ?? null;
}

export type NewTaskSeed = Pick<MovingTask, 'title' | 'dueOffsetDays' | 'done' | 'note'>;

export function buildTasksFromPresets(presets: TaskPreset[]): NewTaskSeed[] {
  return presets.map((p) => ({
    title: p.title,
    dueOffsetDays: p.dueOffsetDays,
    done: false,
    note: '',
  }));
}
```

> 说明：`nextPendingTask` 按 `dueOffsetDays` 升序取第一条未完成（movingDate 是否为 null 不影响相对顺序；建议日的具体展示由调用方用 `computeSuggestedDate` 处理）。`_today` 暂作保留参数，便于未来按"今天"过滤。

- [ ] **Step 5: 跑测试确认全绿**

Run: `npm test -- --runInBand src/logic/task-timeline.test.ts`
Expected: PASS。

- [ ] **Step 6: 全量门禁 + Commit**

```bash
npm run typecheck && npm run lint && npm test -- --runInBand
git add src/data/task-presets.ts src/logic/task-timeline.ts src/logic/task-timeline.test.ts
git commit -m "Add task timeline logic and preset data"
```

---

## Task 3: 日期滚轮 logic

**Files:**
- Create: `src/logic/date-wheel.ts`
- Create: `src/logic/date-wheel.test.ts`

**Interfaces:**
- Produces: `DateParts = {year,month,day}`、`getDaysInMonth(year,month)`、`clampDay(year,month,day)`、`toDateStamp(parts)`、`fromDateStamp(ts)`、`yearRange(centerYear,span?)`。Task 5（滚轮组件）依赖。

- [ ] **Step 1: 写失败测试**

`src/logic/date-wheel.test.ts`:

```ts
import {
  clampDay,
  fromDateStamp,
  getDaysInMonth,
  toDateStamp,
  yearRange,
} from '@/logic/date-wheel';

describe('getDaysInMonth', () => {
  it('大月 31、小月 30', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(getDaysInMonth(2026, 4)).toBe(30);
    expect(getDaysInMonth(2026, 11)).toBe(30);
  });
  it('平年 2 月 28、闰年 2 月 29', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2024, 2)).toBe(29);   // 能被 4 整除
    expect(getDaysInMonth(2100, 2)).toBe(28);   // 能被 100 但不被 400 → 平年
    expect(getDaysInMonth(2000, 2)).toBe(29);   // 能被 400 → 闰年
  });
});

describe('clampDay', () => {
  it('超出月份上限回夹', () => {
    expect(clampDay(2026, 2, 30)).toBe(28);
    expect(clampDay(2024, 2, 30)).toBe(29);
    expect(clampDay(2026, 4, 31)).toBe(30);
  });
  it('小于 1 回 1', () => {
    expect(clampDay(2026, 1, 0)).toBe(1);
  });
});

describe('toDateStamp / fromDateStamp 往返', () => {
  it('本地日 0 点往返一致', () => {
    const parts = { year: 2026, month: 8, day: 12 };
    expect(fromDateStamp(toDateStamp(parts))).toEqual(parts);
  });
});

describe('yearRange', () => {
  it('以中心年前后各 span 年', () => {
    expect(yearRange(2026, 5)).toHaveLength(11);
    expect(yearRange(2026, 5)[0]).toBe(2021);
    expect(yearRange(2026, 5)[10]).toBe(2031);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- --runInBand src/logic/date-wheel.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

`src/logic/date-wheel.ts`:

```ts
export type DateParts = { year: number; month: number; day: number }; // month 1-12, day 1-31

export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), getDaysInMonth(year, month));
}

export function toDateStamp(parts: DateParts): number {
  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).getTime();
}

export function fromDateStamp(ts: number): DateParts {
  const d = new Date(ts);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function yearRange(centerYear: number, span = 5): number[] {
  const out: number[] = [];
  for (let y = centerYear - span; y <= centerYear + span; y++) out.push(y);
  return out;
}
```

- [ ] **Step 4: 跑测试确认全绿**

Run: `npm test -- --runInBand src/logic/date-wheel.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量门禁 + Commit**

```bash
npm run typecheck && npm run lint && npm test -- --runInBand
git add src/logic/date-wheel.ts src/logic/date-wheel.test.ts
git commit -m "Add date wheel logic (leap year, clamp, timestamp helpers)"
```

---

## Task 4: MovingContext 任务方法

**Files:**
- Modify: `src/context/moving-context.tsx`

**Interfaces:**
- Consumes: `TASK_PRESETS` + `buildTasksFromPresets`（Task 2）、`MovingTask`（Task 1）
- Produces: context value 加 `setMovingDate`、`addTask`、`updateTask`、`deleteTask`、`toggleTask`、`importTaskPresets`。Task 6/7 依赖。

> 项目现状 context 方法不写单元测试（靠 logic + typecheck + 集成保证）。本 task 的验证是 typecheck/lint/全量 test 不回归。

- [ ] **Step 1: 加 import**

`src/context/moving-context.tsx` 顶部 import 区加：

```ts
import { TASK_PRESETS } from '@/data/task-presets';
import { buildTasksFromPresets } from '@/logic/task-timeline';
```

并把 `MovingTask` 加入 `@/types/moving` 的 type import。

- [ ] **Step 2: 加类型与 context value 签名**

在 `MovingContextValue` 类型里加：

```ts
  setMovingDate: (date: number | null) => void;
  addTask: (input: { title: string; dueOffsetDays: number; note?: string }) => void;
  updateTask: (taskId: string, input: { title: string; dueOffsetDays: number; note?: string }) => void;
  deleteTask: (taskId: string) => void;
  toggleTask: (taskId: string) => void;
  importTaskPresets: () => void;
```

- [ ] **Step 3: 实现 6 个方法**

在 `clearBoxMarker` 之后、`resetToDemo` 之前插入：

```ts
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
```

- [ ] **Step 4: 把 6 个方法接入 context value**

在 `value` 的 `useMemo` 对象与依赖数组中加入这 6 个方法（`setMovingDate, addTask, updateTask, deleteTask, toggleTask, importTaskPresets`）。

- [ ] **Step 5: 全量门禁**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand`
Expected: 全绿（无新测试，仅保证不回归）。

- [ ] **Step 6: Commit**

```bash
git add src/context/moving-context.tsx
git commit -m "Add task and movingDate operations to MovingContext"
```

---

## Task 5: 自建日期滚轮组件

**Files:**
- Create: `src/components/date-wheel.tsx`

**Interfaces:**
- Consumes: `src/logic/date-wheel.ts`（Task 3）、`@/constants/app-theme`
- Produces: `DateWheel` 组件，`props: { value: number; onChange: (ts: number) => void; centerYear?: number }`。Task 6/7 使用。

> 组件无单元测试（项目无组件渲染测试）；靠 date-wheel logic 测 + typecheck + 手动 QA。

- [ ] **Step 1: 实现组件**

`src/components/date-wheel.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import {
  clampDay,
  fromDateStamp,
  getDaysInMonth,
  toDateStamp,
  yearRange,
  type DateParts,
} from '@/logic/date-wheel';

const ITEM_HEIGHT = 40;

function Column({
  items,
  selected,
  format,
  onSelect,
}: {
  items: number[];
  selected: number;
  format: (n: number) => string;
  onSelect: (n: number) => void;
}) {
  const initialIndex = Math.max(0, items.indexOf(selected));
  return (
    <ScrollView
      style={styles.column}
      contentContainerStyle={styles.columnContent}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      initialScrollIndex={initialIndex}
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      onMomentumScrollEnd={(e) => {
        const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
        const clamped = Math.min(Math.max(0, index), items.length - 1);
        const value = items[clamped];
        if (value !== undefined && value !== selected) onSelect(value);
      }}>
      {items.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={String(n)}
            onPress={() => onSelect(n)}
            style={[styles.item, active && styles.itemActive]}>
            <Text style={[styles.itemText, active && styles.itemTextActive]}>{format(n)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function DateWheel({
  value,
  onChange,
  centerYear,
}: {
  value: number;
  onChange: (ts: number) => void;
  centerYear?: number;
}) {
  const initial = useMemo(() => fromDateStamp(value), [value]);
  const [parts, setParts] = useState<DateParts>(initial);
  const years = useMemo(() => yearRange(centerYear ?? initial.year), [centerYear, initial.year]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(
    () => Array.from({ length: getDaysInMonth(parts.year, parts.month) }, (_, i) => i + 1),
    [parts.year, parts.month],
  );

  function emit(next: DateParts) {
    const day = clampDay(next.year, next.month, next.day);
    const finalParts = { ...next, day };
    setParts(finalParts);
    onChange(toDateStamp(finalParts));
  }

  return (
    <View style={styles.row}>
      <Column
        items={years}
        selected={parts.year}
        format={(y) => `${y} 年`}
        onSelect={(year) => emit({ ...parts, year })}
      />
      <Column
        items={months}
        selected={parts.month}
        format={(m) => `${m} 月`}
        onSelect={(month) => emit({ ...parts, month })}
      />
      <Column
        items={days}
        selected={parts.day}
        format={(d) => `${d} 日`}
        onSelect={(day) => emit({ ...parts, day })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: AppSpacing.sm,
  },
  column: {
    flex: 1,
    maxHeight: ITEM_HEIGHT * 5,
    borderRadius: AppRadius.control,
    backgroundColor: AppColors.background,
  },
  columnContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: AppRadius.control,
  },
  itemActive: {
    backgroundColor: AppColors.primarySoft,
  },
  itemText: {
    color: AppColors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  itemTextActive: {
    color: AppColors.primary,
    fontWeight: '800',
  },
});
```

- [ ] **Step 2: 全量门禁**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand`
Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
git add src/components/date-wheel.tsx
git commit -m "Add self-built date wheel component"
```

---

## Task 6: TaskTimeline 页面 + presentation + 路由

**Files:**
- Create: `src/app/task-timeline-presentation.ts`
- Create: `src/app/task-timeline-presentation.test.ts`
- Create: `src/app/task-timeline.tsx`
- Modify: `src/navigation/types.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: Task 1/2/4/5 的全部产出
- Produces: `TaskTimelineScreen`、路由 `TaskTimeline`、`phaseTitle`、`formatSuggestedDate`、`isOverdue`。

- [ ] **Step 1: 写 presentation 测试**

`src/app/task-timeline-presentation.test.ts`:

```ts
import { formatSuggestedDate, isOverdue, phaseTitle } from '@/app/task-timeline-presentation';

describe('phaseTitle', () => {
  it('before/dayOf/after 对应中文标题', () => {
    expect(phaseTitle('before')).toBe('搬家前');
    expect(phaseTitle('dayOf')).toBe('搬家当天');
    expect(phaseTitle('after')).toBe('入住后');
  });
});

describe('formatSuggestedDate', () => {
  it('null 显示待设置', () => {
    expect(formatSuggestedDate(null)).toBe('待设置搬家日');
  });
  it('非 null 显示 M月D日', () => {
    const ts = new Date(2026, 7, 12).getTime(); // 8/12
    expect(formatSuggestedDate(ts)).toBe('8月12日');
  });
});

describe('isOverdue', () => {
  const today = new Date(2026, 7, 12).getTime();
  it('建议日早于今天且未完成 → true', () => {
    const past = new Date(2026, 7, 10).getTime();
    expect(isOverdue(past, today, false)).toBe(true);
  });
  it('已完成 → false', () => {
    const past = new Date(2026, 7, 10).getTime();
    expect(isOverdue(past, today, true)).toBe(false);
  });
  it('未来建议日 → false', () => {
    const future = new Date(2026, 7, 14).getTime();
    expect(isOverdue(future, today, false)).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- --runInBand src/app/task-timeline-presentation.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 presentation**

`src/app/task-timeline-presentation.ts`:

```ts
import type { TaskPhase } from '@/logic/task-timeline';

export function phaseTitle(phase: TaskPhase): string {
  if (phase === 'before') return '搬家前';
  if (phase === 'dayOf') return '搬家当天';
  return '入住后';
}

export function formatSuggestedDate(ts: number | null): string {
  if (ts === null) return '待设置搬家日';
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isOverdue(suggestedDate: number | null, today: number, done: boolean): boolean {
  if (done || suggestedDate === null) return false;
  return startOfDay(suggestedDate) < startOfDay(today);
}
```

- [ ] **Step 4: 跑测试确认全绿**

Run: `npm test -- --runInBand src/app/task-timeline-presentation.test.ts`
Expected: PASS。

- [ ] **Step 5: 加路由类型**

`src/navigation/types.ts` — 在 `RootStackParamList` 加：

```ts
  TaskTimeline: undefined;
```

- [ ] **Step 6: 实现页面**

`src/app/task-timeline.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Card,
  EmptyState,
  ModalSheet,
  PrimaryButton,
  Screen,
  SectionTitle,
  TextButton,
} from '@/components/ui-kit';
import { AppColors } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import { computeSuggestedDate, groupTasksByPhase } from '@/logic/task-timeline';
import type { MovingTask } from '@/types/moving';
import { DateWheel } from '@/components/date-wheel';
import type { RootStackParamList } from '@/navigation/types';
import { formatSuggestedDate, isOverdue, phaseTitle } from './task-timeline-presentation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TaskTimeline'>;

export default function TaskTimelineScreen() {
  const { state, setMovingDate, addTask, updateTask, deleteTask, toggleTask, importTaskPresets } = useMoving();
  const nav = useNavigation<Nav>();
  const movingDate = state.movingDate;
  const today = Date.now();

  const grouped = useMemo(() => groupTasksByPhase(state.tasks), [state.tasks]);
  const phases: Array<'before' | 'dayOf' | 'after'> = ['before', 'dayOf', 'after'];

  const [editing, setEditing] = useState<MovingTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <TextButton label="← 返回" onPress={() => nav.goBack()} />
        <Text style={styles.title}>搬家节奏</Text>
        <TextButton label={movingDate ? '改日期' : '设置日期'} onPress={() => setPickingDate(true)} />
      </View>
      <Text style={styles.sub}>
        {movingDate ? `搬家日：${formatSuggestedDate(movingDate)}` : '未设置搬家日'}
      </Text>

      {state.tasks.length === 0 ? (
        <>
          <EmptyState
            icon="📅"
            title="还没有任务"
            description="从预设导入一套标准搬家任务，或自己加一条。"
          />
          <PrimaryButton label="导入预设任务" onPress={importTaskPresets} />
        </>
      ) : null}

      {state.tasks.length === 0 ? null : (
        phases.map((phase) => {
          const list = grouped[phase];
          if (list.length === 0) return null;
          return (
            <View key={phase}>
              <SectionTitle title={phaseTitle(phase)} detail={`${list.length} 项`} />
              {list.map((t) => {
                const suggested = computeSuggestedDate(movingDate, t.dueOffsetDays);
                const overdue = isOverdue(suggested, today, t.done);
                return (
                  <Card key={t.id} style={styles.taskCard}>
                    <Pressable onPress={() => toggleTask(t.id)} style={styles.checkbox}>
                      <Text style={styles.checkboxGlyph}>{t.done ? '✓' : ''}</Text>
                    </Pressable>
                    <View style={styles.taskBody}>
                      <Text style={[styles.taskTitle, t.done && styles.taskDone]}>{t.title}</Text>
                      <Text style={[styles.taskMeta, overdue && styles.taskOverdue]}>
                        建议 {formatSuggestedDate(suggested)} 完成{overdue ? ' · 已过期' : ''}
                      </Text>
                    </View>
                    <TextButton label="编辑" onPress={() => setEditing(t)} />
                  </Card>
                );
              })}
            </View>
          );
        })
      )}

      <PrimaryButton label="+ 添加任务" onPress={() => setCreating(true)} />

      <TaskEditSheet
        visible={creating || editing !== null}
        task={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(input) => {
          if (editing) updateTask(editing.id, input);
          else addTask(input);
          setCreating(false);
          setEditing(null);
        }}
        onDelete={editing ? () => {
          Alert.alert('删除任务？', editing.title, [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: () => { deleteTask(editing.id); setEditing(null); } },
          ]);
        } : undefined}
      />

      <ModalSheet title="设置搬家日" visible={pickingDate} onClose={() => setPickingDate(false)}>
        <DateWheel
          value={movingDate ?? Date.now()}
          onChange={(ts) => setMovingDate(ts)}
        />
        <PrimaryButton label="完成" onPress={() => setPickingDate(false)} />
        {movingDate !== null ? (
          <TextButton label="清除搬家日" onPress={() => { setMovingDate(null); setPickingDate(false); }} />
        ) : null}
      </ModalSheet>
    </Screen>
  );
}
```

`TaskEditSheet`（同文件内私有组件）：标题 TextInput、相对天数 TextInput（数字键盘，提示"负=搬家前，0=当天，正=入住后"）、备注 TextInput；编辑态显示删除按钮。结构沿用 `ModalSheet`。

```tsx
function TaskEditSheet({
  visible, task, onClose, onSave, onDelete,
}: {
  visible: boolean;
  task: MovingTask | null;
  onClose: () => void;
  onSave: (input: { title: string; dueOffsetDays: number; note?: string }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [offset, setOffset] = useState(String(task?.dueOffsetDays ?? -7));
  const [note, setNote] = useState(task?.note ?? '');

  // 每次打开时重置表单（visible/task 变化）
  useEffect(() => {
    if (visible) {
      setTitle(task?.title ?? '');
      setOffset(String(task?.dueOffsetDays ?? -7));
      setNote(task?.note ?? '');
    }
  }, [visible, task]);

  function save() {
    const t = title.trim();
    const n = Number(offset);
    if (!t) return;
    onSave({ title: t, dueOffsetDays: Number.isFinite(n) ? Math.trunc(n) : 0, note: note.trim() });
  }

  return (
    <ModalSheet title={task ? '编辑任务' : '新建任务'} visible={visible} onClose={onClose}>
      <Text style={{ color: AppColors.textMuted }}>标题</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="如：约搬家公司" style={styles.input} />
      <Text style={{ color: AppColors.textMuted }}>相对搬家日的天数（负=搬家前，0=当天，正=入住后）</Text>
      <TextInput
        value={offset}
        onChangeText={setOffset}
        keyboardType="numeric"
        placeholder="-7"
        style={styles.input}
      />
      <Text style={{ color: AppColors.textMuted }}>备注</Text>
      <TextInput value={note} onChangeText={setNote} placeholder="可选" style={styles.input} />
      <PrimaryButton label="保存" onPress={save} />
      {onDelete ? <TextButton label="删除任务" tone="danger" onPress={onDelete} /> : null}
    </ModalSheet>
  );
}
```

页面样式（`styles`）需补 `headerRow / title / sub / taskCard / checkbox / checkboxGlyph / taskBody / taskTitle / taskDone / taskMeta / taskOverdue / input`，沿用 `AppColors / AppRadius / AppSpacing` token，参考现有页面（如 `src/app/items.tsx`）的样式风格。

> 注意：上面页面代码 import 行的 `ui-kit 其余` 是占位提示，实际实现时按真实用到的组件导入（`Card, EmptyState, ModalSheet, PrimaryButton, Screen, SectionTitle, TextButton`）。**执行者须用真实 import 替换，不得保留占位。**

- [ ] **Step 7: 接入路由**

`App.tsx` — 顶部加 `import TaskTimelineScreen from '@/app/task-timeline';`，在 `RootStack.Navigator` 内加：

```tsx
<RootStack.Screen name="TaskTimeline" component={TaskTimelineScreen} />
```

- [ ] **Step 8: 全量门禁**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand`
Expected: 全绿。

- [ ] **Step 9: 手动 QA（模拟器）**

Run: `npm run ios`，进入 App → Home 设搬家日 → 进时间线 → 导入预设 → 勾选/编辑/删除/添加任务 → 改日期看建议日联动。

- [ ] **Step 10: Commit**

```bash
git add src/app/task-timeline.tsx src/app/task-timeline-presentation.ts src/app/task-timeline-presentation.test.ts src/navigation/types.ts App.tsx
git commit -m "Add TaskTimeline screen with preset import and editing"
```

---

## Task 7: Home 倒计时卡

**Files:**
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: Task 4 的 `setMovingDate`/`importTaskPresets`、Task 2 的 `computeCountdown`/`nextPendingTask`/`computeSuggestedDate`、Task 5 的 `DateWheel`、Task 6 的 `TaskTimeline` 路由。

- [ ] **Step 1: 加 import**

`src/app/index.tsx` 顶部加：

```ts
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DateWheel } from '@/components/date-wheel';
import { computeCountdown, computeSuggestedDate, nextPendingTask } from '@/logic/task-timeline';
import { formatSuggestedDate } from './task-timeline-presentation';
import type { RootStackParamList } from '@/navigation/types';
```

- [ ] **Step 2: 在 HomeScreen 内取数据 + 导航**

在 `const { state, isLoading, lookups, startFresh } = useMoving();` 解构里加 `movingDate, tasks, setMovingDate, importTaskPresets`。加：

```ts
const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
const [pickingDate, setPickingDate] = useState(false);
const countdown = movingDate ? computeCountdown(movingDate, Date.now()) : null;
const nextTask = nextPendingTask(tasks, movingDate, Date.now());
const nextSuggested = nextTask ? computeSuggestedDate(movingDate, nextTask.dueOffsetDays) : null;
```

（`useState` 已 import；如未 import 则补。）

- [ ] **Step 3: 插入倒计时卡 JSX**

在 `<PageHeader ... />` 之后、demoCard 判断之前插入：

```tsx
{movingDate === null ? (
  <Card style={styles.countdownCard}>
    <View style={styles.countdownCopy}>
      <Text style={styles.countdownTitle}>设置搬家日，开始倒计时</Text>
      <Text style={styles.countdownDesc}>设个日子，App 会告诉你现在该做什么。</Text>
    </View>
    <View style={styles.countdownActions}>
      <PrimaryButton compact label="设置搬家日" onPress={() => setPickingDate(true)} />
      <TextButton label="一键导入任务" onPress={importTaskPresets} />
    </View>
  </Card>
) : (
  <Pressable onPress={() => nav.navigate('TaskTimeline')}>
    <Card style={[styles.countdownCard, styles.countdownCardActive]}>
      <Text style={styles.countdownEyebrow}>搬家节奏</Text>
      <Text style={styles.countdownBig}>{countdown?.label}</Text>
      <Text style={styles.countdownSub}>
        {nextTask
          ? `下一个任务：${nextTask.title}（建议 ${formatSuggestedDate(nextSuggested)}）`
          : '所有任务已完成 🎉'}
      </Text>
    </Card>
  </Pressable>
)}
```

并在 `</Screen>` 之后、`<RoomManager ... />` 之前加日期 ModalSheet：

```tsx
<ModalSheet title="设置搬家日" visible={pickingDate} onClose={() => setPickingDate(false)}>
  <DateWheel value={movingDate ?? Date.now()} onChange={(ts) => setMovingDate(ts)} />
  <PrimaryButton label="完成" onPress={() => setPickingDate(false)} />
</ModalSheet>
```

补 `ModalSheet, Pressable` 到 `ui-kit` / `react-native` 的 import。

- [ ] **Step 4: 补样式**

在 `styles` 加 `countdownCard / countdownCardActive / countdownCopy / countdownTitle / countdownDesc / countdownActions / countdownEyebrow / countdownBig / countdownSub`，沿用 token（`AppColors.primary` 主色块、`AppColors.white` 文字）。

- [ ] **Step 5: 全量门禁**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand`
Expected: 全绿。

- [ ] **Step 6: 手动 QA + Commit**

模拟器确认：未设日期显示引导卡 → 设日期 → 倒计时卡显示 → 点卡进时间线。

```bash
git add src/app/index.tsx
git commit -m "Add moving-day countdown card to Home"
```

---

## Task 8: 物品模板数据 + item-template logic

**Files:**
- Create: `src/data/item-templates.ts`
- Create: `src/logic/item-template.ts`
- Create: `src/logic/item-template.test.ts`

**Interfaces:**
- Consumes: `ItemAction`, `Room`（Task 1 / 现有类型）
- Produces: `ItemTemplateEntry`、`RoomItemTemplate`、`ROOM_ITEM_TEMPLATES`、`matchRoomByName(rooms, name) → Room|null`、`buildItemsFromTemplate(entries, roomName) → ItemInputSeed[]`。

> **细化 spec §6：** `MovingItem` 无 `roomId` 字段。模板"房间归属"落地为 `originalLocation = roomName`（文本），`boxId = null`，`action = suggestedAction`，`status = 待整理`。`matchRoomByName` 仅用于预览页确认匹配/提示选择，不写入物品结构。

- [ ] **Step 1: 建模板数据**

`src/data/item-templates.ts`:

```ts
import type { ItemAction } from '@/types/moving';

export type ItemTemplateEntry = { name: string; quantity: number; suggestedAction: ItemAction };
export type RoomItemTemplate = { roomName: string; items: ItemTemplateEntry[] };

export const ROOM_ITEM_TEMPLATES: RoomItemTemplate[] = [
  {
    roomName: '厨房',
    items: [
      { name: '锅具套装', quantity: 1, suggestedAction: '带走' },
      { name: '碗盘', quantity: 6, suggestedAction: '带走' },
      { name: '筷子餐具', quantity: 6, suggestedAction: '带走' },
      { name: '水杯', quantity: 4, suggestedAction: '带走' },
      { name: '微波炉', quantity: 1, suggestedAction: '带走' },
      { name: '电饭煲', quantity: 1, suggestedAction: '带走' },
      { name: '调料', quantity: 1, suggestedAction: '带走' },
      { name: '冰箱食物', quantity: 1, suggestedAction: '待决定' },
      { name: '砧板刀具', quantity: 1, suggestedAction: '带走' },
      { name: '保鲜盒', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '卧室',
    items: [
      { name: '当季衣物', quantity: 1, suggestedAction: '带走' },
      { name: '反季衣物（收纳）', quantity: 1, suggestedAction: '带走' },
      { name: '被子', quantity: 2, suggestedAction: '带走' },
      { name: '枕头', quantity: 2, suggestedAction: '带走' },
      { name: '床品四件套', quantity: 2, suggestedAction: '带走' },
      { name: '首饰配饰', quantity: 1, suggestedAction: '带走' },
      { name: '床头物品（眼镜/充电线）', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '书房',
    items: [
      { name: '电脑/笔记本', quantity: 1, suggestedAction: '带走' },
      { name: '书籍', quantity: 1, suggestedAction: '待决定' },
      { name: '文具', quantity: 1, suggestedAction: '带走' },
      { name: '打印机', quantity: 1, suggestedAction: '待决定' },
      { name: '数据线/充电器', quantity: 1, suggestedAction: '带走' },
      { name: '桌面电子配件', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '客厅',
    items: [
      { name: '电视', quantity: 1, suggestedAction: '带走' },
      { name: '遥控器', quantity: 1, suggestedAction: '带走' },
      { name: '沙发套', quantity: 1, suggestedAction: '带走' },
      { name: '装饰画/摆件', quantity: 1, suggestedAction: '待决定' },
      { name: '绿植', quantity: 1, suggestedAction: '待决定' },
      { name: '茶具', quantity: 1, suggestedAction: '带走' },
    ],
  },
  {
    roomName: '卫生间',
    items: [
      { name: '洗漱用品（牙刷/牙膏/洗面奶）', quantity: 1, suggestedAction: '带走' },
      { name: '毛巾浴巾', quantity: 1, suggestedAction: '带走' },
      { name: '清洁用品', quantity: 1, suggestedAction: '带走' },
      { name: '洗衣机', quantity: 1, suggestedAction: '带走' },
      { name: '护肤/化妆品', quantity: 1, suggestedAction: '带走' },
    ],
  },
];
```

- [ ] **Step 2: 写失败测试**

`src/logic/item-template.test.ts`:

```ts
import { buildItemsFromTemplate, matchRoomByName } from '@/logic/item-template';
import type { Room } from '@/types/moving';

const rooms: Room[] = [
  { id: 'room-kitchen', name: '厨房', color: '#fff', kind: 'source', order: 0 },
  { id: 'room-bedroom', name: '卧室', color: '#fff', kind: 'source', order: 1 },
  { id: 'dest-kitchen', name: '厨房', color: '#fff', kind: 'destination', order: 0 },
];

describe('matchRoomByName', () => {
  it('在 source 房间里按名匹配（大小写不敏感、去空白）', () => {
    expect(matchRoomByName(rooms, '厨房')?.id).toBe('room-kitchen');
    expect(matchRoomByName(rooms, '  厨房 ')?.id).toBe('room-kitchen');
  });
  it('只匹配 source，不匹配 destination', () => {
    expect(matchRoomByName(rooms, '厨房')?.id).not.toBe('dest-kitchen');
  });
  it('匹配不到返回 null', () => {
    expect(matchRoomByName(rooms, '阁楼')).toBeNull();
  });
});

describe('buildItemsFromTemplate', () => {
  it('originalLocation 填房间名，boxId=null，status 由模板给定', () => {
    const seeds = buildItemsFromTemplate(
      [{ name: '马克杯', quantity: 4, suggestedAction: '带走' }],
      '厨房',
    );
    expect(seeds).toEqual([
      {
        name: '马克杯',
        quantity: 4,
        originalLocation: '厨房',
        destinationLocation: '',
        boxId: null,
        action: '带走',
        note: '',
      },
    ]);
  });
  it('quantity < 1 回退为 1', () => {
    const seeds = buildItemsFromTemplate(
      [{ name: 'x', quantity: 0, suggestedAction: '带走' }],
      '厨房',
    );
    expect(seeds[0].quantity).toBe(1);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npm test -- --runInBand src/logic/item-template.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现**

`src/logic/item-template.ts`:

```ts
import type { ItemAction, MovingItem, Room } from '@/types/moving';
import type { ItemTemplateEntry } from '@/data/item-templates';

export function matchRoomByName(rooms: Room[], roomName: string): Room | null {
  const target = roomName.trim().toLowerCase();
  return (
    rooms.find((r) => r.kind === 'source' && r.name.trim().toLowerCase() === target) ?? null
  );
}

export type ItemInputSeed = Pick<
  MovingItem,
  'name' | 'quantity' | 'originalLocation' | 'destinationLocation' | 'boxId' | 'action' | 'note'
>;

export function buildItemsFromTemplate(
  entries: ItemTemplateEntry[],
  roomName: string,
): ItemInputSeed[] {
  return entries.map((e) => ({
    name: e.name,
    quantity: Math.max(1, e.quantity),
    originalLocation: roomName,
    destinationLocation: '',
    boxId: null,
    action: e.suggestedAction,
    note: '',
  }));
}

export type { ItemAction };
```

- [ ] **Step 5: 跑测试确认全绿**

Run: `npm test -- --runInBand src/logic/item-template.test.ts`
Expected: PASS。

- [ ] **Step 6: 全量门禁 + Commit**

```bash
npm run typecheck && npm run lint && npm test -- --runInBand
git add src/data/item-templates.ts src/logic/item-template.ts src/logic/item-template.test.ts
git commit -m "Add room item templates and matching logic"
```

---

## Task 9: 模板导入 context 方法 + 选择器 + Items 入口

**Files:**
- Modify: `src/context/moving-context.tsx`
- Create: `src/components/template-picker.tsx`
- Modify: `src/app/items.tsx`

**Interfaces:**
- Consumes: Task 8 产出、Task 4 的 context 模式
- Produces: context 加 `addItemsFromTemplate(entries, roomName)`、`TemplatePicker` 组件、Items 页「从模板添加」入口。

- [ ] **Step 1: context 加方法**

`src/context/moving-context.tsx` 顶部 import 加：

```ts
import type { ItemTemplateEntry } from '@/data/item-templates';
import { buildItemsFromTemplate } from '@/logic/item-template';
```

在 `MovingContextValue` 加：

```ts
  addItemsFromTemplate: (entries: ItemTemplateEntry[], roomName: string) => void;
```

在 `importTaskPresets` 之后实现：

```ts
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
```

并把 `addItemsFromTemplate` 接入 `value` 与依赖数组。

- [ ] **Step 2: 实现 TemplatePicker 组件**

`src/components/template-picker.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ChoiceChip, EmptyState, ModalSheet, PrimaryButton, SectionTitle, TextButton } from '@/components/ui-kit';
import { AppColors } from '@/constants/app-theme';
import { ROOM_ITEM_TEMPLATES, type ItemTemplateEntry, type RoomItemTemplate } from '@/data/item-templates';
import { useMoving } from '@/context/moving-context';
import { matchRoomByName } from '@/logic/item-template';

export function TemplatePicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { state, addItemsFromTemplate } = useMoving();
  const sourceRooms = state.rooms.filter((r) => r.kind === 'source');
  const [selected, setSelected] = useState<RoomItemTemplate | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const matchedRoom = selected ? matchRoomByName(sourceRooms, selected.roomName) : null;
  const hasSourceRoom = sourceRooms.length > 0;

  const entries: ItemTemplateEntry[] = selected ? selected.items : [];
  const checkedEntries = entries.filter((_, i) => checked[`${selected!.roomName}-${i}`] !== false);

  function reset() {
    setSelected(null);
    setChecked({});
  }

  function close() {
    reset();
    onClose();
  }

  function import_() {
    if (!selected || checkedEntries.length === 0) return;
    addItemsFromTemplate(checkedEntries, selected.roomName);
    close();
  }

  return (
    <ModalSheet title="从模板添加" visible={visible} onClose={close}>
      {!hasSourceRoom ? (
        <EmptyState
          icon="🏠"
          title="还没有房间"
          description="请先在「搬家作战台」添加一个旧家房间，再回来从模板导入。"
        />
      ) : selected === null ? (
        <>
          <SectionTitle title="选择房间模板" detail={`${ROOM_ITEM_TEMPLATES.length} 个`} />
          {ROOM_ITEM_TEMPLATES.map((tpl) => {
            const ok = matchRoomByName(sourceRooms, tpl.roomName);
            return (
              <Card key={tpl.roomName} style={styles.row}>
                <View style={styles.rowBody}>
                  <Text style={styles.roomName}>{tpl.roomName}</Text>
                  <Text style={styles.rowMeta}>
                    {tpl.items.length} 项{ok ? '' : '（未匹配到同名房间，导入时填入此名）'}
                  </Text>
                </View>
                <TextButton label="选择" onPress={() => { setSelected(tpl); setChecked({}); }} />
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <SectionTitle title={`${selected.roomName} · 预览`} detail={`${checkedEntries.length}/${entries.length} 项`} />
          {entries.map((e, i) => {
            const key = `${selected.roomName}-${i}`;
            const on = checked[key] !== false;
            return (
              <Pressable
                key={key}
                onPress={() => setChecked((c) => ({ ...c, [key]: !on }))}
                style={[styles.entry, !on && styles.entryOff]}>
                <Text style={[styles.entryName, !on && styles.entryNameOff]}>{e.name}</Text>
                <Text style={styles.entryQty}>×{Math.max(1, e.quantity)}</Text>
              </Pressable>
            );
          })}
          <View style={styles.actions}>
            <TextButton label="返回" onPress={() => setSelected(null)} />
            <PrimaryButton
              compact
              label={`导入 ${checkedEntries.length} 项`}
              onPress={import_}
              disabled={checkedEntries.length === 0}
            />
          </View>
        </>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  rowBody: { flex: 1 },
  roomName: { color: AppColors.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: AppColors.textMuted, fontSize: 12, marginTop: 2 },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: AppColors.primarySoft,
  },
  entryOff: { backgroundColor: 'transparent' },
  entryName: { color: AppColors.text, fontSize: 15, fontWeight: '600' },
  entryNameOff: { color: AppColors.textMuted },
  entryQty: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
```

> 注：`ChoiceChip` import 可省（未用到），实现时按 lint 结果增删 import。

- [ ] **Step 3: Items 页加入口**

`src/app/items.tsx` — 加 `const [templateVisible, setTemplateVisible] = useState(false);`，在 `PageHeader` 的 `action` 槽或列表上方放：

```tsx
<TextButton label="从模板添加" onPress={() => setTemplateVisible(true)} />
```

并在页面根节点（与现有 `ModalSheet` 同级）渲染：

```tsx
<TemplatePicker visible={templateVisible} onClose={() => setTemplateVisible(false)} />
```

顶部 import：

```ts
import { TemplatePicker } from '@/components/template-picker';
```

- [ ] **Step 4: 全量门禁**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand`
Expected: 全绿。

- [ ] **Step 5: 手动 QA + Commit**

模拟器：Items → 从模板添加 → 选厨房 → 取消勾选部分 → 导入 → 清单出现新物品、`originalLocation` 为「厨房」。

```bash
git add src/context/moving-context.tsx src/components/template-picker.tsx src/app/items.tsx
git commit -m "Add room template picker and items import"
```

---

## 完成判据（对应 spec §12）

- 首次启动 Home 显示引导卡（`movingDate=null`）；设日期后显示倒计时；改日期任务建议日联动。
- TaskTimeline：导入预设 → 12 条按三段分组；勾选/增/删/改可用；过期未完成标黄。
- Items「从模板添加」：选房间 → 预览勾选 → 导入追加，`originalLocation` 填房间名。
- `npm run typecheck && npm run lint && npm test -- --runInBand` 全绿；schema 迁移测试覆盖旧数据升级。
