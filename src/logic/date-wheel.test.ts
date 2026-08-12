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
