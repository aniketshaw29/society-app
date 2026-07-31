# Developer Skills and Patterns Reference

This file is a living reference for patterns used in this project. When adding new features, match these patterns exactly. This prevents inconsistencies and reduces the surface area for bugs.

---

## 1. Supabase RLS Patterns

Row-Level Security is the backbone of multi-tenancy. All policies live in `supabase/migrations/`.

### Pattern: Resident Read Access (Most Common)

Residents can read rows that belong to their society.

```sql
CREATE POLICY "residents_can_read_{table}" ON {table}
  FOR SELECT
  TO authenticated
  USING (
    society_id IN (
      SELECT society_id FROM residents
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );
```

### Pattern: Admin-Only Write Access

Only admins and super_admins can create, update, or delete records.

```sql
CREATE POLICY "admins_can_write_{table}" ON {table}
  FOR INSERT
  TO authenticated
  WITH CHECK (
    society_id IN (
      SELECT society_id FROM residents
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND status = 'active'
    )
  );

CREATE POLICY "admins_can_update_{table}" ON {table}
  FOR UPDATE
  TO authenticated
  USING (
    society_id IN (
      SELECT society_id FROM residents
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND status = 'active'
    )
  )
  WITH CHECK (
    society_id IN (
      SELECT society_id FROM residents
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND status = 'active'
    )
  );
```

### Pattern: Guard Write Access (for gate_entries, visitor_logs)

Guards can insert but not update or delete.

```sql
CREATE POLICY "guards_can_insert_gate_entries" ON gate_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    society_id IN (
      SELECT society_id FROM residents
      WHERE user_id = auth.uid()
        AND role IN ('guard', 'admin', 'super_admin')
        AND status = 'active'
    )
  );
```

### Pattern: Owner Can Edit Their Own Row

Residents can edit their own profile but not other residents' profiles.

```sql
CREATE POLICY "residents_can_update_own_profile" ON residents
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Pattern: Visitor Self-Service (resident can manage their own visitors)

```sql
CREATE POLICY "residents_manage_own_visitors" ON visitor_logs
  FOR ALL
  TO authenticated
  USING (
    society_id IN (
      SELECT society_id FROM residents WHERE user_id = auth.uid()
    )
    AND (
      -- Resident can manage visitors they created
      created_by = auth.uid()
      -- Admins can manage all visitors in their society
      OR EXISTS (
        SELECT 1 FROM residents
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'super_admin')
          AND society_id = visitor_logs.society_id
      )
    )
  );
```

### Pattern: Storage Policy (Supabase Storage)

Storage bucket policies are set in the Supabase dashboard or via `storage-policies.sql`.

```sql
-- Allow authenticated users to upload visitor photos for their society
CREATE POLICY "residents_upload_visitor_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'visitor-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT society_id::text FROM residents WHERE user_id = auth.uid()
    )
  );

-- Allow residents to view photos from their society
CREATE POLICY "residents_view_visitor_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visitor-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT society_id::text FROM residents WHERE user_id = auth.uid()
    )
  );
```

### RLS Testing Checklist

After adding any new policy:

1. Log in as a resident from Society A, confirm they can read their data
2. Log in as a resident from Society B, confirm they cannot read Society A's data
3. Log in as a guard, confirm they can insert but not delete
4. Log in as an admin, confirm they can insert, update, and delete
5. Log in as an unauthenticated user, confirm they get an empty result (not an error)

---

## 2. React Native + Expo Patterns

### Pattern: Screen with Data Loading

```tsx
// mobile/app/(app)/visitors/index.tsx
import { View, FlatList, ActivityIndicator } from 'react-native';
import { useVisitors } from '../../../hooks/useVisitors';
import { VisitorCard } from '../../../components/visitor/VisitorCard';

