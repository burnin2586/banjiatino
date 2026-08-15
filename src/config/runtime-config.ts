export type RuntimeEnvironment = Record<string, string | undefined>;

export type RuntimeConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  inviteBaseUrl: string;
};

function requireHttpsUrl(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  try {
    const url = new URL(value) as URL & { protocol: string };

    if (url.protocol !== 'https:') {
      throw new Error(`${name} must use HTTPS`);
    }
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL`);
  }

  return value;
}

export function getRuntimeConfig(env: RuntimeEnvironment): RuntimeConfig {
  const supabaseUrl = requireHttpsUrl(env.SUPABASE_URL, 'SUPABASE_URL');
  const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabasePublishableKey?.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_PUBLISHABLE_KEY must be a publishable key');
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    inviteBaseUrl: requireHttpsUrl(env.INVITE_BASE_URL, 'INVITE_BASE_URL'),
  };
}

export function getRuntimeConfigFromNativeConfig(): RuntimeConfig {
  const nativeConfig = require('react-native-config').default as RuntimeEnvironment;
  return getRuntimeConfig(nativeConfig);
}
