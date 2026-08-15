export type EntityType =
  | 'room'
  | 'task'
  | 'box'
  | 'item'
  | 'memory_house'
  | 'memory_room'
  | 'memory_wall';

export type OperationAction =
  | 'create'
  | 'update'
  | 'set_status'
  | 'complete'
  | 'soft_delete'
  | 'restore';

export type OutboxOperation = {
  operationId: string;
  projectId: string;
  entityType: EntityType;
  entityId: string;
  action: OperationAction;
  baseVersion: number;
  payload: Record<string, unknown>;
  createdAt: number;
  attemptCount: number;
};

export type ApplyOperationResult = {
  entity: Record<string, unknown>;
  cursor: number;
  operationId: string;
};

export type ProjectChange = {
  cursor: number;
  projectId: string;
  entityType: EntityType;
  entityId: string;
  changeType: 'upsert' | 'delete';
  entityVersion: number;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ProjectChangePage = {
  changes: ProjectChange[];
  nextCursor: number;
};

const entityTypes = new Set<EntityType>([
  'room',
  'task',
  'box',
  'item',
  'memory_house',
  'memory_room',
  'memory_wall',
]);

const operationActions = new Set<OperationAction>([
  'create',
  'update',
  'set_status',
  'complete',
  'soft_delete',
  'restore',
]);

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string, path = key): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
  path = key,
): number {
  const value = record[key];

  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${path} must be a non-negative safe integer`);
  }

  return value as number;
}

function readEntityType(record: Record<string, unknown>, path = 'entityType'): EntityType {
  const value = readString(record, 'entityType', path);

  if (!entityTypes.has(value as EntityType)) {
    throw new Error(`${path} is unsupported`);
  }

  return value as EntityType;
}

export function decodeOutboxOperation(value: unknown): OutboxOperation {
  const operation = readRecord(value, 'operation');
  const action = readString(operation, 'action');

  if (!operationActions.has(action as OperationAction)) {
    throw new Error('action is unsupported');
  }

  return {
    operationId: readString(operation, 'operationId'),
    projectId: readString(operation, 'projectId'),
    entityType: readEntityType(operation),
    entityId: readString(operation, 'entityId'),
    action: action as OperationAction,
    baseVersion: readNonNegativeInteger(operation, 'baseVersion'),
    payload: readRecord(operation.payload, 'payload'),
    createdAt: readNonNegativeInteger(operation, 'createdAt'),
    attemptCount: readNonNegativeInteger(operation, 'attemptCount'),
  };
}

export function decodeApplyOperationResult(value: unknown): ApplyOperationResult {
  const result = readRecord(value, 'result');

  return {
    entity: readRecord(result.entity, 'entity'),
    cursor: readNonNegativeInteger(result, 'cursor'),
    operationId: readString(result, 'operationId'),
  };
}

function decodeProjectChange(value: unknown, index: number): ProjectChange {
  const path = `changes[${index}]`;
  const change = readRecord(value, path);
  const changeType = readString(change, 'changeType', `${path}.changeType`);

  if (changeType !== 'upsert' && changeType !== 'delete') {
    throw new Error(`${path}.changeType is unsupported`);
  }

  return {
    cursor: readNonNegativeInteger(change, 'cursor', `${path}.cursor`),
    projectId: readString(change, 'projectId', `${path}.projectId`),
    entityType: readEntityType(change, `${path}.entityType`),
    entityId: readString(change, 'entityId', `${path}.entityId`),
    changeType,
    entityVersion: readNonNegativeInteger(change, 'entityVersion', `${path}.entityVersion`),
    payload: readRecord(change.payload, `${path}.payload`),
    createdAt: readString(change, 'createdAt', `${path}.createdAt`),
  };
}

export function decodeProjectChangePage(value: unknown): ProjectChangePage {
  const page = readRecord(value, 'page');

  if (!Array.isArray(page.changes)) {
    throw new Error('changes must be an array');
  }

  return {
    changes: page.changes.map(decodeProjectChange),
    nextCursor: readNonNegativeInteger(page, 'nextCursor'),
  };
}
