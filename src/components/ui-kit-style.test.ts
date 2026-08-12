import { StyleSheet } from 'react-native';

import {
  AddButton,
  ChoiceChip,
  PrimaryButton,
  getChoiceChipLabel,
  getChoiceChipPalette,
  getPlasticShadow,
  getPressDepth,
  getStatusBadgePalette,
} from './ui-kit';

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

test('uses yellow only for an explicit milestone chip', () => {
  expect(getChoiceChipPalette(true, true)).toEqual({
    background: '#FFC928',
    text: '#17243A',
  });
  expect(getChoiceChipPalette(true, false)).toEqual({
    background: '#176BDB',
    text: '#FFFFFF',
  });
  expect(getChoiceChipPalette(false, true)).toEqual({
    background: '#FFFFFF',
    text: '#53657D',
  });
});

test('moves a pressed plastic control down two points', () => {
  expect(getPressDepth(false)).toEqual([{ translateY: 0 }]);
  expect(getPressDepth(true)).toEqual([{ translateY: 2 }]);
});

test('adds a visible check cue and exposes selected state to accessibility', () => {
  expect(getChoiceChipLabel('厨房', false)).toBe('厨房');
  expect(getChoiceChipLabel('厨房', true)).toBe('✓ 厨房');

  const chip = ChoiceChip({ label: '厨房', selected: true, onPress: jest.fn() });
  expect(chip.props.accessibilityState).toEqual({ selected: true });
  expect(chip.props.children.props.children).toBe('✓ 厨房');
});

test('shortens plastic shadows while primary and add controls are pressed', () => {
  expect(getPlasticShadow(true).shadowOffset.height).toBeLessThan(
    getPlasticShadow(false).shadowOffset.height,
  );
  expect(getPlasticShadow(true).shadowRadius).toBeLessThan(
    getPlasticShadow(false).shadowRadius,
  );

  const pressedState = { pressed: true };
  const primary = PrimaryButton({ label: '继续', onPress: jest.fn() });
  const add = AddButton({ label: '添加', onPress: jest.fn() });

  expect(StyleSheet.flatten(primary.props.style(pressedState))).toMatchObject({
    shadowOffset: { width: 0, height: 2 },
    transform: [{ translateY: 2 }],
  });
  expect(StyleSheet.flatten(add.props.style(pressedState))).toMatchObject({
    shadowOffset: { width: 0, height: 2 },
    transform: [{ translateY: 2 }],
  });
});

test('keeps repeated badge tones non-yellow and AA-safe', () => {
  const palettes = [
    getStatusBadgePalette('success'),
    getStatusBadgePalette('warning'),
    getStatusBadgePalette('accent'),
  ];

  expect(palettes).toEqual([
    { background: '#176BDB', text: '#FFFFFF' },
    { background: '#BFDFFF', text: '#17243A' },
    { background: '#FFFFFF', text: '#176BDB' },
  ]);
  palettes.forEach(({ background, text }) => {
    expect([background, text]).not.toContain('#FFC928');
    expect([background, text]).not.toContain('#FFF3BD');
    expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5);
  });
});
