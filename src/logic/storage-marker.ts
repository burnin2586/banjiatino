import type { MarkerRect } from '@/types/moving';

export const MIN_MARKER = 0.05;

export type ScreenRect = { x: number; y: number; w: number; h: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function normalizeRect(s: ScreenRect, photo: { width: number; height: number }): MarkerRect {
  const x = clamp01(s.x / photo.width);
  const y = clamp01(s.y / photo.height);
  const w = clamp01(s.w / photo.width);
  const h = clamp01(s.h / photo.height);
  return { x, y, w, h };
}

export function denormalizeRect(r: MarkerRect, photo: { width: number; height: number }): ScreenRect {
  return {
    x: r.x * photo.width,
    y: r.y * photo.height,
    w: r.w * photo.width,
    h: r.h * photo.height,
  };
}

export function isValidMarkerSize(r: MarkerRect): boolean {
  return r.w >= MIN_MARKER && r.h >= MIN_MARKER;
}
