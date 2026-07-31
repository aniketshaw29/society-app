import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? 'SocietyApp',
  slug: 'society-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1a73e8',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier:
      process.env.EXPO_PUBLIC_IOS_BUNDLE_ID ?? 'com.societyapp.mobile',
    buildNumber: '1',
    infoPlist: {
      NSCameraUsageDescription:
        'SocietyApp uses your camera to scan visitor QR codes and capture entry photos.',
      NSPhotoLibraryUsageDescription:
        'SocietyApp needs access to your photo library to upload profile photos.',
      NSLocationWhenInUseUsageDescription:
        'SocietyApp uses your location to verify gate check-ins.',
      NSFaceIDUsageDescription:
        'SocietyApp uses Face ID for quick and secure login.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a73e8',
    },
    package:
      process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'com.societyapp.mobile',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#1a73e8',
        sounds: ['./assets/notification.wav'],
        androidMode: 'default',
        androidCollapsedTitle: 'SocietyApp',
        iosDisplayInForeground: true,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'SocietyApp needs camera access to scan visitor QR codes.',
      },
    ],
    [
      'expo-sqlite',
      {
        enableFTS: true,
        useSQLCipher: false,
      },
    ],
    [
      'expo-secure-store',
      {
        faceIDPermission: 'SocietyApp uses Face ID for secure authentication.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'SocietyApp uses Face ID for quick login.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'SocietyApp needs photo library access to upload your profile picture.',
        cameraPermission:
          'SocietyApp needs camera access to take profile photos.',
      },
    ],
    'expo-font',
  ],
  extra: {
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? 'your-eas-project-id',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL,
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: `https://u.expo.dev/${
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? 'your-eas-project-id'
    }`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  scheme: 'societyapp',
});
