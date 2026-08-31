export type ItemListFilter = 'all' | 'unboxed' | 'packed';

type FilterableItem = {
  name: string;
  originalLocation: string;
  destinationLocation: string;
  note: string;
  action: string;
  status: string;
  boxId: string | null;
};

export function filterItems<T extends FilterableItem>(
  items: readonly T[],
  query: string,
  filter: ItemListFilter,
): T[] {
  const keyword = query.trim().toLocaleLowerCase('zh-CN');

  return items.filter((item) => {
    const matchesQuery =
      keyword.length === 0 ||
      [item.name, item.originalLocation, item.destinationLocation, item.note]
        .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword));
    if (!matchesQuery) return false;

    if (filter === 'unboxed') {
      return item.action === '带走' && item.boxId === null;
    }
    if (filter === 'packed') {
      return item.action === '带走' && item.boxId !== null && item.status !== '待整理';
    }
    return true;
  });
}
