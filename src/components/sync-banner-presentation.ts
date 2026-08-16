export type SyncBannerTone = 'pending' | 'failed' | 'attention';

export type SyncBannerProps = {
  label: string;
  tone: SyncBannerTone;
  actionLabel?: string;
  accessibilityLabel: string;
};

export type SyncBannerCounts = {
  pending: number;
  failed: number;
  needsAttention: number;
};

/**
 * Failure-only banner presentation. Fully synchronized projects render nothing;
 * retryable failures expose a retry action with accessibility labels.
 */
export function getSyncBannerProps(counts: SyncBannerCounts): SyncBannerProps | null {
  const { pending, failed, needsAttention } = counts;

  if (pending === 0 && failed === 0 && needsAttention === 0) return null;

  const parts: string[] = [];
  if (failed > 0) parts.push('同步失败，点按重试');
  if (pending > 0) parts.push(`${pending} 项待同步`);
  if (needsAttention > 0) parts.push(`${needsAttention} 项需要处理`);

  return {
    label: parts.join(' · '),
    tone: failed > 0 ? 'failed' : needsAttention > 0 ? 'attention' : 'pending',
    ...(failed > 0 ? { actionLabel: '重试' } : {}),
    accessibilityLabel: `同步状态：${parts.join('，')}`,
  };
}
