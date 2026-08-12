# Shared UI components

Framework: React Native 0.81 with React 19, using the React Native Community CLI. Navigation is React Navigation 7. Styling is a custom `StyleSheet`-based UI kit; there is no third-party component library, CSS framework, or web CSS layer.

## `UI kit primitives`

- File: `src/components/ui-kit.tsx`
- Description: Shared screen, loading, header, section, card, button, badge, chip, empty-state, and modal primitives used throughout the app.
- Key props: `Screen.scroll`; labels/titles/subtitles; press handlers; `StatusBadge.status`; `ChoiceChip.selected`; `ModalSheet.visible/onClose`; optional children and styles as declared in source.

```tsx
import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';

export function Screen({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {content}
    </SafeAreaView>
  );
}

export function LoadingScreen({ label = '正在清点你的家…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={AppColors.primary} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionTitle({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        compact && styles.primaryButtonCompact,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
      <Text style={[styles.textButtonLabel, tone === 'danger' && styles.textButtonDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
      <Text style={styles.addButtonIcon}>＋</Text>
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'accent';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
        tone === 'accent' && styles.badgeAccent,
      ]}>
      <Text
        style={[
          styles.badgeText,
          tone === 'success' && styles.badgeSuccessText,
          tone === 'warning' && styles.badgeWarningText,
          tone === 'accent' && styles.badgeAccentText,
        ]}>
        {label}
      </Text>
    </View>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </Card>
  );
}

export function ModalSheet({
  visible,
  title,
  children,
  onClose,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeButton}>完成</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: AppSpacing.lg,
    paddingTop: AppSpacing.md,
    paddingBottom: 120,
    gap: AppSpacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.md,
    backgroundColor: AppColors.background,
  },
  loadingText: {
    color: AppColors.textMuted,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.md,
  },
  headerText: {
    flex: 1,
    gap: AppSpacing.xs,
  },
  eyebrow: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pageTitle: {
    color: AppColors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  description: {
    color: AppColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: AppSpacing.md,
  },
  sectionTitle: {
    color: AppColors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  sectionDetail: {
    color: AppColors.textMuted,
    fontSize: 13,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.border,
    padding: AppSpacing.lg,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: AppRadius.md,
    borderCurve: 'continuous',
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.lg,
  },
  primaryButtonCompact: {
    minHeight: 36,
    borderRadius: AppRadius.sm,
    paddingHorizontal: AppSpacing.md,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  textButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.sm,
  },
  textButtonLabel: {
    color: AppColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  textButtonDanger: {
    color: '#B4483D',
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    color: AppColors.white,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 31,
  },
  pressed: {
    opacity: 0.72,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: AppColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeSuccess: {
    backgroundColor: AppColors.primarySoft,
  },
  badgeSuccessText: {
    color: AppColors.success,
  },
  badgeWarning: {
    backgroundColor: '#F8E9D6',
  },
  badgeWarningText: {
    color: AppColors.warning,
  },
  badgeAccent: {
    backgroundColor: AppColors.accentSoft,
  },
  badgeAccentText: {
    color: AppColors.accent,
  },
  chip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.surface,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 9,
  },
  chipSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primarySoft,
  },
  chipText: {
    color: AppColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: AppColors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: AppSpacing.xxl,
    gap: AppSpacing.sm,
  },
  emptyIcon: {
    fontSize: 34,
  },
  emptyTitle: {
    color: AppColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyDescription: {
    color: AppColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.lg,
  },
  modalTitle: {
    color: AppColors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalContent: {
    padding: AppSpacing.lg,
    paddingBottom: 60,
    gap: AppSpacing.lg,
  },
});
```

## `PhotoMarkerCanvas`

- File: `src/components/storage/photo-marker-canvas.tsx`
- Description: Interactive storage-photo canvas for drawing normalized box markers and opening linked boxes.
- Key props: `photo`, `boxes`, `mode`, `onMarkerCreate`, `onMarkerPress`, optional `maxSize`.

```tsx
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
  hint: { alignSelf: 'stretch', color: AppColors.textMuted, fontSize: 12 },
});
```

## `FloorplanCanvas`

