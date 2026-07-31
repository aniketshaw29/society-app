import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Router } from 'expo-router';
import { supabase } from './supabase';
import api from './api';

// ============================================================
// Foreground notification handler
// ============================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ============================================================
// Types
// ============================================================

export type NotificationData = {
  type:
    | 'visitor_approval'
    | 'visitor_approved'
    | 'visitor_denied'
    | 'sos_alert'
    | 'notice';
  visitorId?: string;
  flatId?: string;
  societyId?: string;
  visitorName?: string;
  purpose?: string;
  photoUrl?: string;
  [key: string]: string | undefined;
};

// ============================================================
// Token persistence
// ============================================================

/**
 * Upsert an FCM/Expo push token to the fcm_tokens table for the current user.
 */
export async function saveTokenToDb(token: string): Promise<void> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn('[notifications] saveTokenToDb: no authenticated user');
      return;
    }

    // Use the backend API so we can enforce auth via JWT
    await api.post('/users/push-token', { token, platform });
  } catch (err) {
    // Fallback: write directly via Supabase client
    console.warn('[notifications] API push-token failed, writing directly:', err);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await supabase.from('fcm_tokens').upsert(
        { user_id: user.id, token, platform },
        { onConflict: 'user_id,token' }
      );
    } catch (fallbackErr) {
      console.error('[notifications] saveTokenToDb fallback error:', fallbackErr);
    }
  }
}

// ============================================================
// Notification routing
// ============================================================

/**
 * Given a notification data payload, return the route to navigate to.
 */
export function getRouteForNotification(data: NotificationData): string | null {
  switch (data.type) {
    case 'visitor_approval':
      return data.visitorId ? `/(resident)/approve/${data.visitorId}` : null;

    case 'visitor_approved':
    case 'visitor_denied':
      return '/(guard)/gate';

    case 'sos_alert':
      return '/(admin)/sos';

    case 'notice':
      return '/(resident)/notices';

    default:
      return null;
  }
}

// ============================================================
// Notification handlers
// ============================================================

/**
 * Handle a notification received while the app is in the foreground.
 * Expo's setNotificationHandler already shows the banner; this hook
 * can be used for additional in-app logic.
 */
export function handleForegroundNotification(
  notification: Notifications.Notification
): void {
  const data = notification.request.content.data as NotificationData;
  console.log('[notifications] Foreground notification received:', data?.type);
  // Additional in-app banner or state update logic can be added here.
}

/**
 * Handle a notification received while the app is in the background/killed.
 * Expo invokes the task registered with registerTaskAsync; this is called
 * from that task handler.
 */
export function handleBackgroundNotification(
  notification: Notifications.Notification
): void {
  const data = notification.request.content.data as NotificationData;
  console.log('[notifications] Background notification received:', data?.type);
}

/**
 * Handle a tap on a notification (response).
 * Navigates to the appropriate screen based on data.type.
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  router: Router
): void {
  const data = response.notification.request.content.data as NotificationData;
  const route = getRouteForNotification(data);

  if (route) {
    console.log('[notifications] Navigating to:', route);
    router.push(route as Parameters<Router['push']>[0]);
  }
}

// ============================================================
// Android channel setup
// ============================================================

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('society_alerts', {
    name: 'Society Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1B6B3A',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('visitor_approval', {
    name: 'Visitor Approvals',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500],
    lightColor: '#F59E0B',
    sound: 'default',
  });
}

// ============================================================
// Main setup function
// ============================================================

/**
 * Full notification bootstrap:
 * 1. Checks device (push requires real device)
 * 2. Requests permission
 * 3. Sets up Android channels
 * 4. Gets Expo push token
 * 5. Persists token to DB
 * 6. Returns cleanup function to remove listeners
 */
export async function setupNotifications(
  router: Router
): Promise<() => void> {
  if (!Device.isDevice) {
    console.warn('[notifications] Push notifications require a physical device.');
    return () => undefined;
  }

  // Permission request
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push notification permission denied.');
    return () => undefined;
  }

  // Android channels
  await ensureAndroidChannels();

  // Get Expo push token
  let token: string | undefined;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env['EXPO_PUBLIC_EAS_PROJECT_ID'],
    });
    token = tokenData.data;
    console.log('[notifications] Expo push token:', token);
  } catch (err) {
    console.error('[notifications] Failed to get push token:', err);
    return () => undefined;
  }

  // Persist to DB
  void saveTokenToDb(token);

  // Foreground listener
  const foregroundSub = Notifications.addNotificationReceivedListener(
    handleForegroundNotification
  );

  // Tap response listener (app in foreground or background, not killed)
  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => handleNotificationResponse(response, router)
  );

  // Handle tap when app was killed — last response
  Notifications.getLastNotificationResponseAsync().then((lastResponse) => {
    if (lastResponse) {
      handleNotificationResponse(lastResponse, router);
    }
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
