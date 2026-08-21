import * as Keychain from 'react-native-keychain';

const SERVICE_PREFIX = 'com.banjiatino.app.supabase-auth';

/**
 * Supabase auth storage adapter backed by the iOS Keychain so refresh tokens never land in
 * plain-text device storage. Each storage key gets its own Keychain service entry.
 */
export class KeychainAuthStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({ service: `${SERVICE_PREFIX}.${key}` });
      return credentials ? credentials.password : null;
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword('supabase-auth', value, {
      service: `${SERVICE_PREFIX}.${key}`,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async removeItem(key: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: `${SERVICE_PREFIX}.${key}` });
    } catch {
      // Removing a missing entry is already the desired end state.
    }
  }
}
