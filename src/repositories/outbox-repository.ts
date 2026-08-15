import type { OutboxOperation } from '@/features/sync/sync-types';
import {
  executeDatabaseQuery,
  type DatabaseTransaction,
} from '@/storage/database/connection';

function mapOutboxOperation(row: Record<string, unknown>): OutboxOperation {
  return {
    operationId: row.operation_id as string,
    projectId: row.project_id as string,
    entityType: row.entity_type as OutboxOperation['entityType'],
    entityId: row.entity_id as string,
    action: row.action as OutboxOperation['action'],
    baseVersion: Number(row.base_version),
    payload: JSON.parse(row.payload_json as string) as Record<string, unknown>,
    createdAt: Number(row.created_at),
    attemptCount: Number(row.attempt_count),
  };
}

export class OutboxRepository {
  async insert(tx: DatabaseTransaction, operation: OutboxOperation): Promise<void> {
    await tx.execute(
      `INSERT INTO outbox (
        operation_id, project_id, entity_type, entity_id, action, base_version,
        payload_json, created_at, attempt_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.operationId,
        operation.projectId,
        operation.entityType,
        operation.entityId,
        operation.action,
        operation.baseVersion,
        JSON.stringify(operation.payload),
        operation.createdAt,
        operation.attemptCount,
      ],
    );
  }

  async listPending(projectId: string): Promise<OutboxOperation[]> {
    const result = await executeDatabaseQuery(
      `SELECT operation_id, project_id, entity_type, entity_id, action, base_version,
              payload_json, created_at, attempt_count
       FROM outbox
       WHERE project_id = ?
       ORDER BY created_at ASC, operation_id ASC`,
      [projectId],
    );
    return result.rows.map(row => mapOutboxOperation(row as Record<string, unknown>));
  }
}
