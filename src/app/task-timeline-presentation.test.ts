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
