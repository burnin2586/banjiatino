import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  EmptyState,
  ModalSheet,
  PrimaryButton,
  SectionTitle,
  TextButton,
} from '@/components/ui-kit';
import { AppColors } from '@/constants/app-theme';
import { useMoving } from '@/context/moving-context';
import {
  ROOM_ITEM_TEMPLATES,
  type ItemTemplateEntry,
  type RoomItemTemplate,
} from '@/data/item-templates';
import { matchRoomByName } from '@/logic/item-template';

export function TemplatePicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { state, addItemsFromTemplate } = useMoving();
  const sourceRooms = state.rooms.filter((r) => r.kind === 'source');
  const [selected, setSelected] = useState<RoomItemTemplate | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const hasSourceRoom = sourceRooms.length > 0;
  const entries: ItemTemplateEntry[] = selected ? selected.items : [];
  const checkedEntries = entries.filter(
    (_, i) => checked[`${selected!.roomName}-${i}`] !== false,
  );

  function reset() {
    setSelected(null);
    setChecked({});
  }

  function close() {
    reset();
    onClose();
  }

  function importSelected() {
    if (!selected || checkedEntries.length === 0) return;
    addItemsFromTemplate(checkedEntries, selected.roomName);
    close();
  }

  return (
    <ModalSheet title="从模板添加" visible={visible} onClose={close}>
      {!hasSourceRoom ? (
        <EmptyState
          icon="🏠"
          title="还没有房间"
          description="请先在「搬家作战台」添加一个旧家房间，再回来从模板导入。"
        />
      ) : selected === null ? (
        <>
          <SectionTitle title="选择房间模板" detail={`${ROOM_ITEM_TEMPLATES.length} 个`} />
          {ROOM_ITEM_TEMPLATES.map((tpl) => {
            const ok = matchRoomByName(sourceRooms, tpl.roomName);
            return (
              <Card key={tpl.roomName} style={styles.row}>
                <View style={styles.rowBody}>
                  <Text style={styles.roomName}>{tpl.roomName}</Text>
                  <Text style={styles.rowMeta}>
                    {tpl.items.length} 项{ok ? '' : '（未匹配到同名房间，导入时填入此名）'}
                  </Text>
                </View>
                <TextButton
                  label="选择"
                  onPress={() => {
                    setSelected(tpl);
                    setChecked({});
                  }}
                />
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <SectionTitle
            title={`${selected.roomName} · 预览`}
            detail={`${checkedEntries.length}/${entries.length} 项`}
          />
          {entries.map((e, i) => {
            const key = `${selected.roomName}-${i}`;
            const on = checked[key] !== false;
            return (
              <Pressable
                key={key}
                onPress={() => setChecked((c) => ({ ...c, [key]: !on }))}
                style={[styles.entry, !on && styles.entryOff]}>
                <Text style={[styles.entryName, !on && styles.entryNameOff]}>{e.name}</Text>
                <Text style={styles.entryQty}>×{Math.max(1, e.quantity)}</Text>
              </Pressable>
            );
          })}
          <View style={styles.actions}>
            <TextButton label="返回" onPress={() => setSelected(null)} />
            <PrimaryButton
              compact
              label={`导入 ${checkedEntries.length} 项`}
              onPress={importSelected}
              disabled={checkedEntries.length === 0}
            />
          </View>
        </>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  rowBody: { flex: 1 },
  roomName: { color: AppColors.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: AppColors.textMuted, fontSize: 12, marginTop: 2 },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: AppColors.primarySoft,
  },
  entryOff: { backgroundColor: 'transparent' },
  entryName: { color: AppColors.text, fontSize: 15, fontWeight: '600' },
  entryNameOff: { color: AppColors.textMuted },
  entryQty: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
