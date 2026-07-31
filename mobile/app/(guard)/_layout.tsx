import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function GuardLayout() {
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
      <Tabs.Screen
        name="gate"
        options={{
          title: 'Gate',
          tabBarLabel: 'Gate',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
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
      {/* Keep legacy index hidden from tabs but accessible for back-compat */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          title: 'Guard Dashboard',
        }}
      />
      {/* visitor-detail is a nested stack screen, not a tab */}
      <Tabs.Screen
        name="visitor-detail/[id]"
        options={{
          href: null,
          title: 'Visitor Detail',
          headerShown: true,
        }}
      />
      {/* Log visitor modal — guard manually logs a new visitor */}
      <Tabs.Screen
        name="log-visitor"
        options={{
          href: null,
          title: 'Log Visitor',
          headerShown: true,
        }}
      />
      {/* Camera screen — guard captures visitor photo */}
      <Tabs.Screen
        name="capture-photo"
        options={{
          href: null,
          title: 'Capture Photo',
          headerShown: false,
        }}
      />
      {/* OTP Entry — guard verifies guest pre-approval OTP */}
      <Tabs.Screen
        name="otp-verify"
        options={{
          href: null,
          title: 'OTP Entry',
          headerShown: true,
        }}
      />
      {/* QR scan screen — guard scans resident's pre-approval QR code */}
      <Tabs.Screen
        name="qr-scan"
        options={{
          href: null,
          title: 'Scan QR',
          headerShown: false,
        }}
      />
      {/* Staff search screen — guard searches and logs recurring staff entry */}
      <Tabs.Screen
        name="staff-search"
        options={{
          href: null,
          title: 'Staff Search',
          headerShown: true,
        }}
      />
    </Tabs>
  );
}
