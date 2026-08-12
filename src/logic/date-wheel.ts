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
