import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#1a73e8',
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="choose" options={{ headerShown: false }} />
      <Stack.Screen
        name="register-society"
        options={{ title: 'Create Society', headerBackVisible: false }}
      />
      <Stack.Screen name="join-society" options={{ title: 'Join a Society' }} />
      <Stack.Screen name="select-flat" options={{ title: 'Select Your Flat' }} />
    </Stack>
  );
}
