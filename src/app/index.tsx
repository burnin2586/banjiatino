import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formatBoxCode } from '@/types/moving';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Card,
  ModalSheet,
  PageHeader,
  PrimaryButton,
  Screen,
  SectionTitle,
  StatusBadge,
  TextButton,
} from '@/components/ui-kit';
import { InviteFamilyCard } from '@/components/invite-family-card';
import { SyncBanner } from '@/components/sync-banner';
import { RoomManager } from '@/components/room-manager';
import { DateWheel } from '@/components/date-wheel';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import { computeCountdown, computeSuggestedDate, nextPendingTask } from '@/logic/task-timeline';
import type { RootStackParamList } from '@/navigation/types';

import { getHomeMilestone, homeHeroPalette } from './home-presentation';
import { formatSuggestedDate } from './task-timeline-presentation';

export default function HomeScreen() {
  const {
    state,
    isLoading,
    lookups,
    startFresh,
    setMovingDate,
    importTaskPresets,
  } = useMoving();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [roomManagerVisible, setRoomManagerVisible] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const sourceRooms = lookups.sourceRooms;
  const movingDate = state.movingDate;
  const tasks = state.tasks;

  const countdown = movingDate ? computeCountdown(movingDate, Date.now()) : null;
  const nextTask = nextPendingTask(tasks, movingDate);
  const nextSuggested = nextTask ? computeSuggestedDate(movingDate, nextTask.dueOffsetDays) : null;

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

      <SyncBanner />
      <InviteFamilyCard />

      {movingDate === null ? (
        <Card style={styles.countdownCard}>
          <View style={styles.countdownCopy}>
            <Text style={styles.countdownTitle}>设置搬家日，开始倒计时</Text>
            <Text style={styles.countdownDesc}>设个日子，App 会告诉你现在该做什么。</Text>
          </View>
          <View style={styles.countdownActions}>
            <PrimaryButton compact label="设置搬家日" onPress={() => setPickingDate(true)} />
            <TextButton label="一键导入任务" onPress={importTaskPresets} />
          </View>
        </Card>
      ) : (
        <Pressable onPress={() => nav.navigate('TaskTimeline')}>
          <Card style={[styles.countdownCard, styles.countdownCardActive]}>
            <Text style={styles.countdownEyebrow}>搬家节奏</Text>
            <Text style={styles.countdownBig}>{countdown?.label}</Text>
            <Text style={styles.countdownSub}>
              {nextTask
                ? `下一个任务：${nextTask.title}（建议 ${formatSuggestedDate(nextSuggested)}）`
                : '所有任务已完成 🎉'}
            </Text>
          </Card>
        </Pressable>
      )}

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
          <View style={styles.progressCopy}>
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
        <View style={styles.metricTray}>
          <View style={styles.metricRow}>
            <Metric value={summary.total} label="计划带走" />
            <Metric value={summary.packed} label="已经装箱" />
            <Metric value={summary.settled} label="完成安置" />
          </View>
        </View>
      </Card>

      {getHomeMilestone(summary.unboxed) ? (
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
                  <Text style={styles.boxCode}>{formatBoxCode(box)}</Text>
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
    <ModalSheet title="设置搬家日" visible={pickingDate} onClose={() => setPickingDate(false)}>
      <DateWheel value={movingDate ?? Date.now()} onChange={(ts) => setMovingDate(ts)} />
    </ModalSheet>
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
  countdownCard: {
    gap: AppSpacing.md,
    padding: AppSpacing.lg,
  },
  countdownCardActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
    borderRadius: AppRadius.page,
    padding: AppSpacing.xl,
    gap: AppSpacing.xs,
  },
  countdownCopy: {
    gap: AppSpacing.xs,
  },
  countdownTitle: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  countdownDesc: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  countdownActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppSpacing.md,
  },
  countdownEyebrow: {
    color: AppColors.primarySoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  countdownBig: {
    color: AppColors.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  countdownSub: {
    color: AppColors.primarySoft,
    fontSize: 12,
    lineHeight: 18,
  },
  heroCard: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
    borderRadius: AppRadius.page,
    padding: AppSpacing.xl,
    gap: AppSpacing.xl,
  },
  demoCard: {
    gap: AppSpacing.lg,
    padding: AppSpacing.lg,
  },
  demoText: {
    gap: AppSpacing.xs,
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
    alignItems: 'flex-start',
    gap: AppSpacing.lg,
  },
  progressCopy: {
    flex: 1,
    minWidth: 0,
  },
  progressLabel: {
    color: AppColors.primarySoft,
    fontSize: 14,
    fontWeight: '700',
  },
  progressValue: {
    color: AppColors.white,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 64,
  },
  progressCircle: {
    width: 84,
    minHeight: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: AppColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: AppSpacing.xs,
    flexShrink: 0,
  },
  progressCircleValue: {
    color: AppColors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  progressCircleLabel: {
    color: homeHeroPalette.circleLabel,
    fontSize: 10,
    marginTop: 1,
  },
  progressTrack: {
    height: 20,
    borderRadius: AppRadius.pill,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(23,36,58,0.18)',
    backgroundColor: 'rgba(23,36,58,0.24)',
    padding: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.primarySoft,
  },
  metricTray: {
    paddingVertical: AppSpacing.md,
    paddingHorizontal: AppSpacing.lg,
    borderRadius: AppRadius.control,
    backgroundColor: 'rgba(23,36,58,0.24)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.24)',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.md,
  },
  metric: {
    flex: 1,
    flexBasis: 72,
    gap: 2,
  },
  metricValue: {
    color: AppColors.white,
    fontSize: 21,
    fontWeight: '800',
  },
  metricLabel: {
    color: AppColors.primarySoft,
    fontSize: 11,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
    backgroundColor: AppColors.surface,
    borderColor: AppColors.border,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.accent,
    borderWidth: 1,
    borderColor: AppColors.text,
    flexShrink: 0,
  },
  alertEmoji: {
    color: AppColors.text,
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
    minHeight: 124,
    justifyContent: 'center',
    paddingVertical: AppSpacing.xl,
  },
  roomDot: {
    width: 30,
    height: 6,
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
    minHeight: 76,
  },
  boxIcon: {
    width: 44,
    height: 44,
    borderRadius: AppRadius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primarySoft,
    borderWidth: 1,
    borderColor: AppColors.primary,
    flexShrink: 0,
  },
  boxEmoji: {
    color: AppColors.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  boxText: {
    flex: 1,
    minWidth: 0,
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