export default function VisitorsScreen() {
  const { visitors, loading, error, refresh } = useVisitors();

  if (loading) return <ActivityIndicator className="flex-1" />;
  if (error) return <ErrorView message={error} onRetry={refresh} />;

  return (
    <FlatList
      data={visitors}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <VisitorCard visitor={item} />}
      onRefresh={refresh}
      refreshing={loading}
    />
  );
}
```

### Pattern: Form with Validation

```tsx
import { useState } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';

export default function AddVisitorForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!/^[6-9]\d{9}$/.test(phone)) errs.phone = 'Enter a valid 10-digit Indian mobile number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ name, phone });
  };

  return (
    <View>
      <TextInput value={name} onChangeText={setName} placeholder="Visitor name" />
      {errors.name && <Text className="text-red-500">{errors.name}</Text>}
      <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
      {errors.phone && <Text className="text-red-500">{errors.phone}</Text>}
      <Pressable onPress={handleSubmit}>
        <Text>Add Visitor</Text>
      </Pressable>
    </View>
  );
}
```

### Pattern: Role-Based UI Rendering

```tsx
import { useAuthStore } from '../../store/authStore';

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const role = useAuthStore(state => state.user?.role);
  if (!['admin', 'super_admin'].includes(role ?? '')) return null;
  return <>{children}</>;
}

// Usage
<AdminOnly>
  <DeleteButton onPress={handleDelete} />
</AdminOnly>
```

### Pattern: Expo Router Navigation

```tsx
import { router } from 'expo-router';

// Navigate programmatically
router.push('/visitor/new');
router.push({ pathname: '/visitor/[id]', params: { id: visitor.id } });
router.back();
router.replace('/(auth)');  // Replace stack (after logout)
```

---

## 3. Push Notification Send Pattern (FCM via Backend)

### Step 1: Register FCM Token on App Start

```ts
// mobile/lib/notifications.ts
import messaging from '@react-native-firebase/messaging';
import { api } from './api';

export async function registerPushToken() {
  const permission = await messaging().requestPermission();
  const enabled =
    permission === messaging.AuthorizationStatus.AUTHORIZED ||
    permission === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) return;

  const fcmToken = await messaging().getToken();

  // Save token to backend (which stores it in Supabase residents table)
  await api.post('/notifications/register-token', { fcmToken });
}

// Listen for token refresh
export function onTokenRefresh() {
  return messaging().onTokenRefresh(async (newToken) => {
    await api.post('/notifications/register-token', { fcmToken: newToken });
  });
}
```

### Step 2: Store Token in Database

```sql
-- In residents table
ALTER TABLE residents ADD COLUMN fcm_token TEXT;
ALTER TABLE residents ADD COLUMN fcm_token_updated_at TIMESTAMPTZ;
```

```js
// backend/src/routes/notifications.js
router.post('/register-token', requireAuth, async (req, res) => {
  const { fcmToken } = req.body;

  await supabase
    .from('residents')
    .update({
      fcm_token: fcmToken,
      fcm_token_updated_at: new Date().toISOString()
    })
    .eq('user_id', req.user_id)
    .eq('society_id', req.society_id);

  res.json({ success: true });
});
```

### Step 3: Send Notification from Backend

```js
// backend/src/services/firebase.js
const admin = require('firebase-admin');

// Initialize once at startup
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function sendToUser(fcmToken, title, body, data = {}) {
  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { sound: 'default' }
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } }
      }
    };

    await admin.messaging().send(message);
  } catch (err) {
    // Token may be stale — clean up
    if (err.code === 'messaging/registration-token-not-registered') {
      await supabase
        .from('residents')
        .update({ fcm_token: null })
        .eq('fcm_token', fcmToken);
    }
    // Don't throw — notification failure should not break the main flow
    console.error('FCM send failed:', err.message);
  }
}

async function sendToSociety(societyId, title, body, data = {}) {
  const { data: residents } = await supabase
    .from('residents')
    .select('fcm_token')
    .eq('society_id', societyId)
    .eq('status', 'active')
    .not('fcm_token', 'is', null);

  const tokens = residents.map(r => r.fcm_token);
  if (tokens.length === 0) return;

  // Batch in groups of 500 (FCM limit per multicast)
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    await admin.messaging().sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      )
    });
  }
}

