import type { EntityType } from './sync-types';

/**
 * Collaboration box status ladder. Ordinary sync may only move forward; an explicit
 * correction (planned separately) is the only path backwards.
 */
export const BOX_STATUS_ORDER: Record<string, number> = {
  draft: 0,
  packed: 1,
  moved: 2,
  arrived: 3,
  unpacked: 4,
};

export type LocalEntityState = {
  entityType: EntityType;
  entityId: string;
  version: number;
  deletedAt: string | null;
  boxStatus?: string | null;
  hasPendingLocalWrite: boolean;
};

export type RemoteEntityChange = {
  entityType: EntityType;
  entityId: string;
  changeType: 'upsert' | 'delete';
  entityVersion: number;
  boxStatus?: string | null;
};

export type MergeDecision =
  | { action: 'acceptRemote'; reason: 'newer-version' | 'soft-delete-wins' | 'restore' }
  | { action: 'keepLocalPending'; reason: 'stale-remote' | 'box-status-regression' }
  | { action: 'needsAttention'; reason: string };

/**
 * Pure per-entity merge decision. Ordering authority is the server version and the box
 * status ladder — never client wall clocks.
 */
export function mergeRemoteChange(local: LocalEntityState, remote: RemoteEntityChange): MergeDecision {
  const remoteIsNewer = remote.entityVersion > local.version;

  if (remote.entityType === 'box' && remote.changeType === 'upsert') {
    const localOrder = local.boxStatus === undefined || local.boxStatus === null
      ? undefined
      : BOX_STATUS_ORDER[local.boxStatus];
    const remoteOrder = remote.boxStatus === undefined || remote.boxStatus === null
      ? undefined
      : BOX_STATUS_ORDER[remote.boxStatus as string];

    if (localOrder === undefined || remoteOrder === undefined) {
      if (remote.boxStatus !== undefined && remote.boxStatus !== null && remoteOrder === undefined) {
        return { action: 'needsAttention', reason: `unknown box status ${String(remote.boxStatus)}` };
      }
    } else if (remoteOrder < localOrder) {
      return { action: 'keepLocalPending', reason: 'box-status-regression' };
    }
  }

  if (!remoteIsNewer) {
    return { action: 'keepLocalPending', reason: 'stale-remote' };
  }

  if (remote.changeType === 'delete') {
    // Soft delete wins over concurrent edits; the local row content survives for restore.
    return { action: 'acceptRemote', reason: 'soft-delete-wins' };
  }

  if (local.deletedAt !== null) {
    return { action: 'acceptRemote', reason: 'restore' };
  }

  return { action: 'acceptRemote', reason: 'newer-version' };
}
