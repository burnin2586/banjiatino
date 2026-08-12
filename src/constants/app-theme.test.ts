import { AppColors, AppMotion, AppRadius, AppShadow } from './app-theme';

test('uses the approved Banjiatino palette', () => {
  expect(AppColors).toMatchObject({
    primary: '#176BDB',
    primaryBright: '#2F80ED',
    primarySoft: '#BFDFFF',
    background: '#F3F9FF',
    surface: '#FFFFFF',
    accent: '#FFC928',
    accentSoft: '#FFF3BD',
    text: '#17243A',
    textMuted: '#53657D',
    border: '#D8E8F7',
    danger: '#A12F2F',
  });
});

test('defines continuous radii, soft shadows, and restrained motion', () => {
  expect(AppRadius).toMatchObject({ page: 24, card: 18, control: 14, label: 10 });
  expect(AppShadow.ceramic.shadowColor).toBe('#176BDB');
  expect(AppShadow.ceramic.shadowRadius).toBeGreaterThan(0);
  expect(AppMotion.press).toBeGreaterThanOrEqual(100);
  expect(AppMotion.press).toBeLessThanOrEqual(140);
});
