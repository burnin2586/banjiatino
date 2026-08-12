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
    expect(nextPendingTask(tasks, moving)?.id).toBe('soon');
  });
  it('全部完成返回 null', () => {
    const tasks = [task({ done: true })];
    expect(nextPendingTask(tasks, 1_000_000)).toBeNull();
  });
  it('movingDate 为 null 时仍按 offset 升序取第一条', () => {
    const tasks = [
      task({ id: 'a', dueOffsetDays: 3 }),
      task({ id: 'b', dueOffsetDays: -2 }),
    ];
    expect(nextPendingTask(tasks, null)?.id).toBe('b');
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
