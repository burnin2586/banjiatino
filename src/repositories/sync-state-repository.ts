import { executeDatabaseQuery, withDatabaseTransaction } from '@/storage/database/connection';

export class SyncStateRepository {
  async getLastPulledCursor(projectId: string): Promise<number> {
    const result = await executeDatabaseQuery(
      'SELECT last_pulled_cursor FROM sync_state WHERE project_id = ?',
      [projectId],
    );
    return Number(result.rows[0]?.last_pulled_cursor ?? 0);
  }

  async setLastPulledCursor(projectId: string, cursor: number): Promise<void> {
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      throw new Error('cursor must be a non-negative safe integer');
    }

    await withDatabaseTransaction(tx =>
      tx.execute(
        `INSERT INTO sync_state (project_id, last_pulled_cursor, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           last_pulled_cursor = excluded.last_pulled_cursor,
           updated_at = excluded.updated_at`,
        [projectId, cursor, new Date().toISOString()],
      ),
    );
  }
}
