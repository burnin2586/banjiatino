import {
  ensureAnonymousSession,
  saveCachedProject,
} from '@/services/supabase/bootstrap-ports';
import { getSupabaseClient } from '@/services/supabase/client';
import { InvitationGateway } from './invitation-gateway';
import type { JoinFlowPorts } from './join-flow';

/** Production join-flow ports over the shared Supabase client. */
export function createSupabaseJoinFlowPorts(): JoinFlowPorts {
  const client = getSupabaseClient();
  const gateway = new InvitationGateway(client);

  return {
    ensureSession: () => ensureAnonymousSession(client),
    hasDisplayName: async () => {
      const { data } = await client.from('profiles').select('display_name').maybeSingle();
      return Boolean(data?.display_name);
    },
    acceptInvitation: (token, displayName) => gateway.acceptInvitation(token, displayName),
    fetchProjectName: async projectId => {
      const { data } = await client
        .from('moving_projects')
        .select('name')
        .eq('id', projectId)
        .single();
      return (data?.name as string | undefined) ?? '搬家项目';
    },
    saveCachedProject,
  };
}
