import { getMilestoneBoxId } from './boxes-presentation';

test('chooses at most one pending box as the yellow focus', () => {
  expect(getMilestoneBoxId([
    { id: 'newer', status: '待整理', updatedAt: 2 },
    { id: 'older', status: '待整理', updatedAt: 1 },
  ])).toBe('newer');
});

test('has no yellow milestone when no box is pending', () => {
  expect(getMilestoneBoxId([{ id: 'box', status: '已装箱', updatedAt: 1 }])).toBeNull();
});
