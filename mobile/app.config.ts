import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Society App',
  slug: 'society-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1B6B3A',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier:
      process.env.EXPO_PUBLIC_IOS_BUNDLE_ID ?? 'com.societyapp.mobile',
    buildNumber: '1',
    infoPlist: {
      NSCameraUsageDescription:
        'Society App uses the camera to capture visitor photos at the gate.',
      NSMicrophoneUsageDescription:
        'Society App needs microphone access for video calls.',
      NSPhotoLibraryUsageDescription:
        'Society App accesses photos to set your profile picture.',
      NSLocationWhenInUseUsageDescription:
        'Society App may use location to identify your society.',
      NSFaceIDUsageDescription:
        'Society App uses Face ID for quick and secure login.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1B6B3A',
    },
    package:
      process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'com.societyapp.mobile',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission:
          'Society App uses the camera to capture visitor photos.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Society App accesses photos for profile pictures.',
        cameraPermission:
          'Society App uses the camera to take profile photos.',
      },
    ],
    'expo-sqlite',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#1B6B3A',
        sounds: [],
        androidMode: 'default',
        androidCollapsedTitle: 'Society App',
        iosDisplayInForeground: true,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Society App uses Face ID for secure login.',
      },
    ],
    'expo-font',
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
    eas: {
      projectId:
        process.env.EXPO_PROJECT_ID ?? 'YOUR_EAS_PROJECT_ID',
    },
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: `https://u.expo.dev/${
      process.env.EXPO_PROJECT_ID ?? 'YOUR_EAS_PROJECT_ID'
    }`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  scheme: 'societyapp',
});
