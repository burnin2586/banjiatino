import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddButton, Card, EmptyState, LoadingScreen, ModalSheet, PageHeader, PrimaryButton, Screen, TextButton } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';
import type { RootStackParamList } from '@/navigation/types';

const ROOM_COLORS = ['#D8CBE8', '#BFDCCB', '#F0CF9F', '#BCD7E8', '#F3B9B1'];

type Props = NativeStackScreenProps<RootStackParamList, 'Rooms'>;

export default function RoomsScreen({ route, navigation }: Props) {
  const { houseId } = route.params;
  const { state, isLoading, lookups, addRoom, updateRoom, deleteRoom } = useMemory();
  const house = state.houses.find((h) => h.id === houseId);
  const rooms = (lookups.roomsByHouse.get(houseId) ?? []).sort((a, b) => a.order - b.order);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(ROOM_COLORS[0]);

  if (isLoading || !house) return <LoadingScreen label="正在打开…" />;

  function openNew() {
    setEditingId(null);
    setName('');
    setColor(ROOM_COLORS[0]);
    setModalVisible(true);
  }

  function openEdit(id: string, n: string, c: string) {
    setEditingId(id);
    setName(n);
    setColor(c);
    setModalVisible(true);
  }

  function submit() {
    if (!name.trim()) {
      Alert.alert('还差一步', '给房间起个名字。');
      return;
    }
    if (editingId) updateRoom(editingId, { name, color });
    else addRoom(houseId, { name, color });
    setModalVisible(false);
  }

  function confirmDelete(id: string, n: string) {
    Alert.alert('删除房间？', `「${n}」的平面图和照片都会删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteRoom(id) },
    ]);
  }

  return (
    <>
      <Screen>
        <PageHeader
          eyebrow={house.name}
          title="房间"
          description="给这个家的每个房间画一张平面图、贴上照片。"
          action={<AddButton label="新增房间" onPress={openNew} />}
        />
        {rooms.length === 0 ? (
          <EmptyState icon="□" title="还没有房间" description="从卧室或客厅开始吧。" />
        ) : (
          <View style={styles.list}>
            {rooms.map((r) => (
              <Card key={r.id} style={styles.roomCard}>
                <Pressable style={styles.roomLink} onPress={() => navigation.navigate('RoomEditor', { roomId: r.id })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md }}>
                    <View style={{ width: 10, height: 34, borderRadius: 999, backgroundColor: r.color }} />
                    <View style={styles.roomIdentity}>
                      <Text style={{ color: AppColors.text, fontSize: 16, fontWeight: '700' }}>{r.name}</Text>
                      <Text style={{ color: AppColors.textMuted, fontSize: 12 }}>
                        {r.walls.length} 段墙 · {r.photos.length} 张照片
                      </Text>
                    </View>
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: AppSpacing.sm }}>
                  <TextButton label="编辑" onPress={() => openEdit(r.id, r.name, r.color)} />
                  <TextButton label="删除" tone="danger" onPress={() => confirmDelete(r.id, r.name)} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </Screen>

      <ModalSheet visible={modalVisible} title={editingId ? '编辑房间' : '新增房间'} onClose={() => setModalVisible(false)}>
        <View style={styles.field}>
          <Text style={styles.label}>房间名 *</Text>
          <TextInput style={styles.input} autoFocus placeholder="例如：卧室" placeholderTextColor={AppColors.textMuted} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>主色</Text>
          <View style={styles.colorRow}>
            {ROOM_COLORS.map((c) => (
              <Pressable
                accessibilityLabel={`选择颜色 ${c}`}
                accessibilityRole="button"
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorDot, { backgroundColor: c, borderColor: color === c ? AppColors.primary : 'transparent' }]}
              />
            ))}
          </View>
        </View>
        <PrimaryButton label={editingId ? '保存' : '创建'} onPress={submit} />
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: AppSpacing.md },
  roomCard: { padding: AppSpacing.md, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  roomLink: { flex: 1, minHeight: 44, justifyContent: 'center' },
  roomIdentity: { flex: 1, gap: 2 },
  field: { gap: AppSpacing.sm },
  label: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: AppColors.border, borderRadius: 12, backgroundColor: AppColors.surface, paddingHorizontal: 12, fontSize: 16 },
  colorRow: { flexDirection: 'row', gap: AppSpacing.sm },
  colorDot: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
});
