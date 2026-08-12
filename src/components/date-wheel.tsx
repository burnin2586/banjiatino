import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollView as ScrollViewType, StyleSheet, Text, View } from 'react-native';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import {
  clampDay,
  fromDateStamp,
  getDaysInMonth,
  toDateStamp,
  yearRange,
  type DateParts,
} from '@/logic/date-wheel';

const ITEM_HEIGHT = 40;

function Column({
  items,
  selected,
  format,
  onSelect,
}: {
  items: number[];
  selected: number;
  format: (n: number) => string;
  onSelect: (n: number) => void;
}) {
  const initialIndex = Math.max(0, items.indexOf(selected));
  const scrollRef = useRef<ScrollViewType>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: initialIndex * ITEM_HEIGHT, animated: false });
  }, [initialIndex]);
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.column}
      contentContainerStyle={styles.columnContent}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={(e) => {
        const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
        const clamped = Math.min(Math.max(0, index), items.length - 1);
        const value = items[clamped];
        if (value !== undefined && value !== selected) onSelect(value);
      }}>
      {items.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={String(n)}
            onPress={() => onSelect(n)}
            style={[styles.item, active && styles.itemActive]}>
            <Text style={[styles.itemText, active && styles.itemTextActive]}>{format(n)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function DateWheel({
  value,
  onChange,
  centerYear,
}: {
  value: number;
  onChange: (ts: number) => void;
  centerYear?: number;
}) {
  const initial = useMemo(() => fromDateStamp(value), [value]);
  const [parts, setParts] = useState<DateParts>(initial);
  // 外部 value 变化时（例如父组件清空搬家日回退到 Date.now()）同步滚轮。
  // 用户滚动场景下 value 回流与 finalParts 往返一致，setParts 触发 React bail out，无抖动。
  useEffect(() => {
    setParts(fromDateStamp(value));
  }, [value]);
  const years = useMemo(() => yearRange(centerYear ?? initial.year), [centerYear, initial.year]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(
    () => Array.from({ length: getDaysInMonth(parts.year, parts.month) }, (_, i) => i + 1),
    [parts.year, parts.month],
  );

  function emit(next: DateParts) {
    const day = clampDay(next.year, next.month, next.day);
    const finalParts = { ...next, day };
    setParts(finalParts);
    onChange(toDateStamp(finalParts));
  }

  return (
    <View style={styles.row}>
      <Column
        items={years}
        selected={parts.year}
        format={(y) => `${y} 年`}
        onSelect={(year) => emit({ ...parts, year })}
      />
      <Column
        items={months}
        selected={parts.month}
        format={(m) => `${m} 月`}
        onSelect={(month) => emit({ ...parts, month })}
      />
      <Column
        items={days}
        selected={parts.day}
        format={(d) => `${d} 日`}
        onSelect={(day) => emit({ ...parts, day })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: AppSpacing.sm,
  },
  column: {
    flex: 1,
    maxHeight: ITEM_HEIGHT * 5,
    borderRadius: AppRadius.control,
    backgroundColor: AppColors.background,
  },
  columnContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: AppRadius.control,
  },
  itemActive: {
    backgroundColor: AppColors.primarySoft,
  },
  itemText: {
    color: AppColors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  itemTextActive: {
    color: AppColors.primary,
    fontWeight: '800',
  },
});
