import { AppColors } from '@/constants/app-theme';

export const homeHeroPalette = {
  background: AppColors.primary,
  circleLabel: AppColors.white,
};

export function getHomeMilestone(unboxed: number) {
  return unboxed > 0 ? 'unboxed-warning' : null;
}
