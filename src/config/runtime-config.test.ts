import { getRuntimeConfig } from '@/config/runtime-config';

const validEnvironment = {
  SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo',
  INVITE_BASE_URL: 'https://move.example.com',
};

describe('getRuntimeConfig', () => {
  it('rejects a missing Supabase publishable key', () => {
    expect(() => getRuntimeConfig({ SUPABASE_URL: 'https://demo.supabase.co' })).toThrow(
      'SUPABASE_PUBLISHABLE_KEY',
    );
  });

  it('accepts HTTPS URLs and a publishable Supabase key', () => {
    expect(getRuntimeConfig(validEnvironment)).toEqual({
      supabaseUrl: 'https://demo.supabase.co',
      supabasePublishableKey: 'sb_publishable_demo',
      inviteBaseUrl: 'https://move.example.com',
    });
  });

  it.each([
    'http://demo.supabase.co',
    'not a URL',
  ])('rejects an insecure or malformed Supabase URL: %s', (supabaseUrl) => {
    expect(() => getRuntimeConfig({ ...validEnvironment, SUPABASE_URL: supabaseUrl })).toThrow(
      'SUPABASE_URL',
    );
  });

  it.each([
    'http://move.example.com',
    'not a URL',
  ])('rejects an insecure or malformed invitation URL: %s', (inviteBaseUrl) => {
    expect(() => getRuntimeConfig({ ...validEnvironment, INVITE_BASE_URL: inviteBaseUrl })).toThrow(
      'INVITE_BASE_URL',
    );
  });

  it('rejects a key that is not a Supabase publishable key', () => {
    expect(() => getRuntimeConfig({ ...validEnvironment, SUPABASE_PUBLISHABLE_KEY: 'service_role_demo' })).toThrow(
      'SUPABASE_PUBLISHABLE_KEY',
    );
  });
});
