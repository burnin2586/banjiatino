import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AddButton,
  Card,
  ChoiceChip,
  EmptyState,
  ModalSheet,
  PageHeader,
  PrimaryButton,
  Screen,
  SectionTitle,
  StatusBadge,
  TextButton,
} from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import { BOX_STATUSES, type MovingBox } from '@/types/moving';

export default function BoxesScreen() {
  const { state, addBox, updateBox, deleteBox, setBoxStatus } = useMoving();
  const sourceRooms = useMemo(
    () => state.rooms.filter((room) => room.kind === 'source').sort((a, b) => a.order - b.order),
    [state.rooms],
  );
  const destinationRooms = useMemo(
    () =>
      state.rooms
        .filter((room) => room.kind === 'destination')
        .sort((a, b) => a.order - b.order),
    [state.rooms],
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sourceRoomId, setSourceRoomId] = useState(sourceRooms[0]?.id ?? '');
  const [destinationRoomId, setDestinationRoomId] = useState(
    destinationRooms[0]?.id ?? '',
  );
  const [note, setNote] = useState('');

  const sortedBoxes = useMemo(
    () => [...state.boxes].sort((a, b) => b.updatedAt - a.updatedAt),
    [state.boxes],
  );

  function resetForm() {
    setEditingBoxId(null);
    setName('');
    setSourceRoomId(sourceRooms[0]?.id ?? '');
    setDestinationRoomId(destinationRooms[0]?.id ?? '');
    setNote('');
  }

  function openNewBox() {
    resetForm();
    setModalVisible(true);
  }

  function openEditBox(box: MovingBox) {
    setEditingBoxId(box.id);
    setName(box.name);
    setSourceRoomId(box.sourceRoomId);
    setDestinationRoomId(box.destinationRoomId);
    setNote(box.note);
    setModalVisible(true);
  }

  function closeForm() {
    setModalVisible(false);
    resetForm();
  }

  function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('还差一步', '请给箱子起一个容易识别的名字。');
      return;
    }
    if (!sourceRoomId || !destinationRoomId) {
      Alert.alert('还差一步', '请选择来源房间和新家的目标房间。');
      return;
    }

    const input = { name, sourceRoomId, destinationRoomId, note };
    if (editingBoxId) {
      updateBox(editingBoxId, input);
    } else {
      addBox(input);
    }
    closeForm();
  }

  function confirmDelete(box: MovingBox) {
    const contents = state.items.filter((item) => item.boxId === box.id);
    const detail =
      contents.length > 0
        ? `箱内 ${contents.length} 类物品会保留，但将变为“未分配箱子”。`
        : '这是一只空箱子。';
    Alert.alert('删除这个箱子？', `${box.code} · ${box.name}\n${detail}`, [
      { text: '取消', style: 'cancel' },
      { text: '确认删除', style: 'destructive', onPress: () => deleteBox(box.id) },
    ]);
  }

  return (
    <>
      <Screen>
        <PageHeader
          eyebrow="箱子追踪"
          title="封箱之后，也找得到"
          description="每个箱子都有来源、目标房间和可回退的搬运状态。"
          action={<AddButton label="新增箱子" onPress={openNewBox} />}
        />

        <View>
          <SectionTitle title="全部箱子" detail={`${state.boxes.length} 箱`} />
          {sortedBoxes.length === 0 ? (
            <EmptyState
              icon="□"
              title="还没有箱子"
              description="创建第一只箱子，我们会自动生成连续箱号。"
            />
          ) : (
            <View style={styles.list}>
              {sortedBoxes.map((box) => {
                const sourceRoom = state.rooms.find((room) => room.id === box.sourceRoomId);
                const destinationRoom = state.rooms.find(
                  (room) => room.id === box.destinationRoomId,
                );
                const contents = state.items.filter((item) => item.boxId === box.id);
                const totalQuantity = contents.reduce((sum, item) => sum + item.quantity, 0);
                const isFinal = box.status === '已拆箱';

                return (
                  <Card key={box.id}>
                    <View style={styles.boxHeader}>
                      <View style={styles.codeWrap}>
                        <Text style={styles.boxCode}>{box.code}</Text>
                        <Text style={styles.boxName}>{box.name}</Text>
                      </View>
                      <StatusBadge
                        label={box.status}
                        tone={
                          isFinal || box.status === '已到达'
                            ? 'success'
                            : box.status === '待整理'
                              ? 'warning'
                              : 'neutral'
                        }
                      />
                    </View>

                    <View style={styles.routeCard}>
                      <View style={styles.routeStop}>
                        <Text style={styles.routeLabel}>从</Text>
                        <Text style={styles.routeValue}>{sourceRoom?.name ?? '未设置'}</Text>
                      </View>
                      <Text style={styles.routeArrow}>→</Text>
                      <View style={styles.routeStop}>
                        <Text style={styles.routeLabel}>搬到</Text>
                        <Text style={styles.routeValue}>{destinationRoom?.name ?? '未设置'}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <InfoCell label="物品类别" value={`${contents.length} 类`} />
                      <InfoCell label="物品数量" value={`${totalQuantity} 件`} />
                    </View>

                    {contents.length > 0 ? (
                      <View style={styles.contents}>
                        {contents.slice(0, 4).map((item) => (
                          <Text key={item.id} style={styles.contentItem}>
                            · {item.name}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                          </Text>
                        ))}
                        {contents.length > 4 ? (
                          <Text style={styles.more}>还有 {contents.length - 4} 类物品</Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.emptyBox}>这只箱子还是空的</Text>
                    )}

                    {box.note ? <Text style={styles.note}>备注：{box.note}</Text> : null}

                    <View style={styles.statusArea}>
                      <Text style={styles.statusLabel}>调整箱子状态</Text>
                      <View style={styles.chipWrap}>
                        {BOX_STATUSES.map((status) => (
                          <ChoiceChip
                            key={status}
                            label={status}
                            selected={box.status === status}
                            onPress={() => setBoxStatus(box.id, status)}
                          />
                        ))}
                      </View>
                    </View>

                    <View style={styles.actionRow}>
                      <TextButton label="编辑" onPress={() => openEditBox(box)} />
                      <TextButton label="删除" tone="danger" onPress={() => confirmDelete(box)} />
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </Screen>

      <ModalSheet
        visible={modalVisible}
        title={editingBoxId ? '编辑箱子' : '创建箱子'}
        onClose={closeForm}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>箱子名称 *</Text>
          <TextInput
            autoFocus
            placeholder="例如：桌面电子设备"
            placeholderTextColor={AppColors.textMuted}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
          <Text style={styles.helper}>箱号自动生成，编辑后箱号不会改变。</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>从哪个房间搬出</Text>
          <View style={styles.chipWrap}>
            {sourceRooms.map((room) => (
              <ChoiceChip
                key={room.id}
                label={room.name}
                selected={sourceRoomId === room.id}
                onPress={() => setSourceRoomId(room.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>搬到新家的哪个房间</Text>
          <View style={styles.chipWrap}>
            {destinationRooms.map((room) => (
              <ChoiceChip
                key={room.id}
                label={room.name}
                selected={destinationRoomId === room.id}
                onPress={() => setDestinationRoomId(room.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>备注</Text>
          <TextInput
            multiline
            placeholder="例如：易碎、优先拆箱"
            placeholderTextColor={AppColors.textMuted}
            style={[styles.input, styles.noteInput]}
            textAlignVertical="top"
            value={note}
            onChangeText={setNote}
          />
        </View>

        <PrimaryButton label={editingBoxId ? '保存修改' : '创建箱子'} onPress={handleSubmit} />
      </ModalSheet>
    </>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: AppSpacing.md },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: AppSpacing.md,
  },
  codeWrap: { flex: 1, gap: 3 },
  boxCode: { color: AppColors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  boxName: { color: AppColors.text, fontSize: 19, fontWeight: '800' },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: AppSpacing.lg,
    borderRadius: AppRadius.md,
    backgroundColor: AppColors.primarySoft,
    padding: AppSpacing.md,
  },
  routeStop: { flex: 1, gap: 2 },
  routeLabel: { color: AppColors.textMuted, fontSize: 11, fontWeight: '700' },
  routeValue: { color: AppColors.text, fontSize: 15, fontWeight: '800' },
  routeArrow: { color: AppColors.primary, fontSize: 22, fontWeight: '800', paddingHorizontal: 8 },
  infoRow: {
    flexDirection: 'row',
    marginTop: AppSpacing.md,
    marginBottom: AppSpacing.md,
    borderRadius: AppRadius.md,
    backgroundColor: AppColors.background,
    overflow: 'hidden',
  },
  infoCell: { flex: 1, padding: AppSpacing.md, gap: 3 },
  infoLabel: { color: AppColors.textMuted, fontSize: 11, fontWeight: '700' },
  infoValue: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  contents: { marginBottom: AppSpacing.md, gap: 4 },
  contentItem: { color: AppColors.textMuted, fontSize: 13 },
  more: { color: AppColors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  emptyBox: {
    color: AppColors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: AppSpacing.md,
  },
  note: { color: AppColors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: AppSpacing.md },
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
  helper: { color: AppColors.textMuted, fontSize: 12 },
  noteInput: { minHeight: 96 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
});
