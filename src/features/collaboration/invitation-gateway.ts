import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/supabase/client';
import type { InvitationFailureCode } from './invitation-errors';

export { classifyInvitationError, type InvitationFailureCode } from './invitation-errors';

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
