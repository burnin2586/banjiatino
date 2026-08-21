import { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AddButton,
  Card,
  ChoiceChip,
  EmptyState,
  LoadingScreen,
  ModalSheet,
  PageHeader,
  PrimaryButton,
  SectionTitle,
  StatusBadge,
  TextButton,
} from '@/components/ui-kit';
import { TemplatePicker } from '@/components/template-picker';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import { formatBoxCode,
  ITEM_ACTIONS,
  ITEM_STATUSES,
  type ItemAction,
  type MovingItem,
} from '@/types/moving';

export default function ItemsScreen() {
  const {
    state,
    isLoading,
    lookups,
    addItem,
    updateItem,
    deleteItem,
    setItemStatus,
  } = useMoving();
  const [modalVisible, setModalVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [originalLocation, setOriginalLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [boxId, setBoxId] = useState<string | null>(null);
  const [action, setAction] = useState<ItemAction>('带走');
  const [note, setNote] = useState('');

  const sortedItems = useMemo(
    () => [...state.items].sort((a, b) => b.updatedAt - a.updatedAt),
    [state.items],
  );

  function resetForm() {
    setEditingItemId(null);
    setName('');
    setQuantity('1');
    setOriginalLocation('');
    setDestinationLocation('');
    setBoxId(null);
    setAction('带走');
    setNote('');
  }

  function openNewItem() {
    resetForm();
    setModalVisible(true);
  }

  function openEditItem(item: MovingItem) {
    setEditingItemId(item.id);
    setName(item.name);
    setQuantity(String(item.quantity));
    setOriginalLocation(item.originalLocation);
    setDestinationLocation(item.destinationLocation);
    setBoxId(item.boxId);
    setAction(item.action);
    setNote(item.note);
    setModalVisible(true);
  }

  function closeForm() {
    setModalVisible(false);
    resetForm();
  }

  function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('还差一步', '请先填写物品名称。');
      return;
    }

    const input = {
      name,
      quantity: Number.parseInt(quantity, 10) || 1,
      originalLocation,
      destinationLocation,
      boxId: action === '带走' ? boxId : null,
      action,
      note,
    };

    if (editingItemId) {
      updateItem(editingItemId, input);
    } else {
      addItem(input);
    }
    closeForm();
  }

  function confirmDelete(item: MovingItem) {
    Alert.alert('删除这件物品？', `“${item.name}”会从搬家清单中删除，此操作无法撤销。`, [
      { text: '取消', style: 'cancel' },
      { text: '确认删除', style: 'destructive', onPress: () => deleteItem(item.id) },
    ]);
  }

  return (
    <>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screenSafe}>
        {isLoading ? (
          <LoadingScreen />
        ) : (
          <FlatList
            data={sortedItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.screenContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.headerBlock}>
                <PageHeader
                  eyebrow="物品台账"
                  title="每一件，都有去向"
                  description="记录旧家位置和新家位置，填错了也可以随时修改。"
                  action={<AddButton label="新增物品" onPress={openNewItem} />}
                />
                <View style={styles.headerActions}>
                  <TextButton label="从模板添加" onPress={() => setTemplateVisible(true)} />
                </View>
                <SectionTitle title="全部物品" detail={`${state.items.length} 类`} />
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                icon="◇"
                title="还没有物品"
                description="从一个抽屉开始，添加第一件需要搬走的东西。"
              />
            }
            ItemSeparatorComponent={() => <View style={styles.listGap} />}
            renderItem={({ item }) => {
              const box = item.boxId ? lookups.boxById.get(item.boxId) : undefined;
              const destinationRoom = box
                ? lookups.roomById.get(box.destinationRoomId)
                : undefined;
              const isMoving = item.action === '带走';
              const isFinal = item.status === '已安置';

              return (
                <Card>
                  <View style={styles.itemTop}>
                    <View style={styles.itemIdentity}>
                      <View style={styles.itemIcon}>
                        <Text style={styles.itemIconText}>◇</Text>
                      </View>
                      <View style={styles.itemTitleWrap}>
                        <Text style={styles.itemName}>
                          {item.name}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        </Text>
                        <Text style={styles.itemLocation}>
                          原位置：{item.originalLocation || '未记录'}
                        </Text>
                      </View>
                    </View>
                    <StatusBadge
                      label={isMoving ? item.status : item.action}
                      tone={
                        isFinal
                          ? 'success'
                          : !isMoving
                            ? 'accent'
                            : item.status === '待整理'
                              ? 'warning'
                              : 'neutral'
                      }
                    />
                  </View>

                  <View style={styles.destination}>
                    <Text style={styles.destinationLabel}>搬家去向</Text>
                    <Text style={styles.destinationValue}>
                      {!isMoving
                        ? item.action
                        : box
                          ? `${formatBoxCode(box)} · ${destinationRoom?.name ?? '未设置目标房间'}`
                          : '尚未分配箱子'}
                    </Text>
                    {isMoving ? (
                      <Text style={styles.destinationMeta}>
                        具体位置：{item.destinationLocation || '待确定'}
                      </Text>
                    ) : null}
                  </View>

                  {item.note ? <Text style={styles.note}>备注：{item.note}</Text> : null}

                  {isMoving && item.boxId ? (
                    <View style={styles.statusArea}>
                      <Text style={styles.statusLabel}>调整状态</Text>
                      <View style={styles.chipWrap}>
                        {ITEM_STATUSES.map((status) => (
                          <ChoiceChip
                            key={status}
                            label={status}
                            selected={item.status === status}
                            onPress={() => setItemStatus(item.id, status)}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.actionRow}>
                    <TextButton label="编辑" onPress={() => openEditItem(item)} />
                    <TextButton label="删除" tone="danger" onPress={() => confirmDelete(item)} />
                  </View>
                </Card>
              );
            }}
          />
        )}
      </SafeAreaView>

      <ModalSheet
        visible={modalVisible}
        title={editingItemId ? '编辑物品' : '添加物品'}
        onClose={closeForm}>
        <FormField label="物品名称 *">
          <TextInput
            autoFocus
            placeholder="例如：相机充电器"
            placeholderTextColor={AppColors.textMuted}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
        </FormField>

        <View style={styles.twoColumns}>
          <FormField label="数量" style={styles.quantityField}>
            <TextInput
              keyboardType="number-pad"
              selectTextOnFocus
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
            />
          </FormField>
          <FormField label="原来的位置" style={styles.locationField}>
            <TextInput
              placeholder="例如：书桌右侧抽屉"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
              value={originalLocation}
              onChangeText={setOriginalLocation}
            />
          </FormField>
        </View>

        <FormField label="新家的具体位置">
          <TextInput
            placeholder="例如：卧室衣柜第二层"
            placeholderTextColor={AppColors.textMuted}
            style={styles.input}
            value={destinationLocation}
            onChangeText={setDestinationLocation}
          />
        </FormField>

        <FormField label="怎么处理">
          <View style={styles.chipWrap}>
            {ITEM_ACTIONS.map((entry) => (
              <ChoiceChip
                key={entry}
                label={entry}
                selected={action === entry}
                onPress={() => setAction(entry)}
              />
            ))}
          </View>
        </FormField>

        {action === '带走' ? (
          <FormField label="放入哪个箱子">
            <ScrollView
              horizontal
              contentContainerStyle={styles.horizontalChips}
              showsHorizontalScrollIndicator={false}>
              <ChoiceChip label="暂不分配" selected={!boxId} onPress={() => setBoxId(null)} />
              {state.boxes.map((box) => (
                <ChoiceChip
                  key={box.id}
                  label={`${formatBoxCode(box)} ${box.name}`}
                  selected={boxId === box.id}
                  onPress={() => setBoxId(box.id)}
                />
              ))}
            </ScrollView>
          </FormField>
        ) : null}

        <FormField label="备注">
          <TextInput
            multiline
            placeholder="易碎、优先拆箱、单独搬运……"
            placeholderTextColor={AppColors.textMuted}
            style={[styles.input, styles.noteInput]}
            textAlignVertical="top"
            value={note}
            onChangeText={setNote}
          />
        </FormField>

        <PrimaryButton label={editingItemId ? '保存修改' : '保存物品'} onPress={handleSubmit} />
      </ModalSheet>

      <TemplatePicker
        visible={templateVisible}
        onClose={() => setTemplateVisible(false)}
      />
    </>
  );
}

function FormField({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screenSafe: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  screenContent: {
    paddingHorizontal: AppSpacing.lg,
    paddingTop: AppSpacing.md,
    paddingBottom: 120,
  },
  headerBlock: {
    gap: AppSpacing.xl,
    marginBottom: AppSpacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: AppSpacing.sm,
  },
  listGap: {
    height: AppSpacing.md,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: AppSpacing.sm,
  },
  itemIdentity: { flex: 1, flexDirection: 'row', gap: AppSpacing.md },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: AppRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primarySoft,
  },
  itemIconText: { color: AppColors.primary, fontSize: 22, fontWeight: '800' },
  itemTitleWrap: { flex: 1, gap: 3 },
  itemName: { color: AppColors.text, fontSize: 16, fontWeight: '700' },
  itemLocation: { color: AppColors.textMuted, fontSize: 12 },
  destination: {
    marginTop: AppSpacing.lg,
    marginBottom: AppSpacing.md,
    borderRadius: AppRadius.sm,
    backgroundColor: AppColors.background,
    padding: AppSpacing.md,
    gap: 3,
  },
  destinationLabel: { color: AppColors.textMuted, fontSize: 11, fontWeight: '700' },
  destinationValue: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  destinationMeta: { color: AppColors.textMuted, fontSize: 12 },
  note: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: AppSpacing.md,
  },
  statusArea: { gap: AppSpacing.sm, marginBottom: AppSpacing.md },
  statusLabel: { color: AppColors.textMuted, fontSize: 12, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: AppSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppColors.border,
    paddingTop: AppSpacing.sm,
  },
  field: { gap: AppSpacing.sm },
  fieldLabel: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
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
  noteInput: { minHeight: 96 },
  twoColumns: { flexDirection: 'row', gap: AppSpacing.md },
  quantityField: { width: 84 },
  locationField: { flex: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  horizontalChips: { gap: AppSpacing.sm, paddingRight: AppSpacing.lg },
});
