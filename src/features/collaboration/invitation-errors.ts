/** Rejections the join flow distinguishes for copy and retry behavior. */
export type InvitationFailureCode =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'archived'
  | 'offline'
  | 'unknown';

export function classifyInvitationError(error: unknown): InvitationFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/network|fetch|timed?\s*out|connection/i.test(message)) return 'offline';
  if (/revoked/i.test(message)) return 'revoked';
  if (/expired/i.test(message)) return 'expired';
  if (/archived/i.test(message)) return 'archived';
  if (/not found/i.test(message)) return 'not_found';
  return 'unknown';
}
