import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PageHeader, PrimaryButton, Screen, TextButton } from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing, AppTypography } from '@/constants/app-theme';
import { useSession } from '@/context/session-context';
import {
  classifyInvitationError,
  InvitationGateway,
  type InvitationFailureCode,
} from '@/features/collaboration/invitation-gateway';
import { ensureAnonymousSession, saveCachedProject } from '@/services/supabase/bootstrap-ports';
import { getSupabaseClient } from '@/services/supabase/client';

type JoinState =
  | { phase: 'joining' }
  | { phase: 'needName' }
  | { phase: 'joined'; projectName: string }
  | { phase: 'failed'; code: InvitationFailureCode };

const FAILURE_COPY: Record<InvitationFailureCode, string> = {
  expired: '这个邀请链接已过期（7 天有效），请让家人重新生成一个。',
  revoked: '这个邀请链接已被撤销，请让家人重新发送。',
  not_found: '没有找到对应的搬家项目，请确认链接完整。',
  archived: '这个搬家项目已归档，无法加入。',
  offline: '加入需要联网，请检查网络后重试。',
  unknown: '加入没有成功，请重试一次。',
};

export function JoinProjectScreen({ token, onFinished }: { token: string; onFinished: () => void }) {
  const { retry } = useSession();
  const [state, setState] = useState<JoinState>({ phase: 'joining' });
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const accept = useCallback(async (name?: string) => {
    setSubmitting(true);
    try {
      const client = getSupabaseClient();
      const gateway = new InvitationGateway(client);
      await ensureAnonymousSession(client);

      const { data: profile } = await client
        .from('profiles')
        .select('display_name')
        .maybeSingle();
      if (!profile && !name) {
        setState({ phase: 'needName' });
        return;
      }

      const { projectId } = await gateway.acceptInvitation(token, name);
      const { data: project } = await getSupabaseClient()
        .from('moving_projects')
        .select('name')
        .eq('id', projectId)
        .single();
      await saveCachedProject(projectId);
      setState({ phase: 'joined', projectName: (project?.name as string | undefined) ?? '搬家项目' });
    } catch (error) {
      setState({ phase: 'failed', code: classifyInvitationError(error) });
    } finally {
      setSubmitting(false);
    }
  }, [token]);

  useEffect(() => {
    void accept();
  }, [accept]);

  const enterProject = useCallback(() => {
    retry();
    onFinished();
  }, [onFinished, retry]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <Screen>
        <PageHeader title="加入家庭搬家" />
        <Card>
          {state.phase === 'joining' && (
            <View style={styles.center}>
              <ActivityIndicator color={AppColors.primary} size="large" />
              <Text style={styles.body}>正在验证邀请…</Text>
            </View>
          )}

          {state.phase === 'failed' && (
            <View>
              <Text style={styles.notice}>{FAILURE_COPY[state.code]}</Text>
              {(state.code === 'offline' || state.code === 'unknown') && (
                <PrimaryButton
                  label="重试"
                  onPress={() => {
                    setState({ phase: 'joining' });
                    void accept(displayName.trim() || undefined);
                  }}
                  disabled={submitting}
                />
              )}
            </View>
          )}

          {state.phase === 'needName' && (
            <View>
              <Text style={styles.body}>先告诉我怎么称呼你。</Text>
              <TextInput
                accessibilityLabel="你的称呼"
                style={styles.input}
                placeholder="例如：妈妈"
                placeholderTextColor={AppColors.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={80}
              />
              <PrimaryButton
                label="加入项目"
                onPress={() => void accept(displayName.trim() || undefined)}
                disabled={submitting || displayName.trim().length === 0}
              />
            </View>
          )}

          {state.phase === 'joined' && (
            <View>
              <Text style={styles.body}>
                已加入「{state.projectName}」，现在可以和家人一起整理了。
              </Text>
              <PrimaryButton label="进入项目" onPress={enterProject} />
            </View>
          )}
        </Card>
        <TextButton label="返回" onPress={onFinished} />
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: AppColors.background },
  center: { alignItems: 'center', gap: AppSpacing.md, paddingVertical: AppSpacing.lg },
  body: { ...AppTypography.body, color: AppColors.text },
  notice: { ...AppTypography.body, color: AppColors.danger, marginBottom: AppSpacing.md },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: AppRadius.control,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: AppSpacing.sm,
    marginBottom: AppSpacing.md,
    color: AppColors.text,
    backgroundColor: AppColors.white,
  },
});
