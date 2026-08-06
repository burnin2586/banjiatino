import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloorplanCanvas } from '@/components/memory/floorplan-canvas';
import { LoadingScreen, ModalSheet, PrimaryButton } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';
import type { RoomPhoto, Wall } from '@/types/memory';

export default function RoomEditorScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const {
    state,
    isLoading,
    addWall,
    removeWall,
    addPhoto,
    updatePhotoCaption,
    removePhoto,
    updateRoom,
  } = useMemory();
  const room = state.rooms.find((r) => r.id === roomId);

  const [activePhoto, setActivePhoto] = useState<RoomPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  if (isLoading || !room) return <LoadingScreen label="正在打开房间…" />;

  async function pickAndAdd(wallId: string) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await addPhoto(room!.id, wallId, result.assets[0].uri, 0.5);
  }

  function openPhoto(p: RoomPhoto) {
    setActivePhoto(p);
    setCaption(p.caption ?? '');
  }

  function saveCaption() {
    if (activePhoto) updatePhotoCaption(room!.id, activePhoto.id, caption);
    setActivePhoto(null);
  }

  function openNote() {
    setNoteDraft(room!.note ?? '');
    setNoteVisible(true);
  }

  function saveNote() {
    updateRoom(room!.id, { name: room!.name, color: room!.color, note: noteDraft });
    setNoteVisible(false);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: AppColors.background }}>
      <View style={styles.header}>
        <Text onPress={() => router.back()} style={styles.back}>‹ 返回</Text>
        <Text style={styles.title}>{room.name}</Text>
        <Text onPress={openNote} style={styles.noteBtn}>备注</Text>
      </View>

      <View style={{ flex: 1, padding: AppSpacing.lg }}>
        <FloorplanCanvas
          room={room}
          onAddPhoto={pickAndAdd}
          onPhotoPress={openPhoto}
          onWallAdd={(w: Wall) => addWall(room.id, w)}
          onWallRemove={(id) => removeWall(room.id, id)}
        />
        {room.note ? <Text style={styles.notePreview}>房间备注：{room.note}</Text> : null}
      </View>

      <ModalSheet visible={!!activePhoto} title="照片回忆" onClose={() => setActivePhoto(null)}>
        {activePhoto ? (
          <View style={{ gap: AppSpacing.md }}>
            <Text style={styles.label}>这一张的故事</Text>
            <TextInput
              style={styles.input}
              multiline
              autoFocus
              placeholder="在这里发生过的、你想记住的事……"
              placeholderTextColor={AppColors.textMuted}
              textAlignVertical="top"
              value={caption}
              onChangeText={setCaption}
            />
            <PrimaryButton label="保存回忆" onPress={saveCaption} />
            <Text
              style={styles.deleteText}
              onPress={() =>
                Alert.alert('删除这张照片？', undefined, [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                      const id = activePhoto.id;
                      setActivePhoto(null);
                      void removePhoto(room.id, id);
                    },
                  },
                ])
              }
            >
              删除这张照片
            </Text>
          </View>
        ) : null}
      </ModalSheet>

      <ModalSheet visible={noteVisible} title="房间备注" onClose={() => setNoteVisible(false)}>
        <View style={{ gap: AppSpacing.md }}>
          <TextInput
            style={styles.input}
            multiline
            placeholder="这个房间整体给你的感觉……"
            placeholderTextColor={AppColors.textMuted}
            textAlignVertical="top"
            value={noteDraft}
            onChangeText={setNoteDraft}
          />
          <PrimaryButton label="保存备注" onPress={saveNote} />
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
  },
  back: { color: AppColors.primary, fontSize: 16, fontWeight: '700' },
  title: { color: AppColors.text, fontSize: 17, fontWeight: '800' },
  noteBtn: { color: AppColors.primary, fontSize: 15, fontWeight: '700' },
  label: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  notePreview: { color: AppColors.textMuted, fontSize: 13, lineHeight: 19, marginTop: AppSpacing.md },
  deleteText: { color: '#B4483D', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
