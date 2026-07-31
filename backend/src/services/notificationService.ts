import { supabaseAdmin } from '../lib/supabaseAdmin';
import { sendPushToMany, sendPushNotification } from '../lib/firebase';

// ============================================================
// Notification payloads
// ============================================================

export interface NotificationPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

// ============================================================
// Fetch helpers
// ============================================================

async function getFlatResidentTokens(flatId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('fcm_tokens')
    .select('token')
    .in(
      'user_id',
      supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('flat_id', flatId)
        .eq('is_active', true)
    );

  if (error || !data) {
    console.error('[notificationService] getFlatResidentTokens error:', error?.message);
    return [];
  }

  return data.map((row: { token: string }) => row.token);
}

async function getSocietyMemberTokens(societyId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('fcm_tokens')
    .select('token')
    .in(
      'user_id',
      supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('society_id', societyId)
        .eq('is_active', true)
    );

  if (error || !data) {
    console.error('[notificationService] getSocietyMemberTokens error:', error?.message);
    return [];
  }

  return data.map((row: { token: string }) => row.token);
}

async function getUserTokens(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('[notificationService] getUserTokens error:', error?.message);
    return [];
  }

  return data.map((row: { token: string }) => row.token);
}

// ============================================================
// Public notification functions
// ============================================================

/**
 * Send a push notification to all residents of a flat.
 * Fetches tokens for all active user_profiles with flat_id = flatId.
 */
export async function notifyFlatResidents(
  _societyId: string,
  flatId: string,
  notification: NotificationPayload
): Promise<void> {
  try {
    const tokens = await getFlatResidentTokens(flatId);
    if (tokens.length === 0) {
      console.log(`[notificationService] No FCM tokens found for flat ${flatId}`);
      return;
    }

    const result = await sendPushToMany(
      tokens,
      notification.title,
      notification.body,
      notification.data
    );

    console.log(
      `[notificationService] notifyFlatResidents flat=${flatId}: ` +
        `${result.successCount} sent, ${result.failureCount} failed`
    );

    // Clean up invalid tokens
    if (result.invalidTokens.length > 0) {
      await removeInvalidTokens(result.invalidTokens);
    }
  } catch (err) {
    console.error('[notificationService] notifyFlatResidents error:', err);
  }
}

/**
 * Send a push notification to a specific guard (by their user_id).
 */
export async function notifyGuard(
  guardUserId: string,
  notification: NotificationPayload
): Promise<void> {
  try {
    const tokens = await getUserTokens(guardUserId);
    if (tokens.length === 0) {
      console.log(`[notificationService] No FCM tokens found for guard user ${guardUserId}`);
      return;
    }

    if (tokens.length === 1) {
      const result = await sendPushNotification(
        tokens[0] as string,
        notification.title,
        notification.body,
        notification.data
      );
      if (!result.success) {
        console.warn(`[notificationService] notifyGuard failed: ${result.error}`);
      }
    } else {
      const result = await sendPushToMany(
        tokens,
        notification.title,
        notification.body,
        notification.data
      );
      console.log(
        `[notificationService] notifyGuard user=${guardUserId}: ` +
          `${result.successCount} sent, ${result.failureCount} failed`
      );
      if (result.invalidTokens.length > 0) {
        await removeInvalidTokens(result.invalidTokens);
      }
    }
  } catch (err) {
    console.error('[notificationService] notifyGuard error:', err);
  }
}

/**
 * Broadcast a push notification to all active members of a society.
 */
export async function notifySociety(
  societyId: string,
  notification: NotificationPayload
): Promise<void> {
  try {
    const tokens = await getSocietyMemberTokens(societyId);
    if (tokens.length === 0) {
      console.log(`[notificationService] No FCM tokens found for society ${societyId}`);
      return;
    }

    const result = await sendPushToMany(
      tokens,
      notification.title,
      notification.body,
      notification.data
    );

    console.log(
      `[notificationService] notifySociety society=${societyId}: ` +
        `${result.successCount} sent, ${result.failureCount} failed`
    );

    if (result.invalidTokens.length > 0) {
      await removeInvalidTokens(result.invalidTokens);
    }
  } catch (err) {
    console.error('[notificationService] notifySociety error:', err);
  }
}

// ============================================================
// Token cleanup
// ============================================================

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;

  const { error } = await supabaseAdmin
    .from('fcm_tokens')
    .delete()
    .in('token', tokens);

  if (error) {
    console.error('[notificationService] removeInvalidTokens error:', error.message);
  } else {
    console.log(`[notificationService] Removed ${tokens.length} invalid FCM token(s)`);
  }
}
