import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1a73e8' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#E5E7EB' },
      }}
    >
      {/* ── Tab screens ───────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerShown: false,
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage/residents"
        options={{
          title: 'Manage',
          tabBarLabel: 'Manage',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notices/index"
        options={{
          title: 'Notices',
          tabBarLabel: 'Notices',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ── Manage sub-screens (non-tab) ───────────────────── */}
      <Tabs.Screen
        name="manage/buildings"
        options={{ href: null, title: 'Buildings' }}
      />
      <Tabs.Screen
        name="manage/flats"
        options={{ href: null, title: 'Flats' }}
      />
      <Tabs.Screen
        name="manage/guards"
        options={{ href: null, title: 'Guards' }}
      />

      {/* ── Onboarding screens (non-tab) ───────────────────── */}
      <Tabs.Screen
        name="onboarding/buildings"
        options={{ href: null, title: 'Add Buildings', headerBackVisible: false }}
      />
      <Tabs.Screen
        name="onboarding/flats"
        options={{ href: null, title: 'Add Flats' }}
      />
      <Tabs.Screen
        name="onboarding/residents"
        options={{ href: null, title: 'Add Residents' }}
      />
      <Tabs.Screen
        name="onboarding/guards"
        options={{ href: null, title: 'Add Guards' }}
      />

      {/* ── Notices sub-screens (non-tab) ──────────────────── */}
      <Tabs.Screen
        name="notices/create"
        options={{ href: null, title: 'New Notice' }}
      />
      <Tabs.Screen
        name="notices/edit"
        options={{ href: null, title: 'Edit Notice' }}
      />

      {/* ── Report sub-screens (non-tab) ───────────────────── */}
      <Tabs.Screen
        name="reports/visitor-log"
        options={{ href: null, title: 'Visitor Log' }}
      />
      <Tabs.Screen
        name="reports/staff-log"
        options={{ href: null, title: 'Staff Visits' }}
      />
      <Tabs.Screen
        name="reports/sos-history"
        options={{ href: null, title: 'SOS History' }}
      />
    </Tabs>
  );
}
