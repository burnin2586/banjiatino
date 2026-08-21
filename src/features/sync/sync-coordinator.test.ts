import { SyncCoordinator, type SyncCoordinatorPorts } from './sync-coordinator';
import type { SyncSummary } from './sync-engine';

type CountedPorts = SyncCoordinatorPorts & {
  events: string[];
  counts: { syncCalls: number };
  triggerAppState: (state: 'active' | 'background') => void;
  triggerWakeup: () => void;
  triggerLocalCommit: () => void;
};

function makePorts(overrides: Partial<SyncCoordinatorPorts> = {}): CountedPorts {
  const events: string[] = [];
  let appStateListener: ((state: 'active' | 'background') => void) | undefined;
  let wakeupListener: (() => void) | undefined;
  let localCommitListener: (() => void) | undefined;
  
  const counts = { syncCalls: 0 };
  const ports: SyncCoordinatorPorts = {
    engine: {
      sync: async () => {
        counts.syncCalls += 1;
        events.push(`sync:${counts.syncCalls}`);
        return { pushed: 0, pulled: 0, nextCursor: 0, failures: [], skippedPendingBackoff: 0, skippedByMerge: 0 } satisfies SyncSummary;
      },
      flush: async () => ({ pushed: 0, pulled: 0, nextCursor: 0, failures: [], skippedPendingBackoff: 0, skippedByMerge: 0 }),
    },
    subscribeAppState: listener => {
      appStateListener = listener;
      return () => {
        appStateListener = undefined;
      };
    },
    subscribeWakeup: listener => {
      wakeupListener = listener;
      return () => {
        wakeupListener = undefined;
      };
    },
    subscribeLocalCommit: listener => {
      localCommitListener = listener;
      return () => {
        localCommitListener = undefined;
      };
    },
    debounceMs: 0,
    ...overrides,
  };

  return {
    ...ports,
    events,
    counts,
    triggerAppState: state => appStateListener?.(state),
    triggerWakeup: () => wakeupListener?.(),
    triggerLocalCommit: () => localCommitListener?.(),
  };
}

describe('SyncCoordinator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('syncs on start and tears down every subscription on stop', async () => {
    const ports = makePorts();
    const coordinator = new SyncCoordinator(ports);

    const stop = coordinator.start('project-1');
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(1);

    stop();
    ports.triggerWakeup();
    ports.triggerAppState('active');
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(1);
  });

  it('syncs when the app returns to the foreground', async () => {
    const ports = makePorts();
    const coordinator = new SyncCoordinator(ports);
    coordinator.start('project-1');
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(1);

    ports.triggerAppState('active');
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(2);
  });

  it('syncs once for a burst of coalesced realtime wakeups', async () => {
    const ports = makePorts();
    const coordinator = new SyncCoordinator(ports);
    coordinator.start('project-1');
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(1);

    ports.triggerWakeup();
    ports.triggerWakeup();
    ports.triggerWakeup();
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(2);
  });

  it('syncs after a local commit outside the coordinator', async () => {
    const ports = makePorts();
    const coordinator = new SyncCoordinator(ports);
    coordinator.start('project-1');
    await jest.runAllTimersAsync();

    ports.triggerLocalCommit();
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(2);
  });

  it('retries manually through syncNow and ignores background wakeups', async () => {
    const ports = makePorts();
    const coordinator = new SyncCoordinator(ports);
    coordinator.start('project-1');
    await jest.runAllTimersAsync();

    await coordinator.syncNow('project-1');
    expect(ports.counts.syncCalls).toBe(2);

    ports.triggerAppState('background');
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(2);
  });

  it('reports every completed sync through onSyncResult', async () => {
    const results: number[] = [];
    const ports = makePorts({
      onSyncResult: summary => results.push(summary.failures.length),
    });
    const coordinator = new SyncCoordinator(ports);

    coordinator.start('project-1');
    await jest.runAllTimersAsync();

    expect(results).toEqual([0]);
  });

  it('keeps only one active coordinator per project', async () => {
    const ports = makePorts();
    const coordinator = new SyncCoordinator(ports);
    const stopFirst = coordinator.start('project-1');
    await jest.runAllTimersAsync();

    const stopSecond = coordinator.start('project-1');
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(2);

    // one wakeup after replacement triggers exactly one coalesced sync
    ports.triggerWakeup();
    await jest.runAllTimersAsync();
    expect(ports.counts.syncCalls).toBe(3);

    stopFirst();
    stopSecond();
  });
});
