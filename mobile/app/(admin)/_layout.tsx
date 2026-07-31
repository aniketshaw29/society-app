import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a73e8' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen
        name="onboarding/buildings"
        options={{ title: 'Add Buildings', headerBackVisible: false }}
      />
      <Stack.Screen name="onboarding/flats" options={{ title: 'Add Flats' }} />
      <Stack.Screen name="onboarding/residents" options={{ title: 'Add Residents' }} />
      <Stack.Screen name="onboarding/guards" options={{ title: 'Add Guards' }} />
    </Stack>
  );
}
