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
