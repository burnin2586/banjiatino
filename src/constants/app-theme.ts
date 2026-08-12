export const AppColors = {
  background: '#F3F9FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F9FF',
  primary: '#176BDB',
  primaryBright: '#2F80ED',
  primarySoft: '#BFDFFF',
  accent: '#FFC928',
  accentSoft: '#FFF3BD',
  text: '#17243A',
  textMuted: '#53657D',
  border: '#D8E8F7',
  success: '#176BDB',
  warning: '#17243A',
  danger: '#A12F2F',
  white: '#FFFFFF',
} as const;

export const AppShadow = {
  ceramic: {
    shadowColor: '#176BDB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#176BDB',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const AppRadius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
  page: 24,
  card: 18,
  control: 14,
  label: 10,
} as const;

export const AppTypography = {
  pageTitle: { fontSize: 32, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '600' },
} as const;

export const AppMotion = {
  press: 120,
  standard: 180,
} as const;
