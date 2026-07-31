import { supabaseAdmin } from '../lib/supabaseAdmin';
import { sendPushToMany } from '../lib/firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoticeRow {
  id: string;
  societyId: string;
  title: string;
  body: string;
  audience: string;
  noticeType: string;
}

// ---------------------------------------------------------------------------
// Token helpers by audience
// ---------------------------------------------------------------------------

/**
 * Resolve FCM tokens for a given audience string.
 * audience: 'all' | 'guards' | 'building:<uuid>'
 */
export async function getTokensForAudience(
  societyId: string,
  audience: string
): Promise<string[]> {
  if (audience === 'all') {
    // All active user_profiles in the society
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('society_id', societyId)
      .eq('is_active', true);

    const userIds = (profiles ?? []).map((p: { id: string }) => p.id);
    if (userIds.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('fcm_tokens')
      .select('token')
      .in('user_id', userIds);

    if (error || !data) {
      console.error('[noticeScheduler] getTokensForAudience(all) error:', error?.message);
      return [];
    }
    return data.map((r: { token: string }) => r.token);
  }

  if (audience === 'guards') {
    // All guards in society
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('society_id', societyId)
      .eq('role', 'guard')
      .eq('is_active', true);

    const userIds = (profiles ?? []).map((p: { id: string }) => p.id);
    if (userIds.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('fcm_tokens')
      .select('token')
      .in('user_id', userIds);

    if (error || !data) {
      console.error('[noticeScheduler] getTokensForAudience(guards) error:', error?.message);
      return [];
    }
    return data.map((r: { token: string }) => r.token);
  }

  if (audience.startsWith('building:')) {
    const buildingId = audience.slice('building:'.length);

    // All active residents in that building (via flat → building join)
    const { data: flatIds, error: flatError } = await supabaseAdmin
      .from('flats')
      .select('id')
      .eq('building_id', buildingId)
      .eq('society_id', societyId);

    if (flatError || !flatIds || flatIds.length === 0) {
      console.error('[noticeScheduler] No flats found for building:', buildingId);
      return [];
    }

    const ids = flatIds.map((f: { id: string }) => f.id);

    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .in('flat_id', ids)
      .eq('is_active', true);

    const userIds = (profiles ?? []).map((p: { id: string }) => p.id);
    if (userIds.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('fcm_tokens')
      .select('token')
      .in('user_id', userIds);

    if (error || !data) {
      console.error('[noticeScheduler] getTokensForAudience(building) error:', error?.message);
      return [];
    }
    return data.map((r: { token: string }) => r.token);
  }

  console.warn('[noticeScheduler] Unknown audience type:', audience);
  return [];
}

/**
 * Send FCM push notifications for a notice to its target audience.
 */
export async function sendNoticeToAudience(
  notice: NoticeRow,
  societyId: string
): Promise<void> {
  try {
    const tokens = await getTokensForAudience(societyId, notice.audience);
    if (tokens.length === 0) {
      console.log(`[noticeScheduler] No tokens for notice ${notice.id} audience=${notice.audience}`);
      return;
    }

    const result = await sendPushToMany(tokens, notice.title, notice.body, {
      type: 'notice',
      noticeId: notice.id,
      noticeType: notice.noticeType,
      societyId,
    });

    console.log(
      `[noticeScheduler] Notice ${notice.id}: ${result.successCount} sent, ${result.failureCount} failed`
    );

    // Clean up invalid tokens
    if (result.invalidTokens.length > 0) {
      await supabaseAdmin
        .from('fcm_tokens')
        .delete()
        .in('token', result.invalidTokens);
    }
  } catch (err) {
    console.error('[noticeScheduler] sendNoticeToAudience error:', err);
  }
}

/**
 * checkScheduledNotices
 * Queries notices where status='draft' AND scheduled_at <= now().
 * Publishes them and fires FCM.
 * Called every 60s via setInterval in index.ts.
 */
export async function checkScheduledNotices(): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Fetch due drafts
    const { data: dueDrafts, error: fetchError } = await supabaseAdmin
      .from('notices')
      .select('*')
      .eq('status', 'draft')
      .lte('scheduled_at', now)
      .limit(50);

    if (fetchError) {
      console.error('[noticeScheduler] Error fetching scheduled notices:', fetchError.message);
      return;
    }

    if (!dueDrafts || dueDrafts.length === 0) {
      return;
    }

    console.log(`[noticeScheduler] Publishing ${dueDrafts.length} scheduled notice(s)`);

    const publishedNow = new Date().toISOString();

    for (const row of dueDrafts) {
      const notice = row as Record<string, unknown>;

      // Update to published
      const { error: updateError } = await supabaseAdmin
        .from('notices')
        .update({
          status: 'published',
          published_at: publishedNow,
          updated_at: publishedNow,
        })
        .eq('id', notice['id'] as string)
        .eq('status', 'draft'); // Optimistic lock — only update if still draft

      if (updateError) {
        console.error(
          `[noticeScheduler] Failed to publish notice ${notice['id']}: ${updateError.message}`
        );
        continue;
      }

      // Fire FCM
      await sendNoticeToAudience(
        {
          id: notice['id'] as string,
          societyId: notice['society_id'] as string,
          title: notice['title'] as string,
          body: notice['body'] as string,
          audience: notice['audience'] as string,
          noticeType: notice['notice_type'] as string,
        },
        notice['society_id'] as string
      );
    }
  } catch (err) {
    console.error('[noticeScheduler] checkScheduledNotices error:', err);
  }
}
