import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../config';

// Lazily initialized to allow config validation to run first
let _adminClient: ReturnType<typeof createClient> | null = null;

/**
 * Supabase admin client using the service role key.
 * BYPASSES Row Level Security — use only in trusted server-side code.
 * Never expose this client or its key to the frontend.
 */
export function getSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!_adminClient) {
    const cfg = getConfig();
    _adminClient = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInContext: false,
      },
    });
  }
  return _adminClient;
}

// Convenience export — initialized on first access
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop: string | symbol) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createClient>];
  },
});
