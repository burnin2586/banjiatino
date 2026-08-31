import type { InvitationFailureCode } from './invitation-errors';

/** User-facing copy per join failure, shared by the link screen and manual code entry. */
export const INVITATION_FAILURE_COPY: Record<InvitationFailureCode, string> = {
  expired: '邀请已过期，请重新获取。',
  revoked: '邀请已撤销，请重新获取。',
  not_found: '未找到项目，请检查邀请。',
  archived: '项目已归档，无法加入。',
  offline: '网络不可用，请连接后重试。',
  unknown: '加入失败，请重试。',
};
