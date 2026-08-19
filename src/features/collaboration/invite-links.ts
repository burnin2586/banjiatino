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

const BARE_TOKEN = /^[A-Za-z0-9_-]+$/;

/**
 * Accepts a pasted value that is either a full invitation URL or a bare token, so the
 * manual-join input works both from a shared link and a copied code.
 */
export function extractInvitationToken(input: string, inviteBaseUrl: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.includes('://') || trimmed.startsWith('https:')) {
    const parsed = parseInvitationUrl(trimmed, inviteBaseUrl);
    return parsed?.token ?? null;
  }

  if (!BARE_TOKEN.test(trimmed)) return null;
  if (trimmed.includes('.') || trimmed.includes('/')) return null;
  return trimmed;
}
