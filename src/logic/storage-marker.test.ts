import { MIN_MARKER, denormalizeRect, isValidMarkerSize, normalizeRect } from '@/logic/storage-marker';

describe('normalizeRect / denormalizeRect', () => {
  const photo = { width: 400, height: 300 };

  it('屏幕像素归一化到 0~1', () => {
    expect(normalizeRect({ x: 100, y: 60, w: 200, h: 150 }, photo)).toEqual({
      x: 0.25, y: 0.2, w: 0.5, h: 0.5,
    });
  });

  it('归一化再反归一化往返一致', () => {
    const rect = { x: 0.25, y: 0.2, w: 0.5, h: 0.5 };
    const back = denormalizeRect(rect, photo);
    expect(back).toEqual({ x: 100, y: 60, w: 200, h: 150 });
  });

  it('clamp 到 [0,1]，不超出照片', () => {
    const r = normalizeRect({ x: -10, y: -10, w: 1000, h: 1000 }, photo);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.w).toBeLessThanOrEqual(1);
    expect(r.h).toBeLessThanOrEqual(1);
  });
});

describe('isValidMarkerSize', () => {
  it('小于最小尺寸判 false', () => {
    expect(isValidMarkerSize({ x: 0, y: 0, w: 0.01, h: 0.01 })).toBe(false);
    expect(isValidMarkerSize({ x: 0, y: 0, w: MIN_MARKER, h: MIN_MARKER })).toBe(true);
  });
});
