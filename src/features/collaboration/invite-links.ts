/**
 * Invitation link parsing. The token travels base64url-encoded in the path of the exact
 * HTTPS invite host — never in queries, fragments, or custom schemes.
 */
const INVITATION_PATH = /^\/invite\/([A-Za-z0-9_-]+)$/;

export type ParsedInvitation = { token: string };

/** RN typings ship without the DOM URL members; the runtime provides them. */
type ParsedUrl = URL & {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
};

export function parseInvitationUrl(url: string, inviteBaseUrl: string): ParsedInvitation | null {
  let parsed: ParsedUrl;
  try {
    parsed = new URL(url) as ParsedUrl;
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  let base: ParsedUrl;
  try {
    base = new URL(inviteBaseUrl) as ParsedUrl;
  } catch {
    return null;
  }
  if (parsed.hostname !== base.hostname) return null;

  const match = INVITATION_PATH.exec(parsed.pathname);
  if (!match) return null;

  if (parsed.search || parsed.hash) return null;

  const token = match[1];
  if (token.length === 0) return null;
  return { token };
}

export function buildInvitationUrl(inviteBaseUrl: string, token: string): string {
  const base = inviteBaseUrl.replace(/\/+$/, '');
  return `${base}/invite/${token}`;
}
