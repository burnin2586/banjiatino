import { getMemoryHomeState } from './memory-presentation';

test('uses the approved empty state only when there are no houses', () => {
  expect(getMemoryHomeState(0)).toBe('empty');
  expect(getMemoryHomeState(1)).toBe('list');
});
