import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests push notification permissions and returns the Expo push token.
 * Must be called on a real physical device (not simulator) to get a token.
 *
 * @returns The Expo push token string, or null if permission was denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[FCM] Push notifications require a physical device.');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[FCM] Push notification permission denied.');
    return null;
  }

  // Android-specific channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a73e8',
    });

    await Notifications.setNotificationChannelAsync('visitor', {
      name: 'Visitor Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500],
      lightColor: '#F59E0B',
    });
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    // TODO: Replace with your EAS project ID from app.config.ts / eas.json
    // projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  });

  const expoPushToken = tokenData.data;
  console.log('[FCM] Expo push token:', expoPushToken);

  // TODO: Register Firebase Cloud Messaging (FCM) native token
  // This requires @react-native-firebase/messaging:
  //   import messaging from '@react-native-firebase/messaging';
  //   const fcmToken = await messaging().getToken();
  //   console.log('[FCM] FCM native token:', fcmToken);
  //   return fcmToken;

  // TODO: Send the token to your backend so it can send targeted push notifications:
  //   await api.post('/users/push-token', { token: expoPushToken });

  return expoPushToken;
}

/**
 * Unregisters the device from push notifications.
 * Call this on logout to stop receiving notifications.
 */
export async function unregisterPushNotifications(): Promise<void> {
  // TODO: Notify backend to remove the token:
  //   await api.delete('/users/push-token');

  // TODO: With Firebase:
  //   import messaging from '@react-native-firebase/messaging';
  //   await messaging().deleteToken();

  console.log('[FCM] Push notifications unregistered.');
}
