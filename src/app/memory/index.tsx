import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, LoadingScreen, ModalSheet, PageHeader, PrimaryButton, Screen } from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';
import type { RootStackParamList } from '@/navigation/types';

import { getMemoryHomeState } from './memory-presentation';

const HOUSE_COLORS = ['#D8CBE8', '#BFDCCB', '#F0CF9F', '#BCD7E8', '#F3B9B1'];

export default function MemoryHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
          action={<PrimaryButton compact label="新增家" onPress={() => setModalVisible(true)} />}
        />
        {getMemoryHomeState(state.houses.length) === 'empty' ? (
          <Card style={styles.emptyTray}>
            <View style={styles.emptyWell}>
              <Text style={styles.emptyIcon}>⌂</Text>
            </View>
            <Text style={styles.emptyTitle}>还没有家</Text>
            <Text style={styles.emptyDescription}>把第一个住过的家加进来吧。</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {state.houses.map((h) => (
              <Card key={h.id} style={styles.houseCard}>
                <PressableHouse
                  color={h.coverColor}
                  name={h.name}
                  roomCount={state.rooms.filter((r) => r.houseId === h.id).length}
                  onOpen={() => navigation.navigate('Rooms', { houseId: h.id })}
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
    <View style={styles.houseRow}>
      <Pressable
        accessibilityLabel={`打开${name}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.houseOpen, pressed && styles.pressed]}>
        <View style={[styles.houseAccent, { backgroundColor: color }]} />
        <View style={styles.houseCopy}>
          <Text numberOfLines={2} style={styles.houseName}>{name}</Text>
          <Text style={styles.roomCount}>{roomCount} 个房间</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={`删除${name}`}
        accessibilityRole="button"
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
        <Text style={styles.deleteText}>删除</Text>
      </Pressable>
    </View>
  );
}

function PressableColor({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`选择颜色 ${color}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.colorTarget, pressed && styles.pressed]}>
      <View style={[styles.colorDot, { backgroundColor: color, borderColor: selected ? AppColors.primary : AppColors.surface }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: AppSpacing.md },
  houseCard: { padding: AppSpacing.sm },
  houseRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.xs },
  houseOpen: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: AppSpacing.xs },
  houseAccent: { width: 8, height: 40, borderRadius: AppRadius.pill },
  houseCopy: { flex: 1, gap: 2 },
  houseName: { color: AppColors.text, fontSize: 17, fontWeight: '700' },
  roomCount: { color: AppColors.textMuted, fontSize: 12 },
  deleteButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: AppSpacing.xs },
  deleteText: { color: AppColors.danger, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  emptyTray: { width: '100%', maxWidth: 280, alignSelf: 'center', alignItems: 'center', padding: AppSpacing.xl, gap: AppSpacing.sm },
  emptyWell: { width: '100%', maxWidth: 200, minHeight: 160, borderRadius: AppRadius.lg, backgroundColor: AppColors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: AppSpacing.sm },
  emptyIcon: { color: AppColors.primary, fontSize: 56, fontWeight: '700', lineHeight: 64 },
  emptyTitle: { alignSelf: 'stretch', color: AppColors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { alignSelf: 'stretch', color: AppColors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  field: { gap: AppSpacing.sm },
  label: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: AppColors.border, borderRadius: AppRadius.control, backgroundColor: AppColors.surface, color: AppColors.text, paddingHorizontal: AppSpacing.md, fontSize: 16 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.xs },
  colorTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
});