module.exports = { sendToUser, sendToSociety };
```

### Step 4: Trigger Notification on Gate Entry

```js
// backend/src/routes/gates.js
const { sendToUser } = require('../services/firebase');

router.post('/entry', requireAuth, async (req, res) => {
  const { visitor_name, flat_id } = req.body;

  // 1. Log the entry
  const { data: entry } = await supabase
    .from('gate_entries')
    .insert({ society_id: req.society_id, visitor_name, flat_id, ...req.body })
    .select()
    .single();

  // 2. Find resident's FCM token
  const { data: residents } = await supabase
    .from('residents')
    .select('fcm_token, name')
    .eq('flat_id', flat_id)
    .not('fcm_token', 'is', null);

  // 3. Notify all residents in that flat
  for (const resident of residents) {
    await sendToUser(
      resident.fcm_token,
      'Visitor at Gate',
      `${visitor_name} has arrived`,
      { type: 'gate_entry', entry_id: entry.id }
    );
  }

  res.json(entry);
});
```

---

## 4. Phone OTP Auth Flow Pattern

### Full Flow

```
Mobile: Collect phone number (+91XXXXXXXXXX)
  |
  v
POST /api/auth/send-otp { phone }
  |
Backend: Rate limit check (max 5 OTP/hour per phone)
  |
Backend: Generate 6-digit OTP, store in memory (Redis or in-process Map with TTL)
  |
Backend: Send OTP via MSG91 API
  |
  v
Mobile: Show OTP input screen
  |
  v
POST /api/auth/verify-otp { phone, otp }
  |
Backend: Verify OTP (check in-memory store, check expiry)
  |
Backend: Find or create Supabase user with phone
  |
Backend: Generate signed JWT with { user_id, society_id, role }
  |
  v
Mobile: Store JWT in SecureStore
Mobile: Store user/society in Zustand authStore
Mobile: Redirect to app home
```

### Backend OTP Implementation

```js
// backend/src/utils/otp.js
const crypto = require('crypto');

// In-process OTP store — for production, replace with Redis
const otpStore = new Map();

function generateOTP(phone) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = crypto.createHash('sha256').update(otp + phone).digest('hex');

  otpStore.set(phone, {
    hash,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    attempts: 0
  });

  // Clean up after expiry
  setTimeout(() => otpStore.delete(phone), 6 * 60 * 1000);

  return otp; // Return plain OTP to send via SMS
}

function verifyOTP(phone, submittedOTP) {
  const record = otpStore.get(phone);

  if (!record) return { success: false, reason: 'OTP not found or expired' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { success: false, reason: 'OTP expired' };
  }
  if (record.attempts >= 3) {
    otpStore.delete(phone);
    return { success: false, reason: 'Too many attempts' };
  }

  const hash = crypto.createHash('sha256').update(submittedOTP + phone).digest('hex');
  if (hash !== record.hash) {
    record.attempts++;
    return { success: false, reason: 'Invalid OTP' };
  }

  otpStore.delete(phone);
  return { success: true };
}

module.exports = { generateOTP, verifyOTP };
```

### Mobile Auth Store

```ts
// mobile/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  token: string | null;
  user: { id: string; phone: string; name: string; role: string } | null;
  society_id: string | null;
  setAuth: (token: string, user: any, society_id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      society_id: null,
      setAuth: async (token, user, society_id) => {
        await SecureStore.setItemAsync('auth_token', token);
        set({ token, user, society_id });
      },
      logout: async () => {
        await SecureStore.deleteItemAsync('auth_token');
        set({ token: null, user: null, society_id: null });
      }
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist the actual token — use SecureStore
      partialize: (state) => ({ user: state.user, society_id: state.society_id })
    }
  )
);
```

---

## 5. Offline Sync Pattern for Guards

Guards in basement parking or underground areas need to log entries without network. Use an offline queue backed by AsyncStorage.

### Queue Manager

```ts
// mobile/lib/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';

