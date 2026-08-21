import type { LegacyImportReceipt } from './legacy-import';

export type AuthIdentity = { userId: string };

export type OnboardingInput = {
  displayName: string;
  projectName: string;
  movingDateMs: number | null;
  importLegacyData: boolean;
};

export type BootstrapOutcome =
  | { status: 'ready'; identity: AuthIdentity; projectId: string; legacyImportRetryable: boolean }
  | { status: 'needsOnboarding' }
  | { status: 'offlineWithCachedProject'; projectId: string }
  | { status: 'offlineWithoutIdentity' }
  | { status: 'retryable'; stage: 'session' | 'project'; error: string };

export type BootstrapPorts = {
  restoreSession: () => Promise<AuthIdentity | null>;
  ensureAnonymousSession: () => Promise<AuthIdentity>;
  createProject: (input: OnboardingInput) => Promise<{ projectId: string }>;
  loadCachedProjectId: () => Promise<string | null>;
  saveCachedProjectId: (projectId: string) => Promise<void>;
  runLegacyImport: (projectId: string, projectName: string) => Promise<LegacyImportReceipt | null>;
  isOfflineError: (error: unknown) => boolean;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Decides where the app starts. Restoring a session and entering a cached project never
 * touches the network; fresh devices stay on the onboarding screen until the user submits,
 * because only the anonymous sign-in attempt can prove the device is offline.
 */
export async function runBootstrap(ports: BootstrapPorts): Promise<BootstrapOutcome> {
  const identity = await ports.restoreSession();
  const cachedProjectId = await ports.loadCachedProjectId();

  if (identity && cachedProjectId) {
    return {
      status: 'ready',
      identity,
      projectId: cachedProjectId,
      legacyImportRetryable: false,
    };
  }

  if (identity) {
    return { status: 'needsOnboarding' };
  }

  if (cachedProjectId) {
    return { status: 'offlineWithCachedProject', projectId: cachedProjectId };
  }

  return { status: 'needsOnboarding' };
}

/**
 * Executes the onboarding submit: anonymous session, remote project creation, local cache
 * write, and legacy import. Every network step can be retried; a retryable legacy import
 * keeps the old local data intact and only flags it for the next startup.
 */
export async function submitOnboarding(
  ports: BootstrapPorts,
  input: OnboardingInput,
): Promise<BootstrapOutcome> {
  let identity: AuthIdentity;
  try {
    identity = await ports.ensureAnonymousSession();
  } catch (error) {
    if (ports.isOfflineError(error)) {
      return { status: 'offlineWithoutIdentity' };
    }
    return { status: 'retryable', stage: 'session', error: describeError(error) };
  }

  let projectId: string;
  try {
    ({ projectId } = await ports.createProject(input));
  } catch (error) {
    return { status: 'retryable', stage: 'project', error: describeError(error) };
  }

  await ports.saveCachedProjectId(projectId);

  let legacyImportRetryable = false;
  if (input.importLegacyData) {
    const receipt = await ports.runLegacyImport(projectId, input.projectName).catch(() => null);
    legacyImportRetryable = receipt === null || receipt.status === 'retryable';
  }

  return { status: 'ready', identity, projectId, legacyImportRetryable };
}
