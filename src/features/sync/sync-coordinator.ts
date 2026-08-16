import type { SyncSummary } from './sync-engine';

export type SyncCoordinatorPorts = {
  engine: {
    sync(projectId: string): Promise<SyncSummary>;
    flush(projectId: string): Promise<SyncSummary>;
  };
  subscribeAppState(listener: (state: 'active' | 'background') => void): () => void;
  subscribeWakeup(listener: () => void): () => void;
  subscribeLocalCommit(listener: () => void): () => void;
  debounceMs?: number;
};

/**
 * Coordinates when the sync engine runs: startup, app foreground, realtime wakeups,
 * local commits, and manual retry. Wakeups are coalesced with a trailing debounce so a
 * burst of realtime events costs one sync; each project has at most one active channel.
 */
export class SyncCoordinator {
  private readonly ports: SyncCoordinatorPorts;
  private readonly debounceMs: number;
  private stoppers: Array<() => void> = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private activeProjectId: string | null = null;
  private syncing = false;
  private queued = false;

  constructor(ports: SyncCoordinatorPorts) {
    this.ports = ports;
    this.debounceMs = ports.debounceMs ?? 300;
  }

  start(projectId: string): () => void {
    if (this.activeProjectId === projectId) {
      // Restarting the same project replaces its channel without duplicating wakeups.
      this.teardown();
    } else {
      this.teardown();
    }
    this.activeProjectId = projectId;

    this.stoppers = [
      this.ports.subscribeAppState(state => {
        if (state === 'active') this.scheduleSync('foreground');
      }),
      this.ports.subscribeWakeup(() => this.scheduleSync('realtime')),
      this.ports.subscribeLocalCommit(() => this.scheduleSync('local-commit')),
    ];

    void this.runSync('startup');

    return () => {
      this.teardown();
      this.activeProjectId = null;
    };
  }

  async syncNow(projectId: string): Promise<SyncSummary | undefined> {
    return this.runSync('manual');
  }

  private scheduleSync(reason: string): void {
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.runSync(reason);
    }, this.debounceMs);
  }

  private async runSync(reason: string): Promise<SyncSummary | undefined> {
    const projectId = this.activeProjectId;
    if (!projectId) return undefined;
    if (this.syncing) {
      this.queued = true;
      return undefined;
    }

    this.syncing = true;
    try {
      return await this.ports.engine.sync(projectId);
    } catch {
      return undefined;
    } finally {
      this.syncing = false;
      if (this.queued) {
        this.queued = false;
        void this.runSync(reason);
      }
    }
  }

  private teardown(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    for (const stop of this.stoppers) stop();
    this.stoppers = [];
  }
}
