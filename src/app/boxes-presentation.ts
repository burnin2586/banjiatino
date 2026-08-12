// The Babel ESLint parser does not count type-only references as usage.
// eslint-disable-next-line no-unused-vars
import type { MovingBox } from '@/types/moving';

export function getMilestoneBoxId(
  boxes: readonly Pick<MovingBox, 'id' | 'status' | 'updatedAt'>[],
) {
  const pendingBoxes = boxes.filter((box) => box.status === '待整理');

  if (pendingBoxes.length === 0) {
    return null;
  }

  return pendingBoxes.reduce((latest, box) =>
    box.updatedAt > latest.updatedAt ? box : latest,
  ).id;
}
