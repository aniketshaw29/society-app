import { Stack } from 'expo-router';

export default function GuardLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a73e8' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Guard Dashboard' }} />
    </Stack>
  );
}
