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
