import {
  joinProjectWithToken,
  type JoinFlowPorts,
} from './join-flow';

function makePorts(overrides: Partial<JoinFlowPorts> = {}): JoinFlowPorts {
  return {
    ensureSession: () => Promise.resolve({ userId: 'user-2' }),
    hasDisplayName: () => Promise.resolve(false),
    acceptInvitation: () => Promise.resolve({ projectId: 'project-1' }),
    fetchProjectName: () => Promise.resolve('搬去浦东'),
    saveCachedProject: () => Promise.resolve(),
    ...overrides,
  };
}

describe('joinProjectWithToken', () => {
  it('joins with a display name and returns the project preview', async () => {
    const ports = makePorts();

    await expect(
      joinProjectWithToken(ports, { token: 'tok', displayName: '妈妈' }),
    ).resolves.toEqual({
      status: 'joined',
      projectId: 'project-1',
      projectName: '搬去浦东',
    });
  });

  it('skips the name question when a profile name already exists', async () => {
    const ports = makePorts({ hasDisplayName: () => Promise.resolve(true) });

    await expect(
      joinProjectWithToken(ports, { token: 'tok' }),
    ).resolves.toEqual({
      status: 'joined',
      projectId: 'project-1',
      projectName: '搬去浦东',
    });
  });

  it('asks for a display name when the joiner has no profile', async () => {
    const ports = makePorts();

    await expect(
      joinProjectWithToken(ports, { token: 'tok' }),
    ).resolves.toEqual({ status: 'needName' });
  });

  it('falls back to the server default when the profile fetch fails', async () => {
    const ports = makePorts({ hasDisplayName: () => Promise.reject(new Error('offline')) });

    await expect(
      joinProjectWithToken(ports, { token: 'tok', displayName: '妈妈' }),
    ).resolves.toMatchObject({ status: 'joined' });
  });

  it('maps network failures to the offline code', async () => {
    const ports = makePorts({
      acceptInvitation: () => Promise.reject(new Error('network request failed')),
    });

    await expect(
      joinProjectWithToken(ports, { token: 'tok', displayName: '妈妈' }),
    ).resolves.toMatchObject({ status: 'failed', code: 'offline' });
  });

  it('does not cache the project when acceptance fails', async () => {
    let saved = false;
    const ports = makePorts({
      acceptInvitation: () => Promise.reject(new Error('invitation expired')),
      saveCachedProject: () => {
        saved = true;
        return Promise.resolve();
      },
    });

    await expect(
      joinProjectWithToken(ports, { token: 'tok', displayName: '妈妈' }),
    ).resolves.toMatchObject({ status: 'failed', code: 'expired' });
    expect(saved).toBe(false);
  });
});
