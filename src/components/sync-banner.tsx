import { Pressable, StyleSheet, Text } from 'react-native';

import { AppColors, AppRadius, AppSpacing, AppTypography } from '@/constants/app-theme';
import { useSyncStatus } from '@/context/sync-context';
import { getSyncBannerProps } from './sync-banner-presentation';

/** Failure-only banner wired to the sync status context; invisible when fully synced. */
export function SyncBanner() {
  const { pending, failed, needsAttention, retry } = useSyncStatus();
  const props = getSyncBannerProps({ pending, failed, needsAttention });
  if (!props) return null;

  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.actionLabel ? retry : undefined}
      style={[styles.banner, props.tone === 'failed' && styles.failed]}>
      <Text style={styles.label}>{props.label}</Text>
      {props.actionLabel ? <Text style={styles.action}>{props.actionLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: AppRadius.control,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    marginBottom: AppSpacing.sm,
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  failed: {
    borderColor: AppColors.danger,
  },
  label: { ...AppTypography.caption, color: AppColors.text },
  action: { ...AppTypography.caption, color: AppColors.primary, fontWeight: '700' },
});
