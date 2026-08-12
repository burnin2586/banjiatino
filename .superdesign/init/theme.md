# Current implementation theme

> This file records the tokens that are actually in the current source. They predate the approved blue toy-style target in `.superdesign/design-system.md`; future design drafts should treat the design system as the target direction and this file as implementation evidence.

## Part 1 — Compact actual token summary

### Framework and styling

- React Native `StyleSheet` objects; no CSS variables, Tailwind configuration, CSS Modules, theme provider, or responsive web breakpoint system.
- Fonts use the iOS/React Native system family. No custom font family or centralized type-scale tokens are defined; component font sizes and weights are local.
- No centralized shadow tokens or breakpoint tokens are defined; shadows and elevations are local to component styles.

### Colors

| Token | Value |
| --- | --- |
| `AppColors.background` | `#F6F4EF` |
| `AppColors.surface` | `#FFFFFF` |
| `AppColors.surfaceMuted` | `#ECE9E1` |
| `AppColors.primary` | `#2F6B4F` |
| `AppColors.primarySoft` | `#DDEAE2` |
| `AppColors.accent` | `#D97A47` |
| `AppColors.accentSoft` | `#F6E5DA` |
| `AppColors.text` | `#17201B` |
| `AppColors.textMuted` | `#68736C` |
| `AppColors.border` | `#DEDCD5` |
| `AppColors.success` | `#287A52` |
| `AppColors.warning` | `#B36A2E` |
| `AppColors.danger` | `#B94A48` |
| `AppColors.white` | `#FFFFFF` |

### Spacing

| Token | Value |
| --- | --- |
| `xs` | `4` |
| `sm` | `8` |
| `md` | `12` |
| `lg` | `16` |
| `xl` | `24` |
| `xxl` | `32` |

### Radius

| Token | Value |
| --- | --- |
| `sm` | `10` |
| `md` | `16` |
| `lg` | `22` |
| `pill` | `999` |

## Part 2 — Full raw source

### `src/constants/app-theme.ts`

```ts
export const AppColors = {
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceMuted: '#ECE9E1',
  primary: '#2F6B4F',
  primarySoft: '#DDEAE2',
  accent: '#D97A47',
  accentSoft: '#F6E5DA',
  text: '#17201B',
  textMuted: '#68736C',
  border: '#DEDCD5',
  success: '#287A52',
  warning: '#B36A2E',
  danger: '#B94A48',
  white: '#FFFFFF',
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
} as const;
```

