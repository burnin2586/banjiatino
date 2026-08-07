import { Image } from 'expo-image';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors, AppSpacing } from '@/constants/app-theme';
import { denormalizeRect, isValidMarkerSize, normalizeRect, type ScreenRect } from '@/logic/storage-marker';
import type { MarkerRect, MovingBox, StoragePhoto } from '@/types/moving';

type Props = {
  photo: StoragePhoto;
  boxes: MovingBox[];
  mode: 'edit' | 'view';
  onMarkerCreate: (rect: MarkerRect) => void;
  onMarkerPress: (boxId: string) => void;
};

export function PhotoMarkerCanvas({ photo, boxes, mode, onMarkerCreate, onMarkerPress }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<ScreenRect | null>(null);
  const [start, setStart] = useState({ x: 0, y: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  function pressIn(e: any) {
    if (mode !== 'edit') return;
    const { locationX, locationY } = e.nativeEvent;
    setStart({ x: locationX, y: locationY });
    setDraft({ x: locationX, y: locationY, w: 0, h: 0 });
  }
  function pressMove(e: any) {
    if (mode !== 'edit' || !draft) return;
    const { locationX, locationY } = e.nativeEvent;
    setDraft({
      x: Math.min(start.x, locationX),
      y: Math.min(start.y, locationY),
      w: Math.abs(locationX - start.x),
      h: Math.abs(locationY - start.y),
    });
  }
  function pressEnd() {
    if (mode !== 'edit' || !draft) return;
    if (size.width > 0 && size.height > 0) {
      const rect = normalizeRect(draft, size);
      if (isValidMarkerSize(rect)) onMarkerCreate(rect);
    }
    setDraft(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.frame} onLayout={onLayout}>
        <Image source={photo.imageUri} style={StyleSheet.absoluteFill} contentFit="contain" />
        {/* onPressMove exists on Pressable at runtime but is missing from
            PressableProps types in this RN version, so cast the prop. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={pressIn}
          {...{ onPressMove: pressMove } as Record<string, unknown>}
          onPress={pressEnd}
        >
          {boxes.map((b) => {
            if (!b.markerRect || size.width === 0) return null;
            const s = denormalizeRect(b.markerRect, size);
            return (
              <Pressable
                key={b.id}
                onPress={() => onMarkerPress(b.id)}
                style={[
                  styles.marker,
                  { left: s.x, top: s.y, width: s.w, height: s.h },
                ]}
              >
                <Text style={styles.markerLabel} numberOfLines={1}>
                  {b.code} {b.name}
                </Text>
              </Pressable>
            );
          })}
          {draft ? (
            <View
              style={[
                styles.draft,
                { left: draft.x, top: draft.y, width: draft.w, height: draft.h },
              ]}
            />
          ) : null}
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {mode === 'edit' ? '在照片上拖拽画一个框 = 新建箱子' : '点框看里面的物品'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: AppSpacing.sm },
  frame: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: AppColors.surfaceMuted,
    borderRadius: 12,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: AppColors.primary,
    backgroundColor: 'rgba(47,107,79,0.12)',
    borderRadius: 4,
    padding: 2,
    justifyContent: 'flex-end',
  },
  markerLabel: {
    color: AppColors.primary,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 3,
    alignSelf: 'flex-start',
    borderRadius: 3,
    overflow: 'hidden',
  },
  draft: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: AppColors.accent,
    backgroundColor: 'rgba(217,122,71,0.12)',
  },
  hint: { color: AppColors.textMuted, fontSize: 12 },
});
