import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Card,
  EmptyState,
  ModalSheet,
  PrimaryButton,
  Screen,
  SectionTitle,
  TextButton,
} from '@/components/ui-kit';
import { DateWheel } from '@/components/date-wheel';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import { computeSuggestedDate, groupTasksByPhase } from '@/logic/task-timeline';
import type { MovingTask } from '@/types/moving';
import type { RootStackParamList } from '@/navigation/types';
import { formatSuggestedDate, isOverdue, phaseTitle } from './task-timeline-presentation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TaskTimeline'>;
type Phase = 'before' | 'dayOf' | 'after';

export default function TaskTimelineScreen() {
  const {
    state,
    setMovingDate,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    importTaskPresets,
  } = useMoving();
  const nav = useNavigation<Nav>();
  const movingDate = state.movingDate;
  const today = Date.now();

  const grouped = useMemo(() => groupTasksByPhase(state.tasks), [state.tasks]);
  const phases: Phase[] = ['before', 'dayOf', 'after'];

  const [editing, setEditing] = useState<MovingTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <TextButton label="← 返回" onPress={() => nav.goBack()} />
        <Text style={styles.title}>搬家节奏</Text>
        <TextButton
          label={movingDate ? '改日期' : '设置日期'}
          onPress={() => setPickingDate(true)}
        />
      </View>
      <Text style={styles.sub}>
        {movingDate ? `搬家日：${formatSuggestedDate(movingDate)}` : '未设置搬家日'}
      </Text>

      {state.tasks.length === 0 ? (
        <>
          <EmptyState
            icon="📅"
            title="还没有任务"
            description="从预设导入一套标准搬家任务，或自己加一条。"
          />
          <PrimaryButton label="导入预设任务" onPress={importTaskPresets} />
        </>
      ) : null}

      {state.tasks.length === 0
        ? null
        : phases.map((phase) => {
            const list = grouped[phase];
            if (list.length === 0) return null;
            return (
              <View key={phase}>
                <SectionTitle title={phaseTitle(phase)} detail={`${list.length} 项`} />
                {list.map((t) => {
                  const suggested = computeSuggestedDate(movingDate, t.dueOffsetDays);
                  const overdue = isOverdue(suggested, today, t.done);
                  return (
                    <Card key={t.id} style={styles.taskCard}>
                      <Pressable
                        onPress={() => toggleTask(t.id)}
                        style={[styles.checkbox, t.done && styles.checkboxDone]}>
                        <Text style={styles.checkboxGlyph}>{t.done ? '✓' : ''}</Text>
                      </Pressable>
                      <View style={styles.taskBody}>
                        <Text style={[styles.taskTitle, t.done && styles.taskDone]}>
                          {t.title}
                        </Text>
                        <Text style={[styles.taskMeta, overdue && styles.taskOverdue]}>
                          建议 {formatSuggestedDate(suggested)} 完成
                          {overdue ? ' · 已过期' : ''}
                        </Text>
                      </View>
                      <TextButton label="编辑" onPress={() => setEditing(t)} />
                    </Card>
                  );
                })}
              </View>
            );
          })}

      <PrimaryButton label="+ 添加任务" onPress={() => setCreating(true)} />

      <TaskEditSheet
        visible={creating || editing !== null}
        task={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={(input) => {
          if (editing) updateTask(editing.id, input);
          else addTask(input);
          setCreating(false);
          setEditing(null);
        }}
        onDelete={
          editing
            ? () => {
                Alert.alert('删除任务？', editing.title, [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                      deleteTask(editing.id);
                      setEditing(null);
                    },
                  },
                ]);
              }
            : undefined
        }
      />

      <ModalSheet title="设置搬家日" visible={pickingDate} onClose={() => setPickingDate(false)}>
        <DateWheel value={movingDate ?? Date.now()} onChange={(ts) => setMovingDate(ts)} />
        {movingDate !== null ? (
          <TextButton
            label="清除搬家日"
            tone="danger"
            onPress={() => {
              setMovingDate(null);
              setPickingDate(false);
            }}
          />
        ) : null}
      </ModalSheet>
    </Screen>
  );
}

function TaskEditSheet({
  visible,
  task,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  task: MovingTask | null;
  onClose: () => void;
  onSave: (input: { title: string; dueOffsetDays: number; note?: string }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [offset, setOffset] = useState(String(task?.dueOffsetDays ?? -7));
  const [note, setNote] = useState(task?.note ?? '');

  // 每次打开时重置表单（visible/task 变化）
  useEffect(() => {
    if (visible) {
      setTitle(task?.title ?? '');
      setOffset(String(task?.dueOffsetDays ?? -7));
      setNote(task?.note ?? '');
    }
  }, [visible, task]);

  function save() {
    const t = title.trim();
    const n = Number(offset);
    if (!t) return;
    onSave({
      title: t,
      dueOffsetDays: Number.isFinite(n) ? Math.trunc(n) : 0,
      note: note.trim(),
    });
  }

  return (
    <ModalSheet title={task ? '编辑任务' : '新建任务'} visible={visible} onClose={onClose}>
      <Text style={styles.fieldLabel}>标题</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="如：约搬家公司"
        placeholderTextColor={AppColors.textMuted}
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>相对搬家日的天数（负=搬家前，0=当天，正=入住后）</Text>
      <TextInput
        value={offset}
        onChangeText={setOffset}
        keyboardType="numeric"
        placeholder="-7"
        placeholderTextColor={AppColors.textMuted}
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>备注</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="可选"
        placeholderTextColor={AppColors.textMuted}
        style={styles.input}
      />
      <PrimaryButton label="保存" onPress={save} />
      {onDelete ? <TextButton label="删除任务" tone="danger" onPress={onDelete} /> : null}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppSpacing.sm,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    color: AppColors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: AppColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.sm,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: AppRadius.sm,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: AppColors.primary,
  },
  checkboxGlyph: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  taskBody: {
    flex: 1,
    flexShrink: 1,
    gap: 3,
  },
  taskTitle: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  taskDone: {
    color: AppColors.textMuted,
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    color: AppColors.textMuted,
    fontSize: 12,
  },
  taskOverdue: {
    color: AppColors.danger,
    fontWeight: '700',
  },
  fieldLabel: {
    color: AppColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
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
});
