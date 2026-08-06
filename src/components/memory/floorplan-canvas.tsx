import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
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

const CANVAS = 320; // 画布逻辑尺寸（用于命中），实际铺满父容器

export function FloorplanCanvas({
  room,
  onAddPhoto,
  onPhotoPress,
  onWallAdd,
  onWallRemove,
}: Props) {
  const [mode, setMode] = useState<Mode>('edit');
  const [pendingStart, setPendingStart] = useState<{ x: number; y: number } | null>(null);

  function toGrid(sx: number, sy: number) {
    return snapPoint(sx, sy);
  }

  const tap = Gesture.Tap().onEnd((e) => {
    if (mode !== 'edit') return;
    const p = toGrid(e.x, e.y);
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
  });

  const longPress = Gesture.LongPress().onEnd((e) => {
    if (mode !== 'edit') return;
    const p = toGrid(e.x, e.y);
    const hit = room.walls.find((w) => nearWall(w, p));
    if (hit) {
      Alert.alert('删除这段墙？', '墙上的照片也会一起删除。', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => onWallRemove(hit.id) },
      ]);
    }
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <ModeChip label="编辑" active={mode === 'edit'} onPress={() => setMode('edit')} />
        <ModeChip label="查看" active={mode === 'view'} onPress={() => setMode('view')} />
        <Text style={styles.hint}>
          {mode === 'edit' ? '点两点画墙 · 长按墙删除 · 点墙可贴照片' : '只读浏览模式（切回编辑以修改）'}
        </Text>
      </View>

      <GestureHandlerRootView>
        <GestureDetector gesture={Gesture.Exclusive(longPress, tap)}>
          <View style={styles.canvas}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
              <Defs>
                <Pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                  <Circle cx={1} cy={1} r={1} fill={AppColors.border} />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width={CANVAS} height={CANVAS} fill="url(#grid)" />

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
                    <Rect x={cx - 14} y={cy - 14} width={28} height={28} rx={4} fill={AppColors.surface} stroke={AppColors.primary} strokeWidth={2} />
                    <SvgImage x={cx - 12} y={cy - 12} width={24} height={24} href={photo.imageUri} preserveAspectRatio="xMidYMid slice" />
                  </G>
                );
              })}
            </Svg>

            {room.walls.length === 0 ? (
              <View style={styles.emptyOverlay}>
                <Text style={styles.emptyText}>先点两点画出一段墙</Text>
                <Text style={styles.emptySub}>墙画好后就能往上面贴照片</Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>

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
  // 点到线段距离（网格单位），容差 1 格
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

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
  canvas: {
    height: CANVAS,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.border,
    overflow: 'hidden',
    justifyContent: 'center',
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
