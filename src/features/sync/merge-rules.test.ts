import {
  BOX_STATUS_ORDER,
  mergeRemoteChange,
} from './merge-rules';

describe('mergeRemoteChange', () => {
  it('keeps a higher local box status over a later remote stale lower status', () => {
    const decision = mergeRemoteChange(
      {
        entityType: 'box',
        entityId: 'box-1',
        version: 1,
        deletedAt: null,
        boxStatus: 'arrived',
        hasPendingLocalWrite: true,
      },
      {
        entityType: 'box',
        entityId: 'box-1',
        changeType: 'upsert',
        entityVersion: 2,
        boxStatus: 'packed',
      },
    );

    expect(decision).toEqual({
      action: 'keepLocalPending',
      reason: 'box-status-regression',
    });
  });

  it('accepts the last scalar update for name, note, and assignee fields', () => {
    const decision = mergeRemoteChange(
      {
        entityType: 'task',
        entityId: 'task-1',
        version: 3,
        deletedAt: null,
        hasPendingLocalWrite: false,
      },
      {
        entityType: 'task',
        entityId: 'task-1',
        changeType: 'upsert',
        entityVersion: 4,
      },
    );

    expect(decision).toEqual({ action: 'acceptRemote', reason: 'newer-version' });
  });

  it('keeps a stale remote change out when local already has the same version', () => {
    const decision = mergeRemoteChange(
      {
        entityType: 'box',
        entityId: 'box-1',
        version: 5,
        deletedAt: null,
        boxStatus: 'packed',
        hasPendingLocalWrite: true,
      },
      {
        entityType: 'box',
        entityId: 'box-1',
        changeType: 'upsert',
        entityVersion: 5,
        boxStatus: 'packed',
      },
    );

    expect(decision).toEqual({ action: 'keepLocalPending', reason: 'stale-remote' });
  });

  it('applies a remote soft delete while locally edited content survives for restore', () => {
    const decision = mergeRemoteChange(
      {
        entityType: 'box',
        entityId: 'box-1',
        version: 1,
        deletedAt: null,
        boxStatus: 'packed',
        hasPendingLocalWrite: true,
      },
      {
        entityType: 'box',
        entityId: 'box-1',
        changeType: 'delete',
        entityVersion: 2,
      },
    );

    expect(decision).toEqual({ action: 'acceptRemote', reason: 'soft-delete-wins' });
  });

  it('restores an entity that was deleted locally but recreated remotely', () => {
    const decision = mergeRemoteChange(
      {
        entityType: 'room',
        entityId: 'room-1',
        version: 2,
        deletedAt: '2026-08-01T00:00:00Z',
        hasPendingLocalWrite: false,
      },
      {
        entityType: 'room',
        entityId: 'room-1',
        changeType: 'upsert',
        entityVersion: 3,
      },
    );

    expect(decision).toEqual({ action: 'acceptRemote', reason: 'restore' });
  });

  it('allows a forward box status transition from the remote side', () => {
    const decision = mergeRemoteChange(
      {
        entityType: 'box',
        entityId: 'box-1',
        version: 1,
        deletedAt: null,
        boxStatus: 'packed',
        hasPendingLocalWrite: false,
      },
      {
        entityType: 'box',
        entityId: 'box-1',
        changeType: 'upsert',
        entityVersion: 2,
        boxStatus: 'arrived',
      },
    );

    expect(decision).toEqual({ action: 'acceptRemote', reason: 'newer-version' });
  });

  it('flags unknown box status values for manual attention instead of guessing', () => {
    const decision = mergeRemoteChange(
      {
        entityType: 'box',
        entityId: 'box-1',
        version: 1,
        deletedAt: null,
        boxStatus: 'packed',
        hasPendingLocalWrite: false,
      },
      {
        entityType: 'box',
        entityId: 'box-1',
        changeType: 'upsert',
        entityVersion: 2,
        boxStatus: 'teleported',
      },
    );

    expect(decision.action).toBe('needsAttention');
  });

  it('orders box statuses monotonically from draft to unpacked', () => {
    expect(BOX_STATUS_ORDER).toEqual({
      draft: 0,
      packed: 1,
      moved: 2,
      arrived: 3,
      unpacked: 4,
    });
  });
});
