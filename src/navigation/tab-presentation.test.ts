import { AppColors, AppShadow } from '@/constants/app-theme';

import {
  getTabBarLayout,
  getTabItemPresentation,
  getTabPresentation,
  tabOrder,
} from './tab-presentation';

test('keeps the approved four destinations, labels, and line icon names', () => {
  expect(tabOrder).toEqual(['Home', 'Items', 'Boxes', 'Search']);
  expect(tabOrder.map((route) => getTabPresentation(route))).toEqual([
    { label: '进度', icon: 'ChartNoAxesColumnIncreasing' },
    { label: '物品', icon: 'ListChecks' },
    { label: '箱子', icon: 'Package' },
    { label: '查找', icon: 'Search' },
  ]);
});

test('raises only the selected tab item', () => {
  expect(getTabItemPresentation(true)).toEqual({
    backgroundColor: AppColors.primary,
    ...AppShadow.raised,
  });
  expect(getTabItemPresentation(false)).toEqual({
    backgroundColor: 'transparent',
    elevation: 0,
  });
});

test('reserves a minimum safe bottom while preserving tab content height', () => {
  expect(getTabBarLayout(0)).toEqual({
    height: 82,
    paddingBottom: 20,
  });
  expect(getTabBarLayout(34)).toEqual({
    height: 84,
    paddingBottom: 34,
  });
  expect(getTabBarLayout(60)).toEqual({
    height: 110,
    paddingBottom: 60,
  });
});