- File: `src/components/memory/floorplan-canvas.tsx`
- Description: Interactive SVG floor-plan editor/viewer for room walls and wall-mounted photos.
- Key props: `room`, `onAddPhoto`, `onPhotoPress`, `onWallAdd`, `onWallRemove`.

```tsx
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Image as SvgImage, Line, Pattern, Rect } from 'react-native-svg';

import { AppColors, AppSpacing } from '@/constants/app-theme';
import { GRID_SIZE, pointOnWall, snapPoint } from '@/logic/memory';
import type { MemoryRoom, RoomPhoto, Wall } from '@/types/memory';

type Mode = 'edit' | 'view';

type Props = {
  room: MemoryRoom;
  onAddPhoto: (wallId: string) => void;
  onPhotoPress: (photo: RoomPhoto) => void;
  onWallAdd: (wall: Wall) => void;
  onWallRemove: (wallId: string) => void;
};

const CANVAS = 320;

export function FloorplanCanvas({
  room,
  onAddPhoto,
  onPhotoPress,
  onWallAdd,
  onWallRemove,
}: Props) {
  const [mode, setMode] = useState<Mode>('edit');
  const [pendingStart, setPendingStart] = useState<{ x: number; y: number } | null>(null);

  function pointFromEvent(e: { nativeEvent: { locationX: number; locationY: number } }) {
    return snapPoint(e.nativeEvent.locationX, e.nativeEvent.locationY);
  }

  function handlePress(e: { nativeEvent: { locationX: number; locationY: number } }) {
    if (mode !== 'edit') return;
    const p = pointFromEvent(e);
    if (!pendingStart) {
      setPendingStart(p);
      return;
    }
    if (p.x === pendingStart.x && p.y === pendingStart.y) {
      setPendingStart(null);
      return;
    }
    onWallAdd({
      id: `wall-${Date.now()}`,
      x1: pendingStart.x,
      y1: pendingStart.y,
      x2: p.x,
      y2: p.y,
    });
    setPendingStart(null);
  }

  function handleLongPress(e: { nativeEvent: { locationX: number; locationY: number } }) {
    if (mode !== 'edit') return;
    const p = pointFromEvent(e);
    const hit = room.walls.find((w) => nearWall(w, p));
    if (hit) {
      Alert.alert('删除这段墙？', '墙上的照片也会一起删除。', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => onWallRemove(hit.id) },
      ]);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <ModeChip label="编辑" active={mode === 'edit'} onPress={() => setMode('edit')} />
        <ModeChip label="查看" active={mode === 'view'} onPress={() => setMode('view')} />
        <Text style={styles.hint}>
          {mode === 'edit' ? '点两点画墙 · 长按墙删除' : '只读浏览模式（切回编辑以修改）'}
        </Text>
      </View>

      <View style={styles.canvasOuter}>
        <Pressable onPress={handlePress} onLongPress={handleLongPress} style={styles.canvas}>
          <Svg width={CANVAS} height={CANVAS} viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
            <Defs>
              <Pattern id="mem-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <Circle cx={1} cy={1} r={1} fill={AppColors.border} />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={CANVAS} height={CANVAS} fill="url(#mem-grid)" />

            {pendingStart ? (
              <Circle
                cx={pendingStart.x * GRID_SIZE}
                cy={pendingStart.y * GRID_SIZE}
                r={6}
                fill={AppColors.accent}
              />
            ) : null}

            {room.walls.map((w) => (
              <G key={w.id}>
                <Line
                  x1={w.x1 * GRID_SIZE}
                  y1={w.y1 * GRID_SIZE}
                  x2={w.x2 * GRID_SIZE}
                  y2={w.y2 * GRID_SIZE}
                  stroke={AppColors.text}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
                <Circle cx={w.x1 * GRID_SIZE} cy={w.y1 * GRID_SIZE} r={4} fill={AppColors.text} />
                <Circle cx={w.x2 * GRID_SIZE} cy={w.y2 * GRID_SIZE} r={4} fill={AppColors.text} />
              </G>
            ))}

            {room.photos.map((photo) => {
              const wall = room.walls.find((w) => w.id === photo.wallId);
              if (!wall) return null;
              const p = pointOnWall(wall, photo.t);
              const cx = p.x * GRID_SIZE;
              const cy = p.y * GRID_SIZE;
              return (
                <G key={photo.id} onPress={() => onPhotoPress(photo)}>
                  <Rect
                    x={cx - 14}
                    y={cy - 14}
                    width={28}
                    height={28}
                    rx={4}
                    fill={AppColors.surface}
                    stroke={AppColors.primary}
                    strokeWidth={2}
                  />
                  <SvgImage
                    x={cx - 12}
                    y={cy - 12}
                    width={24}
                    height={24}
                    href={photo.imageUri}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </G>
              );
            })}
          </Svg>
        </Pressable>

        {room.walls.length === 0 ? (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Text style={styles.emptyText}>先点两点画出一段墙</Text>
            <Text style={styles.emptySub}>墙画好后就能往上面贴照片</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.wallList}>
        {room.walls.map((w) => (
          <Pressable
            key={w.id}
            style={styles.wallChip}
            onPress={() =>
              mode === 'edit'
                ? Alert.alert('给这段墙贴照片？', undefined, [
                    { text: '取消', style: 'cancel' },
                    { text: '选照片', onPress: () => onAddPhoto(w.id) },
                  ])
                : null
            }
          >
            <Text style={styles.wallChipText}>
              墙 · {w.x1},{w.y1} → {w.x2},{w.y2}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function nearWall(w: Wall, p: { x: number; y: number }): boolean {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - w.x1, p.y - w.y1) <= 1;
  let t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  const cx = w.x1 + t * dx;
  const cy = w.y1 + t * dy;
  return Math.hypot(p.x - cx, p.y - cy) <= 1;
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeChip, active && styles.modeChipActive]}
      hitSlop={6}
    >
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: AppSpacing.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  hint: { color: AppColors.textMuted, fontSize: 12, flex: 1, flexWrap: 'wrap' },
  canvasOuter: { alignItems: 'center' },
  canvas: {
    width: CANVAS,
    height: CANVAS,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  emptyOverlay: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 4 },
  emptyText: { color: AppColors.textMuted, fontSize: 15, fontWeight: '700' },
  emptySub: { color: AppColors.textMuted, fontSize: 12 },
  wallList: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  wallChip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: AppColors.surface,
  },
  wallChipText: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
  modeChip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: AppColors.surface,
  },
  modeChipActive: { borderColor: AppColors.primary, backgroundColor: AppColors.primarySoft },
  modeChipText: { color: AppColors.textMuted, fontSize: 13, fontWeight: '700' },
  modeChipTextActive: { color: AppColors.primary },
});
```