const QUEUE_KEY = 'offline_gate_entries';

export async function queueGateEntry(entry: any) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  queue.push({ ...entry, queued_at: new Date().toISOString(), synced: false });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function syncOfflineEntries() {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return { synced: 0, failed: 0 };

  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return { synced: 0, failed: 0 };

  const queue: any[] = JSON.parse(raw);
  const pending = queue.filter(e => !e.synced);

  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await api.post('/gate-entries', entry);
      entry.synced = true;
      synced++;
    } catch {
      failed++;
    }
  }

  // Remove synced entries, keep failed ones for retry
  const remaining = queue.filter(e => !e.synced);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));

  return { synced, failed };
}
```

### Auto-Sync on Network Restore

```ts
// mobile/hooks/useOfflineSync.ts
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineEntries } from '../lib/offlineQueue';

export function useOfflineSync() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncOfflineEntries().then(({ synced }) => {
          if (synced > 0) {
            // Show a toast: "Synced X offline entries"
          }
        });
      }
    });

    return unsubscribe;
  }, []);
}
```

### Use in Gate Entry Screen

```tsx
// mobile/app/(app)/gate/entry.tsx
import { queueGateEntry } from '../../../lib/offlineQueue';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import NetInfo from '@react-native-community/netinfo';

export default function GateEntryScreen() {
  useOfflineSync(); // Auto-sync when network restores

  const handleLogEntry = async (entryData: any) => {
    const state = await NetInfo.fetch();

    if (state.isConnected) {
      // Online: post directly
      await api.post('/gate-entries', entryData);
    } else {
      // Offline: queue for later
      await queueGateEntry(entryData);
      Alert.alert('Saved Offline', 'Entry saved and will sync when network is available.');
    }
  };

  // ...
}
```

---

## 6. Multi-Tenant Query Pattern

### Backend Middleware (Trust Source)

```js
// backend/src/middleware/society.js
// This middleware runs after requireAuth and injects society_id from JWT
module.exports = function injectSociety(req, res, next) {
  // society_id is embedded in the JWT payload by our auth endpoint
  if (!req.user?.society_id) {
    return res.status(403).json({ error: 'No society context in token' });
  }
  req.society_id = req.user.society_id;
  next();
};
```

**Never trust `society_id` from the request body.** Always use `req.society_id` (from the JWT) in backend queries.

### Backend Query Pattern

```js
// Always use req.society_id, never req.body.society_id
const { data } = await supabase
  .from('announcements')
  .select('id, title, body, created_at')
  .eq('society_id', req.society_id)  // <- from JWT, not from client
  .order('created_at', { ascending: false })
  .limit(20);
```

### Mobile Query Pattern

```ts
// mobile/hooks/useAnnouncements.ts
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export function useAnnouncements() {
  const society_id = useAuthStore(state => state.society_id);

  useEffect(() => {
    if (!society_id) return;

    supabase
      .from('announcements')
      .select('*')
      .eq('society_id', society_id)  // <- always scope to society
      .order('created_at', { ascending: false })
      .then(({ data }) => setAnnouncements(data ?? []));
  }, [society_id]);
}
```

---

## 7. File Upload Pattern (Visitor Photos to Supabase Storage)

### Upload from Guard's Camera

```ts
// mobile/hooks/useVisitorPhoto.ts
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { decode } from 'base64-arraybuffer';

