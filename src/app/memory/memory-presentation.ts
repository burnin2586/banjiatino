export function getMemoryHomeState(houseCount: number) {
  return houseCount === 0 ? 'empty' : 'list';
}
