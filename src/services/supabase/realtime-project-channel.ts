import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from './client';

/**
 * Realtime is a wake-up signal only — reliable recovery always goes through the cursor
 * based pull in the sync engine. Subscribes to project-scoped postgres changes.
 */
export function openProjectWakeupChannel(
  projectId: string,
  onWakeup: () => void,
  client: SupabaseClient = getSupabaseClient(),
): () => void {
  const channel: RealtimeChannel = client
    .channel(`project-sync:${projectId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', filter: `project_id=eq.${projectId}` },
      () => onWakeup(),
    )
    .on('broadcast', { event: 'wakeup' }, () => onWakeup())
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