export function useVisitorPhoto() {
  const society_id = useAuthStore(state => state.society_id);

  const captureAndUpload = async (visitorId: string): Promise<string | null> => {
    // 1. Open camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4]
    });

    if (result.canceled || !result.assets[0].base64) return null;

    const asset = result.assets[0];
    const fileName = `${society_id}/${visitorId}/${Date.now()}.jpg`;

    // 2. Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('visitor-photos')
      .upload(fileName, decode(asset.base64), {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('Upload failed:', error.message);
      return null;
    }

    // 3. Return the storage path (not a public URL — use signed URL to display)
    return data.path;
  };

  const getSignedUrl = async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage
      .from('visitor-photos')
      .createSignedUrl(path, 60 * 60); // 1-hour expiry

    return data?.signedUrl ?? null;
  };

  return { captureAndUpload, getSignedUrl };
}
```

### Display a Visitor Photo

```tsx
import { Image } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function VisitorPhoto({ storagePath }: { storagePath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) return;
    supabase.storage
      .from('visitor-photos')
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [storagePath]);

  if (!url) return <PlaceholderAvatar />;
  return <Image source={{ uri: url }} style={{ width: 80, height: 80, borderRadius: 8 }} />;
}
```

---

## 8. Real-Time Subscription Pattern (Supabase Realtime in React Native)

### Pattern: Subscribe to New Visitor Logs

```ts
// mobile/hooks/useVisitorRealtime.ts
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useVisitorRealtime(onNewEntry: (entry: any) => void) {
  const society_id = useAuthStore(state => state.society_id);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!society_id) return;

    // Create a channel scoped to this society
    const channel = supabase
      .channel(`visitor_logs:${society_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'visitor_logs',
          filter: `society_id=eq.${society_id}`
        },
        (payload) => {
          onNewEntry(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime connected for visitor_logs');
        }
      });

    channelRef.current = channel;

    // Always unsubscribe on cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [society_id, onNewEntry]);
}
```

### Pattern: Subscribe to Multiple Tables

```ts
export function useSocietyRealtime() {
  const society_id = useAuthStore(state => state.society_id);

  useEffect(() => {
    if (!society_id) return;

    const channel = supabase
      .channel(`society:${society_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcements',
        filter: `society_id=eq.${society_id}`
      }, (payload) => handleAnnouncement(payload))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'emergency_alerts',
        filter: `society_id=eq.${society_id}`
      }, (payload) => handleEmergencyAlert(payload))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [society_id]);
}
```

### Important Realtime Notes

- The filter `society_id=eq.{uuid}` requires the table to have Realtime enabled in the Supabase dashboard (Settings > Replication > enable for table)
- Channel names must be unique per subscription — use `table:society_id` as the naming pattern
- Always call `supabase.removeChannel()` in the useEffect cleanup to prevent memory leaks and connection buildup
- On the free tier, max 200 concurrent connections. Each screen with a subscription uses 1 connection. Be deliberate about what subscribes to Realtime.

---

## 9. Common Hooks and Utilities to Build

These are the hooks every feature will need. Build them once and reuse.

### useQuery — Generic Data Fetcher

```ts
// mobile/hooks/useQuery.ts
import { useState, useEffect, useCallback } from 'react';

export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refresh: fetch };
}
```

### useMutation — Generic Action Handler

```ts
// mobile/hooks/useMutation.ts
import { useState } from 'react';

export function useMutation<TInput, TOutput>(
  mutator: (input: TInput) => Promise<TOutput>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (input: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutator(input);
      return result;
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
```

### useRole — Role-Based Access

```ts
// mobile/hooks/useRole.ts
import { useAuthStore } from '../store/authStore';

export function useRole() {
  const role = useAuthStore(state => state.user?.role);

  return {
    isResident: role === 'resident',
    isGuard: role === 'guard',
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    role
  };
}
```

### useDebounce — For Search Inputs

```ts
// mobile/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

### formatPhone — Normalize Indian Phone Numbers

```ts
// mobile/lib/phone.ts
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  throw new Error('Invalid phone number');
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
  // Returns: +91 98765 43210
}
```

### Supabase Client Setup

```ts
// mobile/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/database';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  }
);
```

### Axios API Instance with Auth

```ts
// mobile/lib/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Attach auth token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
      // Trigger logout in auth store
      // (import authStore carefully to avoid circular deps)
    }
    return Promise.reject(error);
  }
);
```
