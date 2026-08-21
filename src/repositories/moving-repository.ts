import type { OutboxOperation } from '@/features/sync/sync-types';
import {
  executeDatabaseQuery,
  notifyProjectCommitted,
  subscribeToProject,
  withDatabaseTransaction,
} from '@/storage/database/connection';
import { OutboxRepository } from './outbox-repository';

export type StoredBox = {
  id: string;
  projectId: string;
  displayNumber: number | null;
  label: string;
  notes: string | null;
  status: string;
  sourceRoomId: string | null;
  destinationRoomId: string | null;
  assigneeId: string | null;
  createdBy: string;
  updatedBy: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type NewBox = Omit<StoredBox, 'syncStatus' | 'version'>;

export type CreateBoxInput = {
  box: NewBox;
  operation: OutboxOperation;
};

function mapStoredBox(row: Record<string, unknown>): StoredBox {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    displayNumber: row.display_number === null ? null : Number(row.display_number),
    label: row.label as string,
    notes: (row.notes as string | null) ?? null,
    status: row.status as string,
    sourceRoomId: (row.source_room_id as string | null) ?? null,
    destinationRoomId: (row.destination_room_id as string | null) ?? null,
    assigneeId: (row.assignee_id as string | null) ?? null,
    createdBy: row.created_by as string,
    updatedBy: row.updated_by as string,
    syncStatus: row.sync_status as StoredBox['syncStatus'],
    version: Number(row.version),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class MovingRepository {
  private readonly outbox: OutboxRepository;

  constructor(outbox = new OutboxRepository()) {
    this.outbox = outbox;
  }

  async createBox(input: CreateBoxInput): Promise<StoredBox> {
    if (
      input.operation.projectId !== input.box.projectId ||
      input.operation.entityId !== input.box.id ||
      input.operation.entityType !== 'box' ||
      input.operation.action !== 'create' ||
      input.operation.baseVersion !== 0
    ) {
      throw new Error('box create operation must target the box and project being created');
    }

    const committedBox = await withDatabaseTransaction(async tx => {
      await tx.execute(
        `INSERT INTO moving_boxes (
          id, project_id, display_number, label, notes, status, source_room_id, destination_room_id,
          assignee_id, created_by, updated_by, sync_status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)`,
        [
          input.box.id,
          input.box.projectId,
          input.box.displayNumber,
          input.box.label,
          input.box.notes,
          input.box.status,
          input.box.sourceRoomId,
          input.box.destinationRoomId,
          input.box.assigneeId,
          input.box.createdBy,
          input.box.updatedBy,
          input.box.createdAt,
          input.box.updatedAt,
        ],
      );
      await this.outbox.insert(tx, input.operation);
      await tx.execute(
        `INSERT INTO project_change_notifications (
          project_id, entity_type, entity_id, change_type, created_at
        ) VALUES (?, 'box', ?, 'upsert', ?)`,
        [input.box.projectId, input.box.id, input.operation.createdAt],
      );

      return {
        ...input.box,
        syncStatus: 'pending' as const,
        version: 1,
      };
    });

    notifyProjectCommitted(input.box.projectId);
    return committedBox;
  }

  async listBoxes(projectId: string): Promise<StoredBox[]> {
    const result = await executeDatabaseQuery(
      `SELECT id, project_id, display_number, label, notes, status, source_room_id, destination_room_id,
              assignee_id, created_by, updated_by, sync_status, version, created_at, updated_at
       FROM moving_boxes
       WHERE project_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC, id ASC`,
      [projectId],
    );
    return result.rows.map(row => mapStoredBox(row as Record<string, unknown>));
  }

  subscribeToProject(projectId: string, listener: () => void): () => void {
    return subscribeToProject(projectId, listener);
  }
}
