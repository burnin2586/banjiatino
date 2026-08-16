import { getSyncBannerProps } from './sync-banner-presentation';

describe('getSyncBannerProps', () => {
  it('renders nothing when everything is synchronized', () => {
    expect(getSyncBannerProps({ pending: 0, failed: 0, needsAttention: 0 })).toBeNull();
  });

  it('renders a pending count without an action', () => {
    const props = getSyncBannerProps({ pending: 3, failed: 0, needsAttention: 0 });
    expect(props).toEqual({
      label: '3 项待同步',
      tone: 'pending',
      accessibilityLabel: '同步状态：3 项待同步',
    });
  });

  it('prioritizes the retry action when failures exist', () => {
    const props = getSyncBannerProps({ pending: 2, failed: 1, needsAttention: 0 });
    expect(props).toMatchObject({
      tone: 'failed',
      actionLabel: '重试',
    });
    expect(props?.label).toContain('同步失败，点按重试');
    expect(props?.label).toContain('2 项待同步');
  });

  it('reports needs_attention with its own count', () => {
    const props = getSyncBannerProps({ pending: 0, failed: 0, needsAttention: 4 });
    expect(props).toEqual({
      label: '4 项需要处理',
      tone: 'attention',
      accessibilityLabel: '同步状态：4 项需要处理',
    });
  });
});
