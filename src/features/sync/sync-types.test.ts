import {
  decodeApplyOperationResult,
  decodeOutboxOperation,
  decodeProjectChangePage,
} from './sync-types';

const validOperation = {
  operationId: '10000000-0000-0000-0000-000000000001',
  projectId: '20000000-0000-0000-0000-000000000002',
  entityType: 'box',
  entityId: '30000000-0000-0000-0000-000000000003',
  action: 'create',
  baseVersion: 0,
  payload: { label: 'Kitchen' },
  createdAt: 1_786_646_400_000,
  attemptCount: 0,
};

describe('decodeOutboxOperation', () => {
  it('accepts a supported entity type and action', () => {
    expect(decodeOutboxOperation(validOperation)).toEqual(validOperation);
  });

  it('rejects an unknown entity type', () => {
    expect(() => decodeOutboxOperation({ ...validOperation, entityType: 'project' })).toThrow(
      'entityType',
    );
  });

  it('rejects an unknown operation action', () => {
    expect(() => decodeOutboxOperation({ ...validOperation, action: 'hard_delete' })).toThrow(
      'action',
    );
  });
});

describe('decodeApplyOperationResult', () => {
  it('accepts an entity snapshot with its operation id and cursor', () => {
    const result = {
      entity: { id: validOperation.entityId, version: 1 },
      cursor: 8,
      operationId: validOperation.operationId,
    };

    expect(decodeApplyOperationResult(result)).toEqual(result);
  });

  it('rejects a result without a cursor', () => {
    expect(() => decodeApplyOperationResult({
      entity: { id: validOperation.entityId, version: 1 },
      operationId: validOperation.operationId,
    })).toThrow('cursor');
  });
});

describe('decodeProjectChangePage', () => {
  const validChange = {
    cursor: 9,
    projectId: validOperation.projectId,
    entityType: 'box',
    entityId: validOperation.entityId,
    changeType: 'upsert',
    entityVersion: 2,
    payload: { id: validOperation.entityId, version: 2 },
    createdAt: '2026-08-13T08:00:00.000Z',
  };

  it('accepts ordered change envelopes and the next cursor', () => {
    const page = { changes: [validChange], nextCursor: 9 };

    expect(decodeProjectChangePage(page)).toEqual(page);
  });

  it('rejects a change envelope without a cursor', () => {
    const { cursor: _cursor, ...changeWithoutCursor } = validChange;

    expect(() => decodeProjectChangePage({
      changes: [changeWithoutCursor],
      nextCursor: 9,
    })).toThrow('changes[0].cursor');
  });

  it('rejects a page without its next cursor', () => {
    expect(() => decodeProjectChangePage({ changes: [validChange] })).toThrow('nextCursor');
  });
});
