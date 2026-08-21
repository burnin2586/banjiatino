import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from './client';

const SYNCED_TABLES = ['rooms', 'moving_tasks', 'moving_boxes', 'moving_items'] as const;

/**
 * Realtime is a wake-up signal only — reliable recovery always goes through the cursor
 * based pull in the sync engine. postgres_changes requires one subscription per table;
 * a filter without a table never delivers events.
 */
export function openProjectWakeupChannel(
  projectId: string,
  onWakeup: () => void,
  client: SupabaseClient = getSupabaseClient(),
): () => void {
  const channel: RealtimeChannel = client.channel(`project-sync:${projectId}`);

  for (const table of SYNCED_TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `project_id=eq.${projectId}` },
      () => onWakeup(),
    );
  }
  channel.on('broadcast', { event: 'wakeup' }, () => onWakeup());
  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
