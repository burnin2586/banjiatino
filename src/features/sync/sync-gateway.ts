import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/supabase/client';
import {
  decodeApplyOperationResult,
  decodeProjectChangePage,
  type ApplyOperationResult,
  type OutboxOperation,
  type ProjectChangePage,
} from './sync-types';

/**
 * Transport boundary for the Task 3 sync RPCs. Parameter names match the deployed
 * apply_project_operation / pull_project_changes signatures (no p_ prefix).
 */
export class SupabaseSyncGateway {
  private readonly client: SupabaseClient;
  private readonly projectId: string;

  constructor(projectId: string, client: SupabaseClient = getSupabaseClient()) {
    this.projectId = projectId;
    this.client = client;
  }

  async applyOperation(operation: OutboxOperation): Promise<ApplyOperationResult> {
    const { data, error } = await this.client.rpc('apply_project_operation', {
      project_id: operation.projectId,
      operation_id: operation.operationId,
      entity_type: operation.entityType,
      entity_id: operation.entityId,
      action: operation.action,
      base_version: operation.baseVersion,
      payload: operation.payload,
    });

    if (error) throw error;
    try {
      return decodeApplyOperationResult({ result: data });
    } catch (decodeError) {
      const raw = (() => {
        try {
          return JSON.stringify(data).slice(0, 300);
        } catch {
          return String(data).slice(0, 300);
        }
      })();
      throw new Error(
        `${decodeError instanceof Error ? decodeError.message : String(decodeError)} | typeof=${typeof data} | raw=${raw}`,
      );
    }
  }

  async pullChanges(afterCursor: number, pageSize: number): Promise<ProjectChangePage> {
    const { data, error } = await this.client.rpc('pull_project_changes', {
      project_id: this.projectId,
      after_cursor: afterCursor,
      page_size: pageSize,
    });

    if (error) throw error;
    try {
      return decodeProjectChangePage({ page: data });
    } catch (decodeError) {
      const raw = (() => {
        try {
          return JSON.stringify(data).slice(0, 300);
        } catch {
          return String(data).slice(0, 300);
        }
      })();
      throw new Error(
        `${decodeError instanceof Error ? decodeError.message : String(decodeError)} | typeof=${typeof data} | raw=${raw}`,
      );
    }
  }
}
