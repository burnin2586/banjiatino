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
import { INVITATION_FAILURE_COPY } from '@/features/collaboration/invitation-copy';
import type { InvitationFailureCode } from '@/features/collaboration/invitation-errors';
import { createSupabaseJoinFlowPorts } from '@/features/collaboration/join-flow-supabase';
import { joinProjectWithToken } from '@/features/collaboration/join-flow';

type JoinState =
  | { phase: 'joining' }
  | { phase: 'needName' }
  | { phase: 'joined'; projectName: string }
  | { phase: 'failed'; code: InvitationFailureCode };

export function JoinProjectScreen({ token, onFinished }: { token: string; onFinished: () => void }) {
  const { retry } = useSession();
  const [state, setState] = useState<JoinState>({ phase: 'joining' });
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const accept = useCallback(async (name?: string) => {
    setSubmitting(true);
    try {
      const outcome = await joinProjectWithToken(createSupabaseJoinFlowPorts(), {
        token,
        ...(name !== undefined ? { displayName: name } : {}),
      });
      if (outcome.status === 'joined') {
        setState({ phase: 'joined', projectName: outcome.projectName });
      } else if (outcome.status === 'needName') {
        setState({ phase: 'needName' });
      } else {
        setState({ phase: 'failed', code: outcome.code });
      }
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
              <Text style={styles.notice}>{INVITATION_FAILURE_COPY[state.code]}</Text>
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
