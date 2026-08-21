import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import Config from 'react-native-config';

import { Card, PrimaryButton } from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing, AppTypography } from '@/constants/app-theme';
import { useSession } from '@/context/session-context';
import { buildInvitationUrl } from '@/features/collaboration/invite-links';
import { InvitationGateway } from '@/features/collaboration/invitation-gateway';
import { getSupabaseClient } from '@/services/supabase/client';

/** Home entry that creates a 7-day invitation link and opens the system share sheet. */
export function InviteFamilyCard() {
  const { currentProjectId } = useSession();
  const [busy, setBusy] = useState(false);

  if (!currentProjectId) return null;

  const handleInvite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const gateway = new InvitationGateway(getSupabaseClient());
      const { token } = await gateway.createInvitation(currentProjectId);
      const url = buildInvitationUrl(Config.INVITE_BASE_URL ?? '', token);

      await Share.share({
        message: `来和我一起整理搬家吧，点这个链接加入：\n${url}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(
        '邀请生成失败',
        /network|fetch|timed?\s*out|connection/i.test(message)
          ? '生成邀请需要联网，请检查网络后重试。'
          : '刚才没有成功，请稍后再试。',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.title}>家庭协作</Text>
          <Text style={styles.hint}>邀请家人加入后，箱子、物品和任务会自动保持同步。</Text>
        </View>
        <PrimaryButton label={busy ? '生成中…' : '邀请家人'} onPress={() => void handleInvite()} disabled={busy} compact />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md },
  text: { flex: 1 },
  title: { ...AppTypography.label, color: AppColors.text },
  hint: { ...AppTypography.caption, color: AppColors.textMuted, marginTop: 2 },
});