## `RoomManager`

- File: `src/components/room-manager.tsx`
- Description: Reusable modal workflow for creating, editing, and deleting source/destination rooms.
- Key props: `visible: boolean`, `onClose: () => void`.

```tsx
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Card,
  ChoiceChip,
  ModalSheet,
  PrimaryButton,
  SectionTitle,
  TextButton,
} from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import type { Room, RoomKind } from '@/types/moving';

const ROOM_COLORS = ['#D8CBE8', '#BFDCCB', '#F0CF9F', '#BCD7E8', '#F3B9B1', '#D8D1BC'];

export function RoomManager({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, addRoom, updateRoom, deleteRoom } = useMoving();
  const [kind, setKind] = useState<RoomKind>('source');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(ROOM_COLORS[0]);

  const rooms = useMemo(
    () => state.rooms.filter((room) => room.kind === kind).sort((a, b) => a.order - b.order),
    [kind, state.rooms],
  );

  function resetForm() {
    setEditingRoomId(null);
    setName('');
    setColor(ROOM_COLORS[0]);
  }

  function switchKind(nextKind: RoomKind) {
    setKind(nextKind);
    resetForm();
  }

  function editRoom(room: Room) {
    setEditingRoomId(room.id);
    setName(room.name);
    setColor(room.color);
  }

  function saveRoom() {
    if (!name.trim()) {
      Alert.alert('还差一步', '请填写房间名称。');
      return;
    }
    const duplicate = state.rooms.some(
      (room) =>
        room.kind === kind &&
        room.id !== editingRoomId &&
        room.name.trim().toLocaleLowerCase('zh-CN') === name.trim().toLocaleLowerCase('zh-CN'),
    );
    if (duplicate) {
      Alert.alert('房间已经存在', '同一套房子里不能有两个完全相同的房间名称。');
      return;
    }

    if (editingRoomId) {
      updateRoom(editingRoomId, { name, color });
    } else {
      addRoom({ name, color, kind });
    }
    resetForm();
  }

  function confirmDelete(room: Room) {
    if (rooms.length <= 1) {
      Alert.alert('至少保留一个房间', '旧家和新家都必须至少有一个可选择的房间。');
      return;
    }
    Alert.alert('删除这个房间？', `确认删除“${room.name}”？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: () => {
          if (!deleteRoom(room.id)) {
            Alert.alert('暂时不能删除', '仍有箱子正在使用这个房间，请先修改相关箱子。');
          }
          if (editingRoomId === room.id) resetForm();
        },
      },
    ]);
  }

  return (
    <ModalSheet visible={visible} title="管理房间" onClose={onClose}>
      <View style={styles.kindSelector}>
        <ChoiceChip label="旧家房间" selected={kind === 'source'} onPress={() => switchKind('source')} />
        <ChoiceChip
          label="新家房间"
          selected={kind === 'destination'}
          onPress={() => switchKind('destination')}
        />
      </View>

      <View>
        <SectionTitle
          title={kind === 'source' ? '从哪里搬出' : '搬到哪里'}
          detail={`${rooms.length} 个房间`}
        />
        <View style={styles.roomList}>
          {rooms.map((room) => {
            const boxCount = state.boxes.filter((box) =>
              kind === 'source'
                ? box.sourceRoomId === room.id
                : box.destinationRoomId === room.id,
            ).length;
            return (
              <Card key={room.id} style={styles.roomRow}>
                <View style={[styles.roomColor, { backgroundColor: room.color }]} />
                <View style={styles.roomText}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomMeta}>{boxCount} 个箱子使用中</Text>
                </View>
                <TextButton label="编辑" onPress={() => editRoom(room)} />
                <TextButton label="删除" tone="danger" onPress={() => confirmDelete(room)} />
              </Card>
            );
          })}
        </View>
      </View>

      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>{editingRoomId ? '编辑房间' : '新增房间'}</Text>
        <TextInput
          placeholder={kind === 'source' ? '例如：储物间' : '例如：儿童房'}
          placeholderTextColor={AppColors.textMuted}
          style={styles.input}
          value={name}
          onChangeText={setName}
        />
        <View style={styles.colorRow}>
          {ROOM_COLORS.map((entry) => (
            <Pressable
              accessibilityLabel={`选择颜色 ${entry}`}
              accessibilityRole="button"
              key={entry}
              onPress={() => setColor(entry)}
              style={[
                styles.colorChoice,
                { backgroundColor: entry },
                entry === color && styles.colorChoiceSelected,
              ]}>
              {entry === color ? <Text style={styles.colorCheck}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
        <PrimaryButton label={editingRoomId ? '保存房间' : '新增房间'} onPress={saveRoom} />
        {editingRoomId ? <TextButton label="取消编辑" onPress={resetForm} /> : null}
      </Card>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  kindSelector: { flexDirection: 'row', gap: AppSpacing.sm },
  roomList: { gap: AppSpacing.sm },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    paddingVertical: AppSpacing.md,
  },
  roomColor: { width: 10, height: 38, borderRadius: AppRadius.pill, marginRight: AppSpacing.sm },
  roomText: { flex: 1, gap: 2 },
  roomName: { color: AppColors.text, fontSize: 16, fontWeight: '700' },
  roomMeta: { color: AppColors.textMuted, fontSize: 11 },
  formCard: { gap: AppSpacing.md },
  formTitle: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: AppRadius.md,
    backgroundColor: AppColors.surface,
    color: AppColors.text,
    fontSize: 16,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 12,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  colorChoice: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorChoiceSelected: { borderColor: AppColors.primary },
  colorCheck: { color: AppColors.text, fontSize: 17, fontWeight: '900' },
});
```
