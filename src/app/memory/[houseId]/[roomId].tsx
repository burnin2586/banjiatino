import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloorplanCanvas } from '@/components/memory/floorplan-canvas';
import { LoadingScreen, ModalSheet, PrimaryButton } from '@/components/ui-kit';
import { AppColors, AppSpacing } from '@/constants/app-theme';
import { useMemory } from '@/context/memory-context';
import type { RoomPhoto, Wall } from '@/types/memory';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomEditor'>;

export default function RoomEditorScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
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
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      const uri = result.assets?.[0]?.uri;
      if (result.didCancel || !uri) return;
      await addPhoto(room!.id, wallId, uri, 0.5);
    } catch (error) {
      console.warn('选择房间照片失败。', error);
      Alert.alert('无法打开相册', '请稍后重试。');
    }
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
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.headerControl}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.title}>{room.name}</Text>
        <Pressable accessibilityRole="button" onPress={openNote} style={styles.headerControl}>
          <Text style={styles.noteBtn}>备注</Text>
        </Pressable>
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
            <Pressable
              accessibilityRole="button"
              style={styles.deleteControl}
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
              }>
              <Text style={styles.deleteText}>删除这张照片</Text>
            </Pressable>
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
  headerControl: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  back: { color: AppColors.primary, fontSize: 16, fontWeight: '700' },
  title: {
    flex: 1,
    marginHorizontal: AppSpacing.sm,
    color: AppColors.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
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
  deleteControl: { minHeight: 44, justifyContent: 'center' },
  deleteText: { color: AppColors.danger, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
