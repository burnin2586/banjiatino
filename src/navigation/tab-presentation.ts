import { AppColors, AppShadow } from '@/constants/app-theme';

import type { MainTabParamList } from './types';

type TabRouteName = keyof MainTabParamList;

type TabPresentation = {
  label: string;
  glyph: string;
};

export const tabOrder = [
  'Home',
  'Items',
  'Boxes',
  'Search',
  'Memory',
] as const satisfies readonly TabRouteName[];

const tabPresentation: Record<TabRouteName, TabPresentation> = {
  Home: { label: '进度', glyph: '⌂' },
  Items: { label: '物品', glyph: '◇' },
  Boxes: { label: '箱子', glyph: '□' },
  Search: { label: '查找', glyph: '⌕' },
  Memory: { label: '回忆', glyph: '◉' },
};

export function getTabPresentation(routeName: TabRouteName): TabPresentation {
  return tabPresentation[routeName];
}

export function getTabItemPresentation(selected: boolean) {
  if (selected) {
    return {
      backgroundColor: AppColors.primary,
      ...AppShadow.raised,
    };
  }

  return {
    backgroundColor: 'transparent',
    elevation: 0,
  };
}

export function getTabBarLayout(bottomInset: number) {
  const safeBottom = Math.max(bottomInset, 20);

  return {
    height: Math.max(82, 50 + safeBottom),
    paddingBottom: safeBottom,
  };
}
