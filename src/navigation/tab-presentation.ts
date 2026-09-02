import { AppColors, AppShadow } from '@/constants/app-theme';

import type { MainTabParamList } from './types';

type TabRouteName = keyof MainTabParamList;

type TabPresentation = {
  label: string;
  icon: 'ChartNoAxesColumnIncreasing' | 'ListChecks' | 'Package' | 'Search';
};

export const tabOrder = [
  'Home',
  'Items',
  'Boxes',
  'Search',
] as const satisfies readonly TabRouteName[];

const tabPresentation: Record<TabRouteName, TabPresentation> = {
  Home: { label: '进度', icon: 'ChartNoAxesColumnIncreasing' },
  Items: { label: '物品', icon: 'ListChecks' },
  Boxes: { label: '箱子', icon: 'Package' },
  Search: { label: '查找', icon: 'Search' },
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
