import type { InvitationFailureCode } from './invitation-errors';

/** User-facing copy per join failure, shared by the link screen and manual code entry. */
export const INVITATION_FAILURE_COPY: Record<InvitationFailureCode, string> = {
  expired: '这个邀请链接已过期（7 天有效），请让家人重新生成一个。',
  revoked: '这个邀请链接已被撤销，请让家人重新发送。',
  not_found: '没有找到对应的搬家项目，请确认链接完整。',
  archived: '这个搬家项目已归档，无法加入。',
  offline: '加入需要联网，请检查网络后重试。',
  unknown: '加入没有成功，请重试一次。',
};
