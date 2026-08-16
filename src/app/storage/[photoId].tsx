import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoMarkerCanvas } from '@/components/storage/photo-marker-canvas';
import {
  ChoiceChip,
  LoadingScreen,
  ModalSheet,
  PrimaryButton,
  TextButton,
} from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import { formatBoxCode } from '@/types/moving';
import type {
  MarkerRect, MovingBox, MovingItem,
} from '@/types/moving';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'StoragePhoto'>;

export default function StoragePhotoScreen({ route, navigation }: Props) {
  const { photoId } = route.params;
  const {
    state,
    isLoading,
    lookups,
    addBox,
    updateBox,
    deleteBox,
    clearBoxMarker,
    deleteStoragePhoto,
    addItem,
    updateItem,
    deleteItem,
  } = useMoving();
  const photo = state.storagePhotos.find((candidate) => candidate.id === photoId);
  const boxes = lookups.boxesByStoragePhoto.get(photoId) ?? [];
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  if (isLoading) return <LoadingScreen label="正在打开照片…" />;

  if (!photo) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingTitle}>这张收纳照片不存在</Text>
        <TextButton
          label="返回箱子页"
          onPress={() => navigation.replace('MainTabs', { screen: 'Boxes' })}
        />
      </SafeAreaView>
    );
  }
  const currentPhoto = photo;

  const activeBox = activeBoxId ? state.boxes.find((box) => box.id === activeBoxId) : null;
  const activeItems = activeBox ? (lookups.itemsByBox.get(activeBox.id) ?? []) : [];

  function handleCreate(rect: MarkerRect) {
    const sourceRoomId = lookups.sourceRooms[0]?.id;
    const destinationRoomId = lookups.destinationRooms[0]?.id;
    if (!sourceRoomId || !destinationRoomId) {
      Alert.alert('还不能创建箱子', '请先在房间设置中添加旧家和新家的房间。');
      return;
    }
    addBox({
      name: '未命名箱子',
      sourceRoomId,
      destinationRoomId,
      storagePhotoId: currentPhoto.id,
      markerRect: rect,
    });
  }

  function openBox(boxId: string) {
    setActiveBoxId(boxId);
    setItemName('');
  }

  function addOneItem() {
    if (!activeBox || !itemName.trim()) return;
    addItem({
      name: itemName.trim(),
      quantity: 1,
      originalLocation: '',
      destinationLocation: '',
      boxId: activeBox.id,
      action: '带走',
    });
    setItemName('');
  }

  function confirmRemoveFromPhoto() {
    if (!activeBox) return;
    Alert.alert('从照片移除？', '箱子仍会保留在箱子列表，只取消照片上的标注。', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: () => {
          clearBoxMarker(activeBox.id);
          setActiveBoxId(null);
        },
      },
    ]);
  }

  function confirmDeleteBox() {
    if (!activeBox) return;
    Alert.alert('删除这个箱子？', '箱内物品会保留，但会变为未分配箱子。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除箱子',
        style: 'destructive',
        onPress: () => {
          deleteBox(activeBox.id);
          setActiveBoxId(null);
        },
      },
    ]);
  }

  function confirmDeletePhoto() {
    Alert.alert('删除这张收纳照片？', '照片文件会删除；上面的箱子保留，只取消标注。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          navigation.goBack();
          void deleteStoragePhoto(currentPhoto.id).catch(() => {
            Alert.alert('删除失败', '照片记录已移除，但本地文件清理失败。');
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.headerControl}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text numberOfLines={2} style={styles.title}>
          {currentPhoto.title || '收纳照片'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={confirmDeletePhoto}
          style={styles.headerControl}>
          <Text style={styles.danger}>删除</Text>
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        <ModeChip label="编辑" active={mode === 'edit'} onPress={() => setMode('edit')} />
        <ModeChip label="查看" active={mode === 'view'} onPress={() => setMode('view')} />
      </View>

      <View
        style={styles.canvasArea}
        onLayout={(event: LayoutChangeEvent) => setCanvasSize(event.nativeEvent.layout)}>
        <PhotoMarkerCanvas
          photo={currentPhoto}
          boxes={boxes}
          mode={mode}
          onMarkerCreate={handleCreate}
          onMarkerPress={openBox}
          maxSize={{
            width: Math.max(0, canvasSize.width - AppSpacing.lg * 2),
            height: Math.max(0, canvasSize.height - AppSpacing.sm - 28),
          }}
        />
      </View>

      <ModalSheet
        visible={!!activeBox}
        title={activeBox ? formatBoxCode(activeBox) : '箱子'}
        onClose={() => setActiveBoxId(null)}>
        {activeBox ? (
          <View style={styles.sheetContent}>
            <BoxMetaEditor
              key={activeBox.id}
              box={activeBox}
              sourceRooms={lookups.sourceRooms}
              destinationRooms={lookups.destinationRooms}
              onSave={(input) => updateBox(activeBox.id, input)}
            />

            <Text style={styles.label}>物品（{activeItems.length}）</Text>
            {activeItems.length === 0 ? (
              <Text style={styles.emptyItems}>这只箱子还是空的</Text>
            ) : (
              activeItems.map((item) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  onSave={(name, quantity) =>
                    updateItem(item.id, {
                      name,
                      quantity,
                      originalLocation: item.originalLocation,
                      destinationLocation: item.destinationLocation,
                      boxId: item.boxId,
                      action: item.action,
                      note: item.note,
                    })
                  }
                  onDelete={() => deleteItem(item.id)}
                />
              ))
            )}

            <View style={styles.addItemRow}>
              <TextInput
                style={styles.input}
                placeholder="添加物品…"
                placeholderTextColor={AppColors.textMuted}
                value={itemName}
                onChangeText={setItemName}
                onSubmitEditing={addOneItem}
                returnKeyType="done"
              />
              <PrimaryButton compact label="添加" onPress={addOneItem} />
            </View>

            <View style={styles.destructiveActions}>
              <TextButton label="从照片移除标注" tone="danger" onPress={confirmRemoveFromPhoto} />
              <TextButton label="删除箱子" tone="danger" onPress={confirmDeleteBox} />
            </View>
          </View>
        ) : null}
      </ModalSheet>
    </SafeAreaView>
  );
}

function ItemEditor({
  item,
  onSave,
  onDelete,
}: {
  item: MovingItem;
  onSave: (name: string, quantity: number) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);

  function saveName() {
    const nextName = name.trim();
    if (!nextName) {
      setName(item.name);
      return;
    }
    if (nextName !== item.name) onSave(nextName, item.quantity);
  }

  function changeQuantity(quantity: number) {
    saveName();
    onSave(name.trim() || item.name, Math.max(1, quantity));
  }

  return (
    <View style={styles.itemRow}>
      <TextInput
        style={styles.itemInput}
        value={name}
        onChangeText={setName}
        onBlur={saveName}
        onSubmitEditing={saveName}
        returnKeyType="done"
      />
      <View style={styles.quantityControl}>
        <Pressable
          accessibilityLabel="减少数量"
          hitSlop={6}
          style={styles.quantityButtonTarget}
          onPress={() => changeQuantity(item.quantity - 1)}>
          <Text style={styles.quantityButton}>−</Text>
        </Pressable>
        <Text style={styles.quantityValue}>{item.quantity}</Text>
        <Pressable
          accessibilityLabel="增加数量"
          hitSlop={6}
          style={styles.quantityButtonTarget}
          onPress={() => changeQuantity(item.quantity + 1)}>
          <Text style={styles.quantityButton}>＋</Text>
        </Pressable>
      </View>
      <TextButton label="删" tone="danger" onPress={onDelete} />
    </View>
  );
}

function BoxMetaEditor({
  box,
  sourceRooms,
  destinationRooms,
  onSave,
}: {
  box: MovingBox;
  sourceRooms: { id: string; name: string }[];
  destinationRooms: { id: string; name: string }[];
  onSave: (input: {
    name: string;
    sourceRoomId: string;
    destinationRoomId: string;
    note?: string;
  }) => void;
}) {
  const [name, setName] = useState(box.name);
  const [sourceRoomId, setSourceRoomId] = useState(box.sourceRoomId);
  const [destinationRoomId, setDestinationRoomId] = useState(box.destinationRoomId);

  function save() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      sourceRoomId,
      destinationRoomId,
      note: box.note,
    });
  }

  return (
    <View style={styles.metaEditor}>
      <Text style={styles.label}>箱子名</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        onBlur={save}
        returnKeyType="done"
      />

      <Text style={styles.label}>从哪个房间搬出</Text>
      <View style={styles.choiceRow}>
        {sourceRooms.map((room) => (
          <ChoiceChip
            key={room.id}
            label={room.name}
            selected={room.id === sourceRoomId}
            onPress={() => {
              setSourceRoomId(room.id);
              onSave({
                name: name.trim() || box.name,
                sourceRoomId: room.id,
                destinationRoomId,
                note: box.note,
              });
            }}
          />
        ))}
      </View>

      <Text style={styles.label}>搬到哪个房间</Text>
      <View style={styles.choiceRow}>
        {destinationRooms.map((room) => (
          <ChoiceChip
            key={room.id}
            label={room.name}
            selected={room.id === destinationRoomId}
            onPress={() => {
              setDestinationRoomId(room.id);
              onSave({
                name: name.trim() || box.name,
                sourceRoomId,
                destinationRoomId: room.id,
                note: box.note,
              });
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeChip, active && styles.modeChipActive]} hitSlop={6}>
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: AppColors.background },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.md,
    backgroundColor: AppColors.background,
  },
  missingTitle: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
  },
  headerControl: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  back: { color: AppColors.primary, fontSize: 16, fontWeight: '700' },
  title: { flex: 1, marginHorizontal: AppSpacing.md, color: AppColors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  danger: { color: AppColors.danger, fontSize: 15, fontWeight: '700' },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: AppSpacing.sm,
    paddingVertical: AppSpacing.sm,
  },
  modeChip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: AppColors.surface,
  },
  modeChipActive: { borderColor: AppColors.primary, backgroundColor: AppColors.primarySoft },
  modeChipText: { color: AppColors.textMuted, fontSize: 13, fontWeight: '700' },
  modeChipTextActive: { color: AppColors.primary },
  canvasArea: { flex: 1, paddingHorizontal: AppSpacing.lg, paddingTop: AppSpacing.sm },
  sheetContent: { gap: AppSpacing.md },
  metaEditor: { gap: AppSpacing.sm },
  label: { color: AppColors.textMuted, fontSize: 12, fontWeight: '700' },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: AppRadius.md,
    paddingHorizontal: AppSpacing.md,
    backgroundColor: AppColors.surface,
    color: AppColors.text,
    fontSize: 15,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  emptyItems: { color: AppColors.textMuted, fontSize: 13, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  itemInput: {
    flex: 1,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
    color: AppColors.text,
    fontSize: 15,
  },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quantityButtonTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: { color: AppColors.primary, fontSize: 20, fontWeight: '700' },
  quantityValue: { minWidth: 18, color: AppColors.text, fontSize: 14, textAlign: 'center' },
  addItemRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  destructiveActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: AppSpacing.sm,
    paddingTop: AppSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppColors.border,
  },
});
