import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AddButton,
  Card,
  ChoiceChip,
  EmptyState,
  LoadingScreen,
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
import { saveStoragePhoto } from '@/logic/photo-store';
import { BOX_STATUSES, type MovingBox } from '@/types/moving';

export default function BoxesScreen() {
  const {
    state,
    isLoading,
    lookups,
    addBox,
    updateBox,
    deleteBox,
    setBoxStatus,
    addStoragePhoto,
  } = useMoving();
  const sourceRooms = lookups.sourceRooms;
  const destinationRooms = lookups.destinationRooms;
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sourceRoomId, setSourceRoomId] = useState(sourceRooms[0]?.id ?? '');
  const [destinationRoomId, setDestinationRoomId] = useState(
    destinationRooms[0]?.id ?? '',
  );
  const [note, setNote] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  const sortedBoxes = useMemo(
    () => [...state.boxes].sort((a, b) => b.updatedAt - a.updatedAt),
    [state.boxes],
  );

  useEffect(() => {
    let isMounted = true;
    async function restorePendingPickerResult() {
      try {
        const result = await ImagePicker.getPendingResultAsync();
        if (!isMounted || !result || !('canceled' in result) || result.canceled) return;
        const asset = result.assets?.[0];
        if (!asset) return;
        setIsSavingPhoto(true);
        const fileId = `storage-${Date.now()}`;
        const uri = await saveStoragePhoto(asset.uri, fileId);
        if (!isMounted) return;
        const id = addStoragePhoto(uri);
        router.push(`/storage/${id}` as Href);
      } catch (error) {
        console.warn('恢复待处理的收纳照片失败。', error);
        if (isMounted) Alert.alert('照片恢复失败', '请重新拍照或选择照片。');
      } finally {
        if (isMounted) setIsSavingPhoto(false);
      }
    }
    void restorePendingPickerResult();
    return () => {
      isMounted = false;
    };
  }, [addStoragePhoto]);

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
    const contents = lookups.itemsByBox.get(box.id) ?? [];
    const detail =
      contents.length > 0
        ? `箱内 ${contents.length} 类物品会保留，但将变为“未分配箱子”。`
        : '这是一只空箱子。';
    Alert.alert('删除这个箱子？', `${box.code} · ${box.name}\n${detail}`, [
      { text: '取消', style: 'cancel' },
      { text: '确认删除', style: 'destructive', onPress: () => deleteBox(box.id) },
    ]);
  }

  async function savePickedPhoto(sourceUri: string) {
    setIsSavingPhoto(true);
    try {
      const fileId = `storage-${Date.now()}`;
      const uri = await saveStoragePhoto(sourceUri, fileId);
      const id = addStoragePhoto(uri);
      router.push(`/storage/${id}` as Href);
    } catch (error) {
      console.warn('保存收纳照片失败。', error);
      Alert.alert('照片保存失败', '请确认设备有足够空间，然后重试。');
    } finally {
      setIsSavingPhoto(false);
    }
  }

  async function pickFromLibrary() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) await savePickedPhoto(asset.uri);
    } catch (error) {
      console.warn('选择收纳照片失败。', error);
      Alert.alert('无法打开相册', '请稍后重试。');
    }
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要相机权限', '允许访问相机后才能拍摄收纳照片。');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) await savePickedPhoto(asset.uri);
    } catch (error) {
      console.warn('拍摄收纳照片失败。', error);
      Alert.alert('无法拍照', '请稍后重试。');
    }
  }

  function choosePhotoSource() {
    Alert.alert('添加收纳照片', '选择照片来源', [
      { text: '取消', style: 'cancel' },
      { text: '从相册选择', onPress: () => void pickFromLibrary() },
      { text: '拍照', onPress: () => void takePhoto() },
    ]);
  }

  if (isLoading) {
    return <LoadingScreen />;
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
          <SectionTitle title="收纳照片" detail={`${state.storagePhotos.length} 张`} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="拍照或选择收纳照片"
              disabled={isSavingPhoto}
              style={[styles.addPhotoCard, isSavingPhoto && styles.photoCardDisabled]}
              onPress={choosePhotoSource}>
              <Text style={styles.addPlus}>＋</Text>
              <Text style={styles.addLabel}>{isSavingPhoto ? '保存中…' : '拍照收纳'}</Text>
            </Pressable>
            {state.storagePhotos.map((photo) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={photo.title || '打开收纳照片'}
                key={photo.id}
                style={styles.photoCard}
                onPress={() => router.push(`/storage/${photo.id}` as Href)}>
                <Image source={photo.imageUri} style={styles.photoThumb} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>

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
                const sourceRoom = lookups.roomById.get(box.sourceRoomId);
                const destinationRoom = lookups.roomById.get(box.destinationRoomId);
                const contents = lookups.itemsByBox.get(box.id) ?? [];
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
  photoStrip: { gap: AppSpacing.md, paddingRight: AppSpacing.lg },
  addPhotoCard: {
    width: 96,
    height: 96,
    borderRadius: AppRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surface,
  },
  photoCardDisabled: { opacity: 0.55 },
  addPlus: { color: AppColors.primary, fontSize: 28, fontWeight: '400' },
  addLabel: { color: AppColors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  photoCard: { width: 96, height: 96, borderRadius: AppRadius.md, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
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
