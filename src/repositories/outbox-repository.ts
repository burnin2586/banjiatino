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
    nextAttemptAt: Number(row.next_attempt_at ?? 0),
    failureCode: (row.failure_code as string | null) ?? null,
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
              payload_json, created_at, attempt_count, next_attempt_at, failure_code
       FROM outbox
       WHERE project_id = ?
       ORDER BY created_at ASC, operation_id ASC`,
      [projectId],
    );
    return result.rows.map(row => mapOutboxOperation(row as Record<string, unknown>));
  }

  async delete(operationId: string): Promise<void> {
    await executeDatabaseQuery('DELETE FROM outbox WHERE operation_id = ?', [operationId]);
  }

  async markFailure(
    operationId: string,
    record: {
      attemptCount: number;
      nextAttemptAt: number;
      lastError: string;
      failureCode: string | null;
    },
  ): Promise<void> {
    await executeDatabaseQuery(
      `UPDATE outbox
       SET attempt_count = ?, next_attempt_at = ?, last_error = ?, failure_code = ?
       WHERE operation_id = ?`,
      [record.attemptCount, record.nextAttemptAt, record.lastError, record.failureCode, operationId],
    );
  }

  async hasPendingWrite(projectId: string, entityType: string, entityId: string): Promise<boolean> {
    const result = await executeDatabaseQuery(
      `SELECT 1 AS value FROM outbox
       WHERE project_id = ? AND entity_type = ? AND entity_id = ? AND failure_code IS NULL
       LIMIT 1`,
      [projectId, entityType, entityId],
    );
    return result.rows.length > 0;
  }
}
