import { getHomeMilestone, homeHeroPalette } from './home-presentation';

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test('shows the single warning milestone only when items are unboxed', () => {
  expect(getHomeMilestone(1)).toBe('unboxed-warning');
  expect(getHomeMilestone(0)).toBeNull();
});

test('keeps the small arrival label at AA contrast on the hero', () => {
  expect(contrastRatio(homeHeroPalette.circleLabel, homeHeroPalette.background))
    .toBeGreaterThanOrEqual(4.5);
});
