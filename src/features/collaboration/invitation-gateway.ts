import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/supabase/client';

/** Rejections the join flow distinguishes for copy and retry behavior. */
export type InvitationFailureCode =
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'archived'
  | 'offline'
  | 'unknown';

export function classifyInvitationError(error: unknown): InvitationFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/network|fetch|timed?\s*out|connection/i.test(message)) return 'offline';
  if (/revoked/i.test(message)) return 'revoked';
  if (/expired/i.test(message)) return 'expired';
  if (/archived/i.test(message)) return 'archived';
  if (/not found/i.test(message)) return 'not_found';
  return 'unknown';
}

export class InvitationGateway {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient = getSupabaseClient()) {
    this.client = client;
  }

  async createInvitation(projectId: string): Promise<{ token: string }> {
    const { data, error } = await this.client.rpc('create_project_invitation', {
      project_id: projectId,
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('create_project_invitation returned no token');
    return { token: data };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const { error } = await this.client.rpc('revoke_project_invitation', {
      invitation_id: invitationId,
    });
    if (error) throw error;
  }

  async acceptInvitation(token: string, displayName?: string): Promise<{ projectId: string }> {
    const { data, error } = await this.client.rpc('accept_project_invitation', {
      token,
      ...(displayName !== undefined ? { display_name: displayName } : {}),
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('accept_project_invitation returned no project');
    return { projectId: data };
  }
}
