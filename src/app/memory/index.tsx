import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddButton, Card, EmptyState, LoadingScreen, ModalSheet, PageHeader, PrimaryButton, Screen } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';

const HOUSE_COLORS = ['#D8CBE8', '#BFDCCB', '#F0CF9F', '#BCD7E8', '#F3B9B1'];

export default function MemoryHomeScreen() {
  const { state, isLoading, addHouse, deleteHouse } = useMemory();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(HOUSE_COLORS[0]);

  function close() {
    setModalVisible(false);
    setName('');
    setColor(HOUSE_COLORS[0]);
  }

  function submit() {
    if (!name.trim()) {
      Alert.alert('还差一步', '给这个家起个名字。');
      return;
    }
    addHouse({ name, coverColor: color });
    close();
  }

  function confirmDelete(id: string, houseName: string) {
    Alert.alert('删除这个家？', `「${houseName}」的所有房间和照片都会删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteHouse(id) },
    ]);
  }

  if (isLoading) return <LoadingScreen label="正在打开回忆…" />;

  return (
    <>
      <Screen>
        <PageHeader
          eyebrow="留住住过的家"
          title="回忆的家"
          description="把每个家画下来、贴上照片，留住当时的故事。"
          action={<AddButton label="新增家" onPress={() => setModalVisible(true)} />}
        />
        {state.houses.length === 0 ? (
          <EmptyState icon="⌂" title="还没有家" description="把第一个住过的家加进来吧。" />
        ) : (
          <View style={styles.list}>
            {state.houses.map((h) => (
              <Card key={h.id} style={styles.houseCard}>
                <PressableHouse
                  color={h.coverColor}
                  name={h.name}
                  roomCount={state.rooms.filter((r) => r.houseId === h.id).length}
                  onOpen={() => router.push(`/memory/${h.id}` as Href)}
                  onDelete={() => confirmDelete(h.id, h.name)}
                />
              </Card>
            ))}
          </View>
        )}
      </Screen>

      <ModalSheet visible={modalVisible} title="新增家" onClose={close}>
        <View style={styles.field}>
          <Text style={styles.label}>家的名字 *</Text>
          <TextInput style={styles.input} autoFocus placeholder="例如：朝阳的小公寓" placeholderTextColor={AppColors.textMuted} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>主色</Text>
          <View style={styles.colorRow}>
            {HOUSE_COLORS.map((c) => (
              <PressableColor key={c} color={c} selected={color === c} onPress={() => setColor(c)} />
            ))}
          </View>
        </View>
        <PrimaryButton label="创建" onPress={submit} />
      </ModalSheet>
    </>
  );
}

function PressableHouse({ color, name, roomCount, onOpen, onDelete }: { color: string; name: string; roomCount: number; onOpen: () => void; onDelete: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md }}>
      <Pressable onPress={onOpen} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md }}>
        <View style={{ width: 10, height: 38, borderRadius: 999, backgroundColor: color }} />
        <View style={{ gap: 2 }}>
          <Text style={{ color: AppColors.text, fontSize: 17, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: AppColors.textMuted, fontSize: 12 }}>{roomCount} 个房间</Text>
        </View>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Text style={{ color: '#B4483D', fontSize: 13, fontWeight: '700' }}>删除</Text>
      </Pressable>
    </View>
  );
}

function PressableColor({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.colorDot, { backgroundColor: color, borderColor: selected ? AppColors.primary : 'transparent' }]} />
  );
}

const styles = StyleSheet.create({
  list: { gap: AppSpacing.md },
  houseCard: { padding: AppSpacing.md },
  field: { gap: AppSpacing.sm },
  label: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: AppColors.border, borderRadius: 12, backgroundColor: AppColors.surface, paddingHorizontal: 12, fontSize: 16 },
  colorRow: { flexDirection: 'row', gap: AppSpacing.sm },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
});
