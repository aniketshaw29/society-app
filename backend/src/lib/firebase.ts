import * as admin from 'firebase-admin';
import { getConfig } from '../config';

// ============================================================
// Firebase Admin SDK initialization
// ============================================================

let _app: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (_app) return _app;

  // Return existing app if already initialized (e.g., in tests)
  if (admin.apps.length > 0 && admin.apps[0]) {
    _app = admin.apps[0];
    return _app;
  }

  const cfg = getConfig();

  _app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: cfg.FIREBASE_PROJECT_ID,
      clientEmail: cfg.FIREBASE_CLIENT_EMAIL,
      privateKey: cfg.FIREBASE_PRIVATE_KEY,
    }),
  });

  return _app;
}

// ============================================================
// Push notification helpers
// ============================================================

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MulticastResult {
  successCount: number;
  failureCount: number;
  results: PushResult[];
  invalidTokens: string[];
}

/**
 * Send a push notification to a single FCM token.
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<PushResult> {
  const app = getFirebaseApp();
  const messaging = admin.messaging(app);

  const message: admin.messaging.Message = {
    token,
    notification: { title, body },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'society_alerts',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    ...(data ? { data } : {}),
  };

  try {
    const messageId = await messaging.send(message);
    return { success: true, messageId };
  } catch (err: unknown) {
    const fcmError = err as { code?: string; message?: string };
    const errorCode = fcmError.code ?? 'unknown';
    const errorMessage = fcmError.message ?? 'FCM send failed';

    // Log but don't throw — callers should handle gracefully
    console.error(`[FCM] sendPushNotification failed for token ${token.slice(0, 10)}...:`, {
      code: errorCode,
      message: errorMessage,
    });

    return {
      success: false,
      error: `${errorCode}: ${errorMessage}`,
    };
  }
}

/**
 * Send a push notification to multiple FCM tokens (multicast).
 * Automatically filters out invalid/unregistered tokens from the result.
 */
export async function sendPushToMany(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<MulticastResult> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, results: [], invalidTokens: [] };
  }

  const app = getFirebaseApp();
  const messaging = admin.messaging(app);

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'society_alerts',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    ...(data ? { data } : {}),
  };

  const invalidTokens: string[] = [];

  try {
    const batchResponse = await messaging.sendEachForMulticast(message);

    const results: PushResult[] = batchResponse.responses.map((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code ?? 'unknown';
        // Track tokens that are no longer valid for cleanup
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(tokens[idx] as string);
        }
        return {
          success: false,
          error: `${errorCode}: ${resp.error?.message ?? 'Unknown error'}`,
        };
      }
      return { success: true, messageId: resp.messageId };
    });

    return {
      successCount: batchResponse.successCount,
      failureCount: batchResponse.failureCount,
      results,
      invalidTokens,
    };
  } catch (err: unknown) {
    const fcmError = err as { code?: string; message?: string };
    console.error('[FCM] sendPushToMany failed:', fcmError);

    return {
      successCount: 0,
      failureCount: tokens.length,
      results: tokens.map(() => ({
        success: false,
        error: `${fcmError.code ?? 'unknown'}: ${fcmError.message ?? 'Batch send failed'}`,
      })),
      invalidTokens: [],
    };
  }
}

/**
 * Send a notification to all FCM tokens of users in a society.
 * Fetches tokens from the database and dispatches.
 */
export async function sendPushToSociety(
  societyId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<MulticastResult> {
  const { supabaseAdmin } = await import('./supabaseAdmin');

  const { data: tokens, error } = await supabaseAdmin
    .from('fcm_tokens')
    .select('token, user_id')
    .in(
      'user_id',
      supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('society_id', societyId)
        .eq('is_active', true)
    );

  if (error || !tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, results: [], invalidTokens: [] };
  }

  const tokenStrings = tokens.map((t: { token: string }) => t.token);
  return sendPushToMany(tokenStrings, title, body, data);
}
