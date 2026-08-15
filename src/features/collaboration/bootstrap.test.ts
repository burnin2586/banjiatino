import type { LegacyImportReceipt } from './legacy-import';
import {
  runBootstrap,
  submitOnboarding,
  type BootstrapPorts,
} from './bootstrap';

const identity = { userId: 'user-1' };

type CountedPorts = BootstrapPorts & {
  counts: { anonymousSignInCalls: number; createProjectCalls: number };
};

function makePorts(overrides: Partial<BootstrapPorts> = {}): CountedPorts {
  const counts = { anonymousSignInCalls: 0, createProjectCalls: 0 };

  const base: BootstrapPorts = {
    restoreSession: () => Promise.resolve(null),
    ensureAnonymousSession: () => Promise.resolve(identity),
    createProject: () => Promise.resolve({ projectId: 'project-1' }),
    loadCachedProjectId: () => Promise.resolve(null),
    saveCachedProjectId: () => Promise.resolve(),
    runLegacyImport: () => Promise.resolve(null),
    isOfflineError: () => false,
    ...overrides,
  };

  return {
    ...base,
    ensureAnonymousSession: async () => {
      counts.anonymousSignInCalls += 1;
      return base.ensureAnonymousSession();
    },
    createProject: async input => {
      counts.createProjectCalls += 1;
      return base.createProject(input);
    },
    counts,
  };
}

const input = {
  displayName: '阿伦',
  projectName: '搬去浦东',
  movingDateMs: 1_786_665_600_000,
  importLegacyData: true,
};

describe('runBootstrap', () => {
  it('enters a restored session with a cached project without touching the network', async () => {
    const ports = makePorts({
      restoreSession: () => Promise.resolve(identity),
      loadCachedProjectId: () => Promise.resolve('project-1'),
    });

    await expect(runBootstrap(ports)).resolves.toEqual({
      status: 'ready',
      identity,
      projectId: 'project-1',
      legacyImportRetryable: false,
    });
    expect(ports.counts.anonymousSignInCalls).toBe(0);
    expect(ports.counts.createProjectCalls).toBe(0);
  });

  it('asks a signed-in user without a cached project to onboard', async () => {
    const ports = makePorts({
      restoreSession: () => Promise.resolve(identity),
    });

    await expect(runBootstrap(ports)).resolves.toEqual({ status: 'needsOnboarding' });
    expect(ports.counts.anonymousSignInCalls).toBe(0);
  });

  it('lets offline users with an existing local project enter it', async () => {
    const ports = makePorts({
      loadCachedProjectId: () => Promise.resolve('project-1'),
    });

    await expect(runBootstrap(ports)).resolves.toEqual({
      status: 'offlineWithCachedProject',
      projectId: 'project-1',
    });
    expect(ports.counts.anonymousSignInCalls).toBe(0);
  });

  it('routes fresh offline users without identity to the needs-network state only after a sign-in attempt', async () => {
    const ports = makePorts({
      ensureAnonymousSession: () => Promise.reject(new Error('network request failed')),
      isOfflineError: () => true,
    });

    await expect(runBootstrap(ports)).resolves.toEqual({ status: 'needsOnboarding' });
    expect(ports.counts.anonymousSignInCalls).toBe(0);
  });
});

describe('submitOnboarding', () => {
  it('creates an anonymous session, project, cache entry, and legacy import in order', async () => {
    const calls: string[] = [];
    const receipt: LegacyImportReceipt = {
      sourceStorageVersion: 'banjiatino-moving-state-v1@4',
      status: 'completed',
      attemptCount: 1,
      importedEntityIds: [],
    };
    const ports = makePorts({
      createProject: () => {
        calls.push('createProject');
        return Promise.resolve({ projectId: 'project-9' });
      },
      saveCachedProjectId: projectId => {
        calls.push(`save:${projectId}`);
        return Promise.resolve();
      },
      runLegacyImport: (projectId, projectName) => {
        calls.push(`import:${projectId}:${projectName}`);
        return Promise.resolve(receipt);
      },
    });

    await expect(submitOnboarding(ports, input)).resolves.toEqual({
      status: 'ready',
      identity,
      projectId: 'project-9',
      legacyImportRetryable: false,
    });
    expect(calls).toEqual(['createProject', 'save:project-9', 'import:project-9:搬去浦东']);
  });

  it('shows the needs-network state when the anonymous sign-in fails offline', async () => {
    const ports = makePorts({
      ensureAnonymousSession: () => Promise.reject(new Error('network request failed')),
      isOfflineError: () => true,
    });

    await expect(submitOnboarding(ports, input)).resolves.toEqual({
      status: 'offlineWithoutIdentity',
    });
    expect(ports.counts.createProjectCalls).toBe(0);
  });

  it('surfaces a retryable project-creation failure and succeeds on retry', async () => {
    let failures = 0;
    const ports = makePorts({
      createProject: () => {
        failures += 1;
        if (failures === 1) return Promise.reject(new Error('rpc unavailable'));
        return Promise.resolve({ projectId: 'project-1' });
      },
    });

    const failed = await submitOnboarding(ports, input);
    expect(failed).toMatchObject({ status: 'retryable', stage: 'project' });

    const retried = await submitOnboarding(ports, input);
    expect(retried).toMatchObject({ status: 'ready', projectId: 'project-1' });
    expect(ports.counts.anonymousSignInCalls).toBe(2);
  });

  it('treats an unexpected sign-in failure as retryable rather than offline', async () => {
    const ports = makePorts({
      ensureAnonymousSession: () => Promise.reject(new Error('invalid key')),
    });

    await expect(submitOnboarding(ports, input)).resolves.toMatchObject({
      status: 'retryable',
      stage: 'session',
    });
  });

  it('stays ready when the legacy import is retryable and flags it', async () => {
    const ports = makePorts({
      runLegacyImport: () =>
        Promise.resolve({
          sourceStorageVersion: 'banjiatino-moving-state-v1@4',
          status: 'retryable',
          attemptCount: 1,
          importedEntityIds: [],
          lastError: 'boom',
        } satisfies LegacyImportReceipt),
    });

    await expect(submitOnboarding(ports, input)).resolves.toEqual({
      status: 'ready',
      identity,
      projectId: 'project-1',
      legacyImportRetryable: true,
    });
  });

  it('skips the legacy import when the user declines it', async () => {
    const ports = makePorts();

    await submitOnboarding(ports, { ...input, importLegacyData: false });

    expect(ports.counts.createProjectCalls).toBe(1);
  });
});
