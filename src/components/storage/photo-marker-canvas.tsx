import { useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  Image,
  type ImageLoadEventData,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppColors, AppSpacing } from '@/constants/app-theme';
import { denormalizeRect, isValidMarkerSize, normalizeRect, type ScreenRect } from '@/logic/storage-marker';
import type { MarkerRect, MovingBox, StoragePhoto } from '@/types/moving';

type Props = {
  photo: StoragePhoto;
  boxes: MovingBox[];
  mode: 'edit' | 'view';
  onMarkerCreate: (rect: MarkerRect) => void;
  onMarkerPress: (boxId: string) => void;
  maxSize?: { width: number; height: number };
};

export function PhotoMarkerCanvas({ photo, boxes, mode, onMarkerCreate, onMarkerPress, maxSize }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const [draft, setDraft] = useState<ScreenRect | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const draftRef = useRef<ScreenRect | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  function imageLoaded(event: NativeSyntheticEvent<ImageLoadEventData>) {
    const { width, height } = event.nativeEvent.source;
    if (width > 0 && height > 0) setImageAspectRatio(width / height);
  }

  function touchStart(e: GestureResponderEvent) {
    if (mode !== 'edit') return;
    const { locationX, locationY } = e.nativeEvent;
    const nextDraft = { x: locationX, y: locationY, w: 0, h: 0 };
    startRef.current = { x: locationX, y: locationY };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function touchMove(e: GestureResponderEvent) {
    if (mode !== 'edit' || !draftRef.current) return;
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.min(size.width, Math.max(0, locationX));
    const y = Math.min(size.height, Math.max(0, locationY));
    const nextDraft = {
      x: Math.min(startRef.current.x, x),
      y: Math.min(startRef.current.y, y),
      w: Math.abs(x - startRef.current.x),
      h: Math.abs(y - startRef.current.y),
    };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function touchEnd() {
    const completedDraft = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (mode !== 'edit' || !completedDraft) return;
    if (size.width > 0 && size.height > 0) {
      const rect = normalizeRect(completedDraft, size);
      if (isValidMarkerSize(rect)) onMarkerCreate(rect);
    }
  }

  function touchCancel() {
    draftRef.current = null;
    setDraft(null);
  }

  let frameSize: ViewStyle = { width: '100%', aspectRatio: imageAspectRatio };
  if (maxSize && maxSize.width > 0 && maxSize.height > 0) {
    let width = maxSize.width;
    let height = width / imageAspectRatio;
    if (height > maxSize.height) {
      height = maxSize.height;
      width = height * imageAspectRatio;
    }
    frameSize = { width, height };
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, frameSize]} onLayout={onLayout}>
        <Image
          source={{ uri: photo.imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoad={imageLoaded}
        />
        <View
          style={StyleSheet.absoluteFill}
          onTouchStart={touchStart}
          onTouchMove={touchMove}
          onTouchEnd={touchEnd}
          onTouchCancel={touchCancel}
        >
          {boxes.map((b) => {
            if (!b.markerRect || size.width === 0) return null;
            const s = denormalizeRect(b.markerRect, size);
            return (
              <Pressable
                key={b.id}
                onPress={() => onMarkerPress(b.id)}
                onTouchStart={(event) => event.stopPropagation()}
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
        </View>
      </View>
      <Text style={styles.hint}>
        {mode === 'edit' ? '在照片上拖拽画一个框 = 新建箱子' : '点框看里面的物品'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: AppSpacing.sm },
  frame: {
    width: '100%',
    backgroundColor: AppColors.surfaceMuted,
    borderRadius: 12,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: AppColors.primary,
    backgroundColor: `${AppColors.primary}1F`,
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
    backgroundColor: `${AppColors.accent}1F`,
  },
  hint: { alignSelf: 'stretch', color: AppColors.textMuted, fontSize: 12 },
});
