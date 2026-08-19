import { AppState } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { OutboxRepository } from '@/repositories/outbox-repository';
import { subscribeToProject } from '@/storage/database/connection';
import { SyncCoordinator } from '@/features/sync/sync-coordinator';
import { SyncEngine } from '@/features/sync/sync-engine';
import { SupabaseSyncGateway } from '@/features/sync/sync-gateway';
import { openProjectWakeupChannel } from '@/services/supabase/realtime-project-channel';

export type SyncStatusCounts = {
  pending: number;
  failed: number;
  needsAttention: number;
};

export type SyncContextValue = SyncStatusCounts & {
  retry: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

async function readCounts(projectId: string): Promise<SyncStatusCounts> {
  const operations = await new OutboxRepository().listPending(projectId);
  let pending = 0;
  let failed = 0;
  let needsAttention = 0;
  for (const operation of operations) {
    if (operation.failureCode) {
      needsAttention += 1;
    } else if (operation.attemptCount > 0) {
      failed += 1;
    } else {
      pending += 1;
    }
  }
  return { pending, failed, needsAttention };
}

export function SyncProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [counts, setCounts] = useState<SyncStatusCounts>({ pending: 0, failed: 0, needsAttention: 0 });
  const [lastSyncFailed, setLastSyncFailed] = useState(false);
  const engineRef = useRef<SyncEngine | null>(null);
  const coordinatorRef = useRef<SyncCoordinator | null>(null);

  useEffect(() => {
    const refresh = () => void readCounts(projectId).then(setCounts).catch(() => undefined);

    const engine = new SyncEngine({
      gateway: new SupabaseSyncGateway(projectId),
    });
    engineRef.current = engine;

    const coordinator = new SyncCoordinator({
      engine,
      subscribeAppState: listener => {
        const subscription = AppState.addEventListener('change', state =>
          listener(state === 'active' ? 'active' : 'background'),
        );
        return () => subscription.remove();
      },
      subscribeWakeup: listener => openProjectWakeupChannel(projectId, listener),
      // Local commits already publish through the per-project notification bus.
      subscribeLocalCommit: listener => subscribeToProject(projectId, listener),
      onSyncResult: summary => {
        setLastSyncFailed(summary.failures.length > 0);
        refresh();
      },
    });
    coordinatorRef.current = coordinator;
    refresh();

    const stopCoordinator = coordinator.start(projectId);
    const stopCounts = subscribeToProject(projectId, refresh);
    return () => {
      stopCoordinator();
      stopCounts();
    };
  }, [projectId]);

  const retry = useCallback(() => {
    void coordinatorRef.current?.syncNow(projectId).then(() =>
      readCounts(projectId).then(setCounts).catch(() => undefined),
    );
  }, [projectId]);

  const value = useMemo<SyncContextValue>(
    () => ({ ...counts, failed: counts.failed + (lastSyncFailed ? 1 : 0), retry }),
    [counts, lastSyncFailed, retry],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncStatus(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) {
    throw new Error('useSyncStatus must be used within SyncProvider');
  }
  return value;
}
