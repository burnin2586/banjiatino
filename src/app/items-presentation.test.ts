import { filterItems, type ItemListFilter } from './items-presentation';

const items = [
  { id: 'camera', name: '相机', originalLocation: '书桌', destinationLocation: '', note: '', action: '带走', status: '已装箱', boxId: 'box-1' },
  { id: 'tripod', name: '三脚架', originalLocation: '门后', destinationLocation: '', note: '', action: '带走', status: '待整理', boxId: null },
  { id: 'chair', name: '旧椅子', originalLocation: '客厅', destinationLocation: '', note: '处理', action: '舍弃', status: '待整理', boxId: null },
] as const;

test('filters item rows by a normalized keyword', () => {
  expect(filterItems(items, ' 书桌 ', 'all').map((item) => item.id)).toEqual(['camera']);
});

test.each<[ItemListFilter, string[]]>([
  ['all', ['camera', 'tripod', 'chair']],
  ['unboxed', ['tripod']],
  ['packed', ['camera']],
])('applies the %s item filter without changing order', (filter, expected) => {
  expect(filterItems(items, '', filter).map((item) => item.id)).toEqual(expected);
});
