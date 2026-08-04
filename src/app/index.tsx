import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  PageHeader,
  PrimaryButton,
  Screen,
  SectionTitle,
  StatusBadge,
  TextButton,
} from '@/components/ui-kit';
import { RoomManager } from '@/components/room-manager';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';

export default function HomeScreen() {
  const { state, isLoading, lookups, startFresh } = useMoving();
  const [roomManagerVisible, setRoomManagerVisible] = useState(false);
  const sourceRooms = lookups.sourceRooms;

  const summary = useMemo(() => {
    const movingItems = state.items.filter((item) => item.action === '带走');
    const total = movingItems.reduce((sum, item) => sum + item.quantity, 0);
    const packed = movingItems
      .filter((item) => item.status !== '待整理')
      .reduce((sum, item) => sum + item.quantity, 0);
    const arrived = movingItems
      .filter((item) => item.status === '已到达' || item.status === '已安置')
      .reduce((sum, item) => sum + item.quantity, 0);
    const settled = movingItems
      .filter((item) => item.status === '已安置')
      .reduce((sum, item) => sum + item.quantity, 0);
    const progress = total === 0 ? 0 : Math.round((arrived / total) * 100);

    return {
      total,
      packed,
      arrived,
      settled,
      progress,
      unboxed: movingItems.filter((item) => !item.boxId).length,
    };
  }, [state.items]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={AppColors.primary} size="large" />
        <Text style={styles.loadingText}>正在清点你的家…</Text>
      </View>
    );
  }

  return (
    <>
    <Screen>
      <PageHeader
        eyebrow="搬家作战台"
        title="一件不落地搬走"
        description="不用靠脑子记，让每件东西都有明确去向。"
      />

      {state.items.some((item) => item.id.startsWith('item-')) &&
      state.boxes.some((box) => box.id.startsWith('box-00')) ? (
        <Card style={styles.demoCard}>
          <View style={styles.demoText}>
            <Text style={styles.demoTitle}>这里放了一组示例数据</Text>
            <Text style={styles.demoDescription}>
              先随便点点看；准备正式记录时，可以一键清空箱子和物品。
            </Text>
          </View>
          <PrimaryButton
            compact
            label="开始我的搬家"
            onPress={() =>
              Alert.alert('清空示例数据？', '箱子和物品会被清空，四个默认房间会保留。', [
                { text: '取消', style: 'cancel' },
                { text: '确认清空', style: 'destructive', onPress: startFresh },
              ])
            }
          />
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressLabel}>到达新家进度</Text>
            <Text style={styles.progressValue}>{summary.progress}%</Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressCircleValue}>
              {summary.arrived}/{summary.total}
            </Text>
            <Text style={styles.progressCircleLabel}>已到达</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${summary.progress}%` }]} />
        </View>
        <View style={styles.metricRow}>
          <Metric value={summary.total} label="计划带走" />
          <Metric value={summary.packed} label="已经装箱" />
          <Metric value={summary.settled} label="完成安置" />
        </View>
      </Card>

      {summary.unboxed > 0 ? (
        <Card style={styles.alertCard}>
          <View style={styles.alertIcon}>
            <Text style={styles.alertEmoji}>!</Text>
          </View>
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>{summary.unboxed} 类物品还没有箱子</Text>
            <Text style={styles.alertDescription}>去“物品”页继续整理，避免搬家时遗漏。</Text>
          </View>
        </Card>
      ) : null}

      <View>
        <View style={styles.sectionActions}>
          <SectionTitle title="按旧家房间整理" detail={`${sourceRooms.length} 个区域`} />
          <TextButton label="管理房间" onPress={() => setRoomManagerVisible(true)} />
        </View>
        <View style={styles.roomGrid}>
          {sourceRooms.map((room) => {
            const boxes = state.boxes.filter((box) => box.sourceRoomId === room.id);
            const itemCount = boxes.reduce(
              (sum, box) => sum + (lookups.itemsByBox.get(box.id)?.length ?? 0),
              0,
            );

            return (
              <Card key={room.id} style={styles.roomCard}>
                <View style={[styles.roomDot, { backgroundColor: room.color }]} />
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomCount}>
                  {boxes.length} 箱 · {itemCount} 类物品
                </Text>
              </Card>
            );
          })}
        </View>
      </View>

      <View>
        <SectionTitle title="最近的箱子" detail="继续上次进度" />
        <View style={styles.listGap}>
          {state.boxes.slice(0, 3).map((box) => {
            const sourceRoom = lookups.roomById.get(box.sourceRoomId);
            const destinationRoom = lookups.roomById.get(box.destinationRoomId);
            const itemCount = lookups.itemsByBox.get(box.id)?.length ?? 0;
            const done = box.status === '已到达' || box.status === '已拆箱';
            return (
              <Card key={box.id} style={styles.boxRow}>
                <View style={styles.boxIcon}>
                  <Text style={styles.boxEmoji}>□</Text>
                </View>
                <View style={styles.boxText}>
                  <Text style={styles.boxCode}>{box.code}</Text>
                  <Text style={styles.boxName}>{box.name}</Text>
                  <Text style={styles.boxMeta}>
                    {sourceRoom?.name ?? '未分区'} → {destinationRoom?.name ?? '未设置'} ·{' '}
                    {itemCount} 类
                  </Text>
                </View>
                <StatusBadge
                  label={box.status}
                  tone={done ? 'success' : box.status === '待整理' ? 'warning' : 'neutral'}
                />
              </Card>
            );
          })}
        </View>
      </View>
    </Screen>
    <RoomManager visible={roomManagerVisible} onClose={() => setRoomManagerVisible(false)} />
    </>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  heroCard: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
    padding: AppSpacing.xl,
    gap: AppSpacing.lg,
  },
  demoCard: {
    gap: AppSpacing.md,
  },
  demoText: {
    gap: 3,
  },
  demoTitle: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  demoDescription: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#D8E8DE',
    fontSize: 14,
    fontWeight: '600',
  },
  progressValue: {
    color: AppColors.white,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  progressCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleValue: {
    color: AppColors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  progressCircleLabel: {
    color: '#D8E8DE',
    fontSize: 10,
    marginTop: 1,
  },
  progressTrack: {
    height: 8,
    borderRadius: AppRadius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    borderRadius: AppRadius.pill,
    backgroundColor: '#F0B17E',
  },
  metricRow: {
    flexDirection: 'row',
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  metricValue: {
    color: AppColors.white,
    fontSize: 21,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#D8E8DE',
    fontSize: 11,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
    backgroundColor: AppColors.accentSoft,
    borderColor: '#EEC9B2',
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.accent,
  },
  alertEmoji: {
    color: AppColors.white,
    fontWeight: '900',
    fontSize: 17,
  },
  alertText: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  alertDescription: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.md,
  },
  sectionActions: {
    marginBottom: AppSpacing.md,
  },
  roomCard: {
    width: '47.8%',
    minHeight: 116,
    justifyContent: 'center',
  },
  roomDot: {
    width: 28,
    height: 7,
    borderRadius: AppRadius.pill,
    marginBottom: AppSpacing.md,
  },
  roomName: {
    color: AppColors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  roomCount: {
    color: AppColors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  listGap: {
    gap: AppSpacing.md,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  boxIcon: {
    width: 44,
    height: 44,
    borderRadius: AppRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  boxEmoji: {
    color: AppColors.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  boxText: {
    flex: 1,
    gap: 1,
  },
  boxCode: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  boxName: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  boxMeta: {
    color: AppColors.textMuted,
    fontSize: 11,
  },
});
