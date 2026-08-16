import { buildInvitationUrl, parseInvitationUrl } from './invite-links';

const host = 'https://move.example.com';

describe('parseInvitationUrl', () => {
  it('accepts an exact HTTPS invitation link', () => {
    expect(parseInvitationUrl(`${host}/invite/AbCdEf1234567890_-x`, host)).toEqual({
      token: 'AbCdEf1234567890_-x',
    });
  });

  it('rejects non-HTTPS custom schemes', () => {
    expect(parseInvitationUrl(`move.example.com:/invite/token`, host)).toBeNull();
    expect(parseInvitationUrl(`banjiatino://invite/token`, host)).toBeNull();
  });

  it('rejects a different host', () => {
    expect(parseInvitationUrl(`https://evil.example.com/invite/token`, host)).toBeNull();
    expect(parseInvitationUrl(`https://sub.move.example.com/invite/token`, host)).toBeNull();
  });

  it('rejects empty and malformed tokens', () => {
    expect(parseInvitationUrl(`${host}/invite/`, host)).toBeNull();
    expect(parseInvitationUrl(`${host}/invite/has space`, host)).toBeNull();
    expect(parseInvitationUrl(`${host}/invite/bad+chars!`, host)).toBeNull();
  });

  it('rejects tokens in query strings and fragments', () => {
    expect(parseInvitationUrl(`${host}/invite?token=abc`, host)).toBeNull();
    expect(parseInvitationUrl(`${host}/invite/abc?extra=1`, host)).toBeNull();
    expect(parseInvitationUrl(`${host}/invite/abc#frag`, host)).toBeNull();
  });

  it('rejects other paths', () => {
    expect(parseInvitationUrl(`${host}/join/abc`, host)).toBeNull();
    expect(parseInvitationUrl(`${host}/invite/abc/extra`, host)).toBeNull();
    expect(parseInvitationUrl(`${host}`, host)).toBeNull();
  });
});

describe('buildInvitationUrl', () => {
  it('round-trips with the parser', () => {
    const url = buildInvitationUrl(host, 'roundTrip_TOKEN-42');
    expect(url).toBe(`${host}/invite/roundTrip_TOKEN-42`);
    expect(parseInvitationUrl(url, host)).toEqual({ token: 'roundTrip_TOKEN-42' });
  });
});
