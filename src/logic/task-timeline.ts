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
