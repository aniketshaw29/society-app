import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ResidentLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1B6B3A' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#1B6B3A',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#E5E7EB' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="visitors"
        options={{
          title: 'Visitors',
          tabBarLabel: 'Visitors',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Non-tab screens — hidden from tab bar */}
      <Tabs.Screen
        name="approve/[visitorId]"
        options={{
          href: null,
          title: 'Visitor Approval',
          presentation: 'modal',
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          href: null,
          title: 'Notices',
        }}
      />
      {/* Pre-approvals: list + create — nested under pre-approvals/ */}
      <Tabs.Screen
        name="pre-approvals/index"
        options={{
          href: null,
          title: 'Pre-Approvals',
          headerShown: true,
          headerRight: () => null, // header right injected by screen via useNavigation
        }}
      />
      <Tabs.Screen
        name="pre-approvals/create"
        options={{
          href: null,
          title: 'New Pre-Approval',
          headerShown: true,
        }}
      />
    </Tabs>
  );
}
