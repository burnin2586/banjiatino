import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  AuthIdentity,
  BootstrapPorts,
  OnboardingInput,
} from '@/features/collaboration/bootstrap';
import {
  LEGACY_MOVING_STORAGE_KEY,
} from '@/features/collaboration/legacy-import';
import { runLegacyImportAtStartup } from '@/features/collaboration/legacy-import-coordinator';
import { migrateStoredState } from '@/logic/moving';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

const CACHED_PROJECT_KEY = 'banjiatino-collaboration-project-v1';

type Client = SupabaseClient;

function toIdentity(user: { id: string } | null): AuthIdentity | null {
  return user ? { userId: user.id } : null;
}

export function ensureAnonymousSession(client: Client): Promise<AuthIdentity> {
  return (async () => {
    const { data } = await client.auth.getSession();
    const existing = toIdentity(data.session?.user ?? null);
    if (existing) return existing;

    const { data: signedIn, error } = await client.auth.signInAnonymously();
    const identity = toIdentity(signedIn.session?.user ?? null);
    if (!identity) {
      throw error ?? new Error('anonymous sign-in returned no session');
    }
    return identity;
  })();
}

export async function createMovingProject(
  client: Client,
  input: OnboardingInput,
): Promise<{ projectId: string }> {
  const { data, error } = await client.rpc('bootstrap_moving_project', {
    project_name: input.projectName,
    profile_display_name: input.displayName,
    project_moving_date: input.movingDateMs === null
      ? null
      : new Date(input.movingDateMs).toISOString().slice(0, 10),
  });

  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('bootstrap_moving_project returned an unexpected result');
  }
  return { projectId: data };
}

export function isOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|failed to fetch|timed?\s?out|connection/i.test(message);
}

async function readLegacyMovingState() {
  const stored = await AsyncStorage.getItem(LEGACY_MOVING_STORAGE_KEY);
  if (stored === null) return null;
  return migrateStoredState(JSON.parse(stored));
}

/**
 * Connects the bootstrap state machine to the real Supabase client, AsyncStorage project
 * cache, and the Task 5 legacy import coordinator.
 */
export async function saveCachedProject(projectId: string): Promise<void> {
  await AsyncStorage.setItem(CACHED_PROJECT_KEY, projectId);
}

export function createBootstrapPorts(client: Client = getSupabaseClient()): BootstrapPorts {
  return {
    restoreSession: async () => {
      const { data } = await client.auth.getSession();
      return toIdentity(data.session?.user ?? null);
    },
    ensureAnonymousSession: () => ensureAnonymousSession(client),
    createProject: input => createMovingProject(client, input),
    loadCachedProjectId: async () => AsyncStorage.getItem(CACHED_PROJECT_KEY),
    saveCachedProjectId: async projectId => {
      await AsyncStorage.setItem(CACHED_PROJECT_KEY, projectId);
    },
    runLegacyImport: (projectId, projectName) =>
      runLegacyImportAtStartup({
        projectId,
        projectName,
        readLegacyMovingState,
      }),
    isOfflineError,
  };
}
