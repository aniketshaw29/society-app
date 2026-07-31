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
      {/* ── Bottom tab screens ─────────────────────────────── */}
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
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: 'Notices',
          tabBarLabel: 'Notices',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ── Non-tab screens (hidden from tab bar) ──────────── */}

      {/* Visitor approval modal */}
      <Tabs.Screen
        name="approve/[visitorId]"
        options={{
          href: null,
          title: 'Visitor Approval',
          presentation: 'modal',
        }}
      />

      {/* SOS screen */}
      <Tabs.Screen
        name="sos"
        options={{
          href: null,
          title: 'Emergency SOS',
          headerStyle: { backgroundColor: '#DC2626' },
          headerTintColor: '#FFFFFF',
        }}
      />

      {/* Pre-approvals */}
      <Tabs.Screen
        name="pre-approvals/index"
        options={{
          href: null,
          title: 'Pre-Approvals',
          headerShown: true,
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
      <Tabs.Screen
        name="pre-approvals/[id]"
        options={{
          href: null,
          title: 'Pre-Approval Details',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="pre-approvals/qr-modal"
        options={{
          href: null,
          title: 'Guest QR Code',
          presentation: 'modal',
          headerShown: false,
        }}
      />

      {/* Flat members */}
      <Tabs.Screen
        name="flat-members/index"
        options={{
          href: null,
          title: 'Flat Members',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="flat-members/add"
        options={{
          href: null,
          title: 'Add Member',
          headerShown: true,
        }}
      />

      {/* Staff — accessible via dashboard quick action, removed from tabs */}
      <Tabs.Screen
        name="staff/index"
        options={{
          href: null,
          title: 'Manage Staff',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="staff/add"
        options={{
          href: null,
          title: 'Add Staff',
          headerShown: true,
        }}
      />
    </Tabs>
  );
}
