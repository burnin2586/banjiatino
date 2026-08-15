import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import Config from 'react-native-config';

import { getRuntimeConfig } from '@/config/runtime-config';
import { KeychainAuthStorage } from './keychain-auth-storage';

let sharedClient: SupabaseClient | undefined;

/**
 * Creates the Supabase client with React Native guidance applied: Keychain-backed session
 * storage, auto refresh while foregrounded, no URL session detection.
 */
export function createSupabaseClient(): SupabaseClient {
  const runtimeConfig = getRuntimeConfig({
    SUPABASE_URL: Config.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: Config.SUPABASE_PUBLISHABLE_KEY,
    INVITE_BASE_URL: Config.INVITE_BASE_URL,
  });

  const client = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
    auth: {
      storage: new KeychainAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  AppState.addEventListener('change', state => {
    if (state === 'active') {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  });

  return client;
}

export function getSupabaseClient(): SupabaseClient {
  if (!sharedClient) {
    sharedClient = createSupabaseClient();
  }
  return sharedClient;
}

/** Test hook: inject a client so Jest never touches native modules or the network. */
export function setSupabaseClientForTesting(client: SupabaseClient | undefined): void {
  sharedClient = client;
}
