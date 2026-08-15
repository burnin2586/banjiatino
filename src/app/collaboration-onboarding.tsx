import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PageHeader, PrimaryButton, Screen, TextButton } from '@/components/ui-kit';
import { AppColors, AppRadius, AppSpacing, AppTypography } from '@/constants/app-theme';
import { useSession } from '@/context/session-context';

export function CollaborationOnboardingScreen() {
  const { status, retry, submit } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [importLegacyData, setImportLegacyData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = displayName.trim().length > 0 && projectName.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submit({
        displayName: displayName.trim(),
        projectName: projectName.trim(),
        movingDateMs: null,
        importLegacyData,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <Screen>
        <PageHeader title="开启家庭搬家协作" />
        <Card>
          <Text style={styles.hint}>不用注册，创建后把邀请链接发给家人即可一起整理。</Text>

          <Text style={styles.label}>你的称呼</Text>
          <TextInput
            accessibilityLabel="你的称呼"
            style={styles.input}
            placeholder="例如：阿伦"
            placeholderTextColor={AppColors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={80}
          />

          <Text style={styles.label}>搬家项目名称</Text>
          <TextInput
            accessibilityLabel="搬家项目名称"
            style={styles.input}
            placeholder="例如：搬去浦东的新家"
            placeholderTextColor={AppColors.textMuted}
            value={projectName}
            onChangeText={setProjectName}
            maxLength={160}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>导入这台设备上的搬家记录</Text>
            <Switch
              accessibilityLabel="导入这台设备上的搬家记录"
              value={importLegacyData}
              onValueChange={setImportLegacyData}
            />
          </View>

          {status === 'offlineWithoutIdentity' && (
            <Text style={styles.notice}>首次创建需要联网，请连接网络后再试。</Text>
          )}
          {status === 'retryable' && (
            <Text style={styles.notice}>刚才没有成功，请重试一次。</Text>
          )}

          <View style={styles.actions}>
            {submitting ? (
              <ActivityIndicator color={AppColors.primary} size="large" />
            ) : (
              <>
                <PrimaryButton
                  label="创建协作项目"
                  onPress={() => void handleSubmit()}
                  disabled={!canSubmit}
                />
                {status === 'retryable' && <TextButton label="重试" onPress={retry} />}
              </>
            )}
          </View>
        </Card>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: AppColors.background },
  hint: { ...AppTypography.body, color: AppColors.textMuted, marginBottom: AppSpacing.md },
  label: { ...AppTypography.caption, color: AppColors.text, marginTop: AppSpacing.sm },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: AppRadius.control,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: AppSpacing.xs,
    color: AppColors.text,
    backgroundColor: AppColors.white,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: AppSpacing.md,
  },
  switchLabel: { flex: 1, ...AppTypography.body, color: AppColors.text, marginRight: AppSpacing.sm },
  notice: { ...AppTypography.caption, color: AppColors.danger, marginTop: AppSpacing.md },
  actions: { marginTop: AppSpacing.lg, gap: AppSpacing.sm },
});
