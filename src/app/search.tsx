import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Card,
  EmptyState,
  LoadingScreen,
  PageHeader,
  Screen,
  SectionTitle,
  StatusBadge,
} from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';

export default function SearchScreen() {
  const { state, isLoading, lookups } = useMoving();
  const [query, setQuery] = useState('');

  const movingItems = useMemo(
    () => state.items.filter((item) => item.action === '带走'),
    [state.items],
  );
  const unboxed = movingItems.filter((item) => !item.boxId);
  const notArrived = movingItems.filter(
    (item) => item.status !== '已到达' && item.status !== '已安置',
  );

  const results = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    if (!keyword) {
      return [];
    }

    return state.items.filter((item) => {
      const box = item.boxId ? lookups.boxById.get(item.boxId) : undefined;
      const sourceRoom = box ? lookups.roomById.get(box.sourceRoomId) : undefined;
      const destinationRoom = box ? lookups.roomById.get(box.destinationRoomId) : undefined;
      return [
        item.name,
        item.originalLocation,
        item.destinationLocation,
        item.note,
        box?.code,
        box?.name,
        sourceRoom?.name,
        destinationRoom?.name,
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase('zh-CN').includes(keyword));
    });
  }, [query, state.items, lookups]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="快速定位"
        title="东西到底在哪？"
        description="搜索名称、原位置、箱号或备注，封箱后也不用重新打开。"
      />

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          placeholder="试试搜索：充电器"
          placeholderTextColor={AppColors.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <Card style={styles.auditCard}>
        <Text style={styles.auditEyebrow}>搬家清点</Text>
        <Text style={styles.auditTitle}>
          {unboxed.length === 0 && notArrived.length === 0 ? '所有物品都已到达' : '还有事项需要确认'}
        </Text>
        <View style={styles.auditGrid}>
          <AuditMetric value={movingItems.length} label="带走类别" />
          <AuditMetric value={unboxed.length} label="未分配箱子" warning={unboxed.length > 0} />
          <AuditMetric value={notArrived.length} label="尚未到达" warning={notArrived.length > 0} />
        </View>
      </Card>

      <View>
        <SectionTitle
          title={query.trim() ? '搜索结果' : '开始查找'}
          detail={query.trim() ? `${results.length} 条` : undefined}
        />

        {!query.trim() ? (
          <EmptyState
            icon="⌕"
            title="输入一个关键词"
            description="你可以搜索物品名称、原来的位置、箱号或备注。"
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon="?"
            title="没有找到"
            description="换一个更短的关键词，或者确认这件物品是否已经录入。"
          />
        ) : (
          <View style={styles.results}>
            {results.map((item) => {
              const box = item.boxId ? lookups.boxById.get(item.boxId) : undefined;
              const sourceRoom = box ? lookups.roomById.get(box.sourceRoomId) : undefined;
              const destinationRoom = box
                ? lookups.roomById.get(box.destinationRoomId)
                : undefined;
              const isMoving = item.action === '带走';
              return (
                <Card key={item.id}>
                  <View style={styles.resultHeader}>
                    <View style={styles.resultTitleWrap}>
                      <Text style={styles.resultName}>
                        {item.name}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                      </Text>
                      <Text style={styles.resultOriginal}>
                        原位置：{item.originalLocation || '未记录'}
                      </Text>
                    </View>
                    <StatusBadge
                      label={isMoving ? item.status : item.action}
                      tone={
                        item.status === '已安置'
                          ? 'success'
                          : isMoving
                            ? 'neutral'
                            : 'accent'
                      }
                    />
                  </View>

                  <View
                    style={[
                      styles.answer,
                      !box && isMoving ? styles.answerWarning : styles.answerReady,
                    ]}>
                    <Text style={styles.answerLabel}>现在的位置</Text>
                    <Text style={styles.answerValue}>
                      {!isMoving
                        ? item.action
                        : box
                          ? `${box.code} · ${box.name}`
                          : '还没有分配箱子'}
                    </Text>
                    {box ? (
                      <Text style={styles.answerMeta}>
                        {sourceRoom?.name ?? '未分区'} → {destinationRoom?.name ?? '未设置'} ·{' '}
                        箱子状态：{box.status}
                      </Text>
                    ) : null}
                    {isMoving && item.destinationLocation ? (
                      <Text style={styles.answerMeta}>具体位置：{item.destinationLocation}</Text>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

function AuditMetric({
  value,
  label,
  warning = false,
}: {
  value: number;
  label: string;
  warning?: boolean;
}) {
  return (
    <View style={styles.auditMetric}>
      <Text style={[styles.auditValue, warning && styles.auditValueWarning]}>{value}</Text>
      <Text style={styles.auditLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    paddingHorizontal: AppSpacing.lg,
    borderRadius: AppRadius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  searchIcon: {
    color: AppColors.primary,
    fontSize: 26,
    fontWeight: '800',
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    color: AppColors.text,
    fontSize: 17,
  },
  auditCard: {
    backgroundColor: AppColors.primarySoft,
    borderColor: '#C5DCCC',
  },
  auditEyebrow: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  auditTitle: {
    color: AppColors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 3,
    marginBottom: AppSpacing.lg,
  },
  auditGrid: {
    flexDirection: 'row',
  },
  auditMetric: {
    flex: 1,
    gap: 2,
  },
  auditValue: {
    color: AppColors.primary,
    fontSize: 23,
    fontWeight: '900',
  },
  auditValueWarning: {
    color: AppColors.warning,
  },
  auditLabel: {
    color: AppColors.textMuted,
    fontSize: 11,
  },
  results: {
    gap: AppSpacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: AppSpacing.md,
  },
  resultTitleWrap: {
    flex: 1,
    gap: 3,
  },
  resultName: {
    color: AppColors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  resultOriginal: {
    color: AppColors.textMuted,
    fontSize: 12,
  },
  answer: {
    marginTop: AppSpacing.lg,
    borderRadius: AppRadius.md,
    borderLeftWidth: 4,
    padding: AppSpacing.md,
    gap: 3,
  },
  answerReady: {
    backgroundColor: AppColors.primarySoft,
    borderLeftColor: AppColors.primary,
  },
  answerWarning: {
    backgroundColor: '#F8E9D6',
    borderLeftColor: AppColors.warning,
  },
  answerLabel: {
    color: AppColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  answerValue: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  answerMeta: {
    color: AppColors.textMuted,
    fontSize: 12,
  },
});
