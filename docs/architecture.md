# Society Management SaaS — Architecture Document

**Version:** 1.0  
**Date:** 2026-07-31  
**Stack:** React Native + Expo | Node.js/Express on Render | Supabase | Firebase FCM | MSG91

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Component Breakdown](#2-component-breakdown)
3. [Authentication Flow](#3-authentication-flow)
4. [Visitor Approval Real-Time Flow](#4-visitor-approval-real-time-flow)
5. [Multi-Tenant Data Isolation](#5-multi-tenant-data-isolation)
6. [Offline-First Strategy for Guards](#6-offline-first-strategy-for-guards)
7. [Push Notification Architecture](#7-push-notification-architecture)
8. [File Storage Strategy](#8-file-storage-strategy)
9. [API Design Principles](#9-api-design-principles)
10. [Security Considerations](#10-security-considerations)
11. [Scalability Notes and Upgrade Path](#11-scalability-notes-and-upgrade-path)

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENTS (React Native + Expo)                 │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐ │
│   │  Super Admin │  │ Society Admin│  │ Flat Owner  │  │     Guard      │ │
│   │    App       │  │    App       │  │  / Tenant   │  │  App (Offline) │ │
│   └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  └───────┬────────┘ │
└──────────┼────────────────┼─────────────────┼──────────────────┼──────────┘
           │                │                 │                  │
           │         HTTPS / WSS              │         HTTPS + Local SQLite
           │                │                 │                  │
┌──────────▼────────────────▼─────────────────▼──────────────────▼──────────┐
│                     API GATEWAY / BFF (Express on Render)                  │
│                                                                             │
│   ┌───────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│   │  Auth     │  │  Visitor     │  │  Resident    │  │  Sync / Offline  │ │
│   │  Service  │  │  Service     │  │  Service     │  │  Queue Service   │ │
│   └─────┬─────┘  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
│         │               │                 │                    │           │
│   ┌─────▼───────────────▼─────────────────▼────────────────────▼─────────┐ │
│   │              Rate Limiter + JWT Middleware + RLS Enforcement          │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
           ┌───────────────────────────┼────────────────────────┐
           │                           │                        │
┌──────────▼──────────┐   ┌────────────▼────────────┐  ┌───────▼──────────┐
│     SUPABASE         │   │   FIREBASE FCM           │  │   MSG91 / 2Factor│
│                      │   │                          │  │                  │
│  ┌────────────────┐  │   │  ┌────────────────────┐  │  │  OTP SMS Gateway │
│  │   PostgreSQL   │  │   │  │  Push Notification │  │  │  (India numbers) │
│  │   (multi-      │  │   │  │  Delivery          │  │  └──────────────────┘
│  │   tenant RLS)  │  │   │  └────────────────────┘  │
│  ├────────────────┤  │   └──────────────────────────┘
│  │  Auth (JWT +   │  │
│  │  Phone OTP)    │  │
│  ├────────────────┤  │
│  │  Realtime      │  │
│  │  (WebSocket    │  │
│  │   channels)    │  │
│  ├────────────────┤  │
│  │  Storage       │  │
│  │  (Visitor      │  │
│  │   Photos)      │  │
│  └────────────────┘  │
└──────────────────────┘
```

### Data Flow Summary

```
Mobile App
   │
   ├──[Auth]──────────► Supabase Auth (phone OTP via MSG91)
   │
   ├──[API calls]─────► Express on Render (validation, business logic, RLS enforcement)
   │                        │
   │                        └──► Supabase PostgreSQL (data persistence)
   │
   ├──[Realtime]──────► Supabase Realtime (visitor status updates, guard notifications)
   │
   ├──[Push]──────────► Firebase FCM (resident approval notifications)
   │
   ├──[Storage]───────► Supabase Storage (visitor photos)
   │
   └──[Offline]───────► Device SQLite (guard offline queue) ──sync──► Express API
```

---

## 2. Component Breakdown

### 2.1 Mobile App Modules (React Native + Expo)

```
src/
├── app/                          # Expo Router file-based routing
│   ├── (auth)/                   # Unauthenticated screens
│   │   ├── login.tsx             # Phone number entry
│   │   └── otp-verify.tsx        # OTP input screen
│   ├── (super-admin)/            # Super Admin stack
│   │   ├── dashboard.tsx         # Platform stats
│   │   ├── societies/            # Society CRUD
│   │   └── admins/               # Admin management
│   ├── (society-admin)/          # Society Admin stack
│   │   ├── dashboard.tsx
│   │   ├── buildings/            # Building + flat management
│   │   ├── residents/            # Resident management
│   │   ├── guards/               # Guard management
│   │   └── notices/              # Notice board
│   ├── (resident)/               # Flat Owner / Tenant stack
│   │   ├── dashboard.tsx
│   │   ├── visitors/             # Visitor approvals + history
│   │   ├── pre-approve/          # Guest pre-approval + OTP gen
│   │   ├── staff/                # Recurring staff management
│   │   ├── qr-code.tsx           # Resident QR for gate entry
│   │   └── sos.tsx               # Emergency SOS
│   └── (guard)/                  # Guard stack
│       ├── dashboard.tsx
│       ├── visitor-entry.tsx     # Manual visitor log form
│       ├── qr-scanner.tsx        # QR code scan
│       ├── otp-verify.tsx        # Validate pre-approved OTP
│       ├── staff-log.tsx         # Recurring staff check-in/out
│       └── approvals.tsx         # Real-time approval status
│
├── components/                   # Shared UI components
│   ├── VisitorCard.tsx
│   ├── ApprovalStatus.tsx
│   ├── QRGenerator.tsx
│   └── CameraCapture.tsx
│
├── hooks/                        # Custom React hooks
│   ├── useSupabaseRealtime.ts    # Visitor status subscription
│   ├── useOfflineSync.ts         # Guard offline sync manager
│   ├── usePushNotifications.ts   # FCM token registration
│   └── useAuth.ts
│
├── services/
│   ├── api.ts                    # Express backend calls (axios)
│   ├── supabase.ts               # Supabase client init
│   ├── fcm.ts                    # Firebase FCM setup
│   ├── offline/
│   │   ├── db.ts                 # SQLite (expo-sqlite) setup
│   │   ├── schema.ts             # Local table definitions
│   │   └── syncQueue.ts          # Sync queue processor
│   └── storage.ts                # Supabase Storage helpers
│
├── store/                        # Zustand state management
│   ├── authStore.ts
│   ├── visitorStore.ts
│   └── societyStore.ts
│
└── utils/
    ├── otp.ts                    # OTP generation helpers
    ├── qr.ts                     # QR encode/decode
    └── permissions.ts            # Role-based feature gates
```

### 2.2 Backend Services (Node.js/Express on Render)

```
server/
├── src/
│   ├── index.ts                  # Express app entry point
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification (Supabase JWT secret)
│   │   ├── tenant.ts             # Extract + validate society_id from JWT
│   │   ├── rateLimiter.ts        # express-rate-limit configs
│   │   └── errorHandler.ts
│   │
│   ├── routes/
│   │   ├── auth.ts               # /api/auth/* (OTP trigger, session)
│   │   ├── visitors.ts           # /api/visitors/* (CRUD, approve/deny)
│   │   ├── residents.ts          # /api/residents/*
│   │   ├── societies.ts          # /api/societies/* (super-admin only)
│   │   ├── buildings.ts          # /api/buildings/*
│   │   ├── staff.ts              # /api/staff/* (recurring staff)
│   │   ├── notices.ts            # /api/notices/*
│   │   ├── sync.ts               # /api/sync/* (guard offline batch upload)
│   │   └── notifications.ts      # /api/notifications/* (FCM token mgmt)
│   │
│   ├── services/
│   │   ├── supabaseAdmin.ts      # Supabase service role client
│   │   ├── fcm.ts                # Firebase Admin SDK
│   │   ├── sms.ts                # MSG91 / 2Factor OTP dispatch
│   │   ├── qr.ts                 # QR payload sign/verify
│   │   └── otp.ts                # Pre-approval OTP generate/validate
│   │
│   └── types/
│       ├── tenant.ts
│       └── visitor.ts
│
└── supabase/
    ├── migrations/               # SQL migration files
    ├── functions/                # Supabase Edge Functions
    │   ├── on-visitor-created/   # Trigger push notification
    │   └── on-approval-updated/  # Notify guard of decision
    └── seed.sql
```

### 2.3 Database Schema (Key Tables)

```sql
-- Core multi-tenant tables (society_id on every row)
societies          (id, name, address, plan, created_at)
buildings          (id, society_id, name, floors)
flats              (id, building_id, society_id, number, floor)
profiles           (id, user_id, society_id, role, flat_id, phone, fcm_token)
guards             (id, society_id, user_id, gate_name, is_active)

-- Visitor management
visitors           (id, society_id, name, phone, photo_url, type,
                    flat_id, guard_id, status, entry_time, exit_time,
                    created_at, otp_code, otp_expires_at, qr_token)
visitor_approvals  (id, visitor_id, resident_id, decision, decided_at, note)

-- Staff management
staff              (id, society_id, name, phone, photo_url, category,
                    allowed_flats jsonb, is_active)
staff_logs         (id, staff_id, society_id, guard_id, action, timestamp)

-- Notices
notices            (id, society_id, title, body, created_by, created_at)

-- Offline sync tracking
sync_queue         (id, guard_id, society_id, payload jsonb,
                    synced_at, created_at)
```

---

## 3. Authentication Flow

### 3.1 Overview

Authentication uses Supabase Phone Auth (OTP) with SMS delivery via MSG91 or 2Factor.in. The Supabase JWT is the primary credential for all subsequent API calls.

```
Phone Auth Flow:

User enters phone number
        │
        ▼
Mobile App ──POST /api/auth/send-otp──► Express Server
                                              │
                                              ├──► MSG91 API (send SMS OTP)
                                              │        │
                                              │        └── SMS "Your OTP: 123456"
                                              │                   │
                                              │                   ▼
                                              │              User's Phone
                                              │
                                              └──► Supabase Auth
                                                   signInWithOtp({ phone })
                                                        │
                                                        ▼
User enters OTP in app
        │
        ▼
Mobile App ──supabase.auth.verifyOtp()──► Supabase Auth
                                               │
                                     ┌─────────▼──────────┐
                                     │  Returns:           │
                                     │  - access_token     │
                                     │  - refresh_token    │
                                     │  - user.id          │
                                     └─────────┬──────────┘
                                               │
        ◄──────────────────────────────────────┘
        │
        ▼
App stores JWT in SecureStore (expo-secure-store)
        │
        ▼
App fetches user profile from Supabase
(profiles table: role, society_id, flat_id)
        │
        ▼
Role-based navigation (Super Admin / Society Admin / Resident / Guard)
```

### 3.2 JWT Claims and Tenant Context

When a user authenticates, a Supabase Database Function (trigger on auth.users) populates custom JWT claims via `auth.jwt()`:

```sql
-- Supabase hook: customize_access_token
CREATE OR REPLACE FUNCTION public.custom_jwt_claims(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  profile_row record;
BEGIN
  SELECT role, society_id, flat_id
  INTO profile_row
  FROM public.profiles
  WHERE user_id = (event->>'userId')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{role}',      to_jsonb(profile_row.role));
  claims := jsonb_set(claims, '{society_id}',to_jsonb(profile_row.society_id));
  claims := jsonb_set(claims, '{flat_id}',   to_jsonb(profile_row.flat_id));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The Express middleware extracts `society_id` and `role` from the decoded JWT and attaches them to `req.tenant` for all downstream handlers.

### 3.3 Session Refresh

```
Mobile App (Supabase client)
  │
  ├── On app foreground: supabase.auth.getSession()
  ├── Auto-refreshes access_token via refresh_token (Supabase handles this)
  └── On 401 from Express: force re-auth with signOut + redirect to login
```

---

## 4. Visitor Approval Real-Time Flow

### 4.1 Flow 1: Guard Manual Entry → Resident Notification → Approve/Deny

```
Guard App          Express API         Supabase DB      Supabase RT     Resident App
    │                   │                   │                │               │
    │──POST /visitors───►                   │                │               │
    │  { name, phone,   │──INSERT visitor──►│                │               │
    │    flat_id,       │  status='pending' │                │               │
    │    photo_url }    │                   │──NOTIFY────────►               │
    │                   │                   │  (realtime     │               │
    │                   │──FCM push─────────┼────────────────┼──────────────►│
    │                   │  "Visitor at      │                │  Receives     │
    │                   │   gate"           │                │  push alert   │
    │                   │                   │                │               │
    │                   │                   │                │  Opens app    │
    │                   │                   │                │  taps Approve │
    │                   │                   │                │               │
    │                   │◄──POST /visitors/:id/approve───────────────────────│
    │                   │                   │                │               │
    │                   │──UPDATE visitor──►│                │               │
    │                   │  status='approved'│                │               │
    │                   │                   │──NOTIFY────────►               │
    │                   │                   │                │               │
    │◄───────────────────────────────────────────────────────│               │
    │  Real-time update │                   │                │               │
    │  status='approved'│                   │                │               │
    │                   │                   │                │               │
    │  Guard sees       │                   │                │               │
    │  green "APPROVED" │                   │                │               │
```

### 4.2 Flow 2: Pre-Approved Guest → OTP Validation

```
Resident App        Express API         Supabase DB       Guard App
    │                   │                   │                  │
    │──POST /pre-approve►                   │                  │
    │  { guest_name,    │──INSERT visitor──►│                  │
    │    phone,         │  status='pre-     │                  │
    │    flat_id,       │  approved',       │                  │
    │    valid_until }  │  otp_code=XXXXXX  │                  │
    │                   │  otp_expires_at   │                  │
    │                   │──SMS OTP─────────────────────────────────► Guest Phone
    │◄──{ otp: XXXXXX } │                   │                  │
    │                   │                   │                  │
    │  (Optional: show  │                   │                  │
    │   OTP in app too) │                   │                  │
    │                   │                   │                  │
    │              [ Guest arrives at gate ]                    │
    │                   │                   │                  │
    │                   │                   │──POST /otp-verify►│
    │                   │◄─────────────────────────────────────│
    │                   │  { otp: XXXXXX,   │                  │
    │                   │    flat_id }       │                  │
    │                   │──SELECT visitor──►│                  │
    │                   │  WHERE otp=XXXXXX │                  │
    │                   │  AND status=      │                  │
    │                   │  'pre-approved'   │                  │
    │                   │  AND NOT expired  │                  │
    │                   │──UPDATE status────►                  │
    │                   │  ='entered'       │                  │
    │                   │──────────────────────────────────────►│
    │                   │                   │  { valid: true,  │
    │                   │                   │    resident_name }│
    │                   │                   │                  │
    │                   │                   │  Guard opens gate│
```

### 4.3 Flow 3: Guard Scans Resident QR Code

```
Resident App        Guard App (scanner)    Express API       Supabase DB
    │                       │                   │                  │
    │  QR contains:         │                   │                  │
    │  JWT-signed payload   │                   │                  │
    │  { resident_id,       │                   │                  │
    │    flat_id,           │                   │                  │
    │    society_id,        │                   │                  │
    │    issued_at }        │                   │                  │
    │                       │                   │                  │
    │  ┌────────────────┐   │                   │                  │
    │  │ Display QR     │   │                   │                  │
    │  │ (refreshed     │   │                   │                  │
    │  │  every 30s)    │   │                   │                  │
    │  └────────────────┘   │                   │                  │
    │                       │                   │                  │
    │             Guard scans QR code           │                  │
    │                       │                   │                  │
    │                       │──POST /qr-verify──►                  │
    │                       │  { qr_token }     │                  │
    │                       │                   │──verify JWT sig  │
    │                       │                   │──check age < 5min│
    │                       │                   │──INSERT visitor──►│
    │                       │                   │  status='entered'│
    │                       │◄──{ valid: true,  │                  │
    │                       │    resident_info } │                  │
    │                       │                   │                  │
    │                       │  Auto-approved    │                  │
    │                       │  Gate opens       │                  │
```

### 4.4 Flow 4: Recurring Staff Check-in/out

```
Guard App           Express API         Supabase DB
    │                   │                   │
    │──GET /staff?society_id──►             │
    │◄──[ staff list ]──│                   │
    │                   │                   │
    │  (offline-capable: list cached in SQLite)
    │                   │                   │
    │  Guard taps staff │                   │
    │  member → "Mark   │                   │
    │   Arrival"        │                   │
    │                   │                   │
    │──POST /staff-logs─►                   │
    │  { staff_id,      │──INSERT log──────►│
    │    action:        │                   │
    │    'arrival' }    │                   │
    │                   │──FCM push─────────────────────► Resident App
    │                   │  "Cook arrived    │             (if flat-mapped)
    │                   │   at 9:02 AM"     │
    │◄──{ logged: true }│                   │
    │                   │                   │
    │  Same flow for    │                   │
    │  'departure'      │                   │
```

---

## 5. Multi-Tenant Data Isolation

### 5.1 Strategy: Row-Level Security (RLS) on society_id

Every table in the database carries a `society_id` foreign key. Supabase RLS policies enforce that users can only access rows belonging to their society. The `society_id` is extracted from the JWT claim (set at login time, not user-supplied).

### 5.2 RLS Policy Examples

```sql
-- ============================================================
-- visitors table: guards and residents see only their society
-- ============================================================
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residents_own_society_visitors" ON visitors
  FOR SELECT USING (
    society_id = (auth.jwt() ->> 'society_id')::uuid
  );

CREATE POLICY "guards_insert_own_society" ON visitors
  FOR INSERT WITH CHECK (
    society_id = (auth.jwt() ->> 'society_id')::uuid
    AND (auth.jwt() ->> 'role') IN ('guard', 'society_admin', 'super_admin')
  );

CREATE POLICY "residents_update_own_flat_visitors" ON visitors
  FOR UPDATE USING (
    flat_id = (auth.jwt() ->> 'flat_id')::uuid
    AND (auth.jwt() ->> 'role') IN ('flat_owner', 'tenant')
  );

-- ============================================================
-- profiles: users see their own profile + society admin sees all
-- ============================================================
CREATE POLICY "own_profile" ON profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      society_id = (auth.jwt() ->> 'society_id')::uuid
      AND (auth.jwt() ->> 'role') = 'society_admin'
    )
  );

-- ============================================================
-- societies: only super_admin can manage all societies
-- ============================================================
CREATE POLICY "super_admin_all_societies" ON societies
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );
```

### 5.3 Express Layer Enforcement (Defense in Depth)

The Express `tenant` middleware adds a secondary enforcement layer:

```typescript
// middleware/tenant.ts
export const tenantMiddleware = (req, res, next) => {
  const jwt = req.user; // decoded by auth middleware
  
  if (!jwt.society_id && jwt.role !== 'super_admin') {
    return res.status(403).json({ error: 'No society context' });
  }

  req.tenant = {
    societyId: jwt.society_id,
    role: jwt.role,
    flatId: jwt.flat_id,
    userId: jwt.sub,
  };

  next();
};

// All Supabase queries in route handlers:
const visitors = await supabase
  .from('visitors')
  .select('*')
  .eq('society_id', req.tenant.societyId);  // Always scoped
```

### 5.4 Tenant Isolation Summary

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| JWT Claims | society_id baked into token at auth | Cannot be spoofed |
| Express Middleware | society_id added to every DB query | Defense in depth |
| Supabase RLS | Postgres policies check society_id | Database-level enforcement |
| Storage Buckets | Visitor photos in `society_id/` prefix | File isolation |
| Realtime Channels | Subscribed to `society:{society_id}:*` | No cross-tenant events |

---

## 6. Offline-First Strategy for Guards

Guards must log visitors even when the device has no internet (basement gates, poor signal areas). The offline queue syncs to the server when connectivity is restored.

### 6.1 Technology Choice: expo-sqlite + Custom Sync Queue

`expo-sqlite` (Expo's built-in SQLite) is used instead of WatermelonDB to avoid native module complexity. A lightweight sync queue with conflict resolution handles the bridge to the server.

### 6.2 Local Database Schema (SQLite)

```sql
-- Guard's local SQLite database
CREATE TABLE offline_visitors (
  id          TEXT PRIMARY KEY,        -- UUID generated locally
  society_id  TEXT NOT NULL,
  flat_id     TEXT,
  name        TEXT NOT NULL,
  phone       TEXT,
  type        TEXT,                    -- 'walk-in', 'staff', 'delivery'
  photo_path  TEXT,                    -- local file path
  action      TEXT NOT NULL,           -- 'entry' | 'exit'
  timestamp   INTEGER NOT NULL,        -- Unix epoch ms
  synced      INTEGER DEFAULT 0,       -- 0=pending, 1=synced, 2=error
  retry_count INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE staff_cache (
  id          TEXT PRIMARY KEY,
  society_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT,
  photo_path  TEXT,
  is_active   INTEGER DEFAULT 1,
  last_synced INTEGER
);

CREATE TABLE approval_cache (
  visitor_id  TEXT PRIMARY KEY,
  status      TEXT,                    -- 'pending'|'approved'|'denied'
  last_updated INTEGER
);
```

### 6.3 Sync Flow

```
Guard App (offline)
    │
    ├── Visitor logs written to offline_visitors (SQLite)
    │   with synced=0
    │
    ├── Photos saved to device filesystem
    │
    │           [ Network becomes available ]
    │
    ▼
SyncQueue (background process, runs every 30s)
    │
    ├── SELECT * FROM offline_visitors WHERE synced=0 ORDER BY timestamp ASC
    │
    ├── For each unsynced record:
    │   ├── Upload photo to Supabase Storage (if any)
    │   ├── POST /api/sync/visitors with batch payload
    │   │       │
    │   │       ▼
    │   │   Express /sync endpoint
    │   │       │
    │   │       ├── Validates all records against society_id in JWT
    │   │       ├── Deduplicates by local UUID (idempotent)
    │   │       ├── INSERT INTO visitors (with original timestamp)
    │   │       └── Returns { synced: [ids], failed: [ids] }
    │   │
    │   ├── UPDATE offline_visitors SET synced=1 WHERE id IN (synced)
    │   └── UPDATE retry_count++ WHERE id IN (failed)
    │
    └── Records with retry_count > 5 are flagged for manual review
```

### 6.4 Connectivity Detection

```typescript
// hooks/useOfflineSync.ts
import NetInfo from '@react-native-community/netinfo';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online);
      if (online) {
        syncQueue.flush();  // Trigger sync when back online
      }
    });
    return unsubscribe;
  }, []);

  return { isOnline };
};
```

### 6.5 Staff List Caching (for Offline Use)

The full staff list for a society is synced to `staff_cache` on app open or when online. Guards can log recurring staff arrivals/departures offline. These logs queue up and sync when connectivity returns.

---

## 7. Push Notification Architecture

### 7.1 FCM Token Registration Flow

```
Mobile App (Expo)
    │
    ├── On login: request notification permission
    │   (expo-notifications)
    │
    ├── Get FCM token:
    │   await Notifications.getExpoPushTokenAsync()
    │   OR
    │   await messaging().getToken()  // Firebase React Native
    │
    ├── POST /api/notifications/register
    │   { fcm_token, device_id, platform: 'ios'|'android' }
    │       │
    │       ▼
    │   Express stores token in profiles.fcm_token
    │   (and notifications_tokens table for multi-device)
    │
    └── On token refresh: repeat registration
```

### 7.2 Notification Trigger Architecture

Two complementary approaches are used:

**Path A: Supabase Edge Function (low-latency, event-driven)**

```
visitor INSERT (status='pending')
    │
    ▼
Supabase Database Webhook / Edge Function
    │   (supabase/functions/on-visitor-created/index.ts)
    │
    ├── Fetch resident's fcm_token from profiles
    │   WHERE flat_id = visitor.flat_id
    │
    ├── Call Firebase Admin SDK (sendEachForMulticast)
    │
    └── FCM delivers to resident's device
```

**Path B: Express API (for complex logic)**

```
POST /api/visitors/:id/approve
    │
    ├── Express updates visitor status
    ├── Calls FCM service to notify guard
    │   (guard's token stored in guards.fcm_token)
    └── Guard sees real-time approval result
```

### 7.3 Notification Payload Structure

```json
{
  "to": "<fcm_device_token>",
  "notification": {
    "title": "Visitor at Gate",
    "body": "Rahul Kumar is here for Flat 4B. Approve?"
  },
  "data": {
    "type": "visitor_approval",
    "visitor_id": "uuid",
    "visitor_name": "Rahul Kumar",
    "photo_url": "https://...",
    "flat_id": "uuid",
    "deep_link": "society://visitors/uuid"
  },
  "android": {
    "priority": "high",
    "ttl": 300
  },
  "apns": {
    "payload": {
      "aps": { "sound": "default", "badge": 1 }
    }
  }
}
```

### 7.4 Notification Types

| Type | Trigger | Recipient | Priority |
|------|---------|-----------|----------|
| `visitor_approval` | Guard logs visitor | Flat resident | High |
| `visitor_approved` | Resident approves | Guard | High |
| `visitor_denied` | Resident denies | Guard | High |
| `staff_arrival` | Guard marks arrival | Resident | Normal |
| `staff_departure` | Guard marks departure | Resident | Normal |
| `pre_approval_otp` | Resident pre-approves | Guest (SMS) | High |
| `notice_board` | Admin posts notice | All residents | Normal |
| `sos_alert` | Resident SOS | Security guards + admin | Critical |

### 7.5 Realtime Updates (Supabase WebSocket)

In addition to push notifications, the Guard App subscribes to Supabase Realtime to receive approval decisions while the app is open:

```typescript
// In Guard App — watch for approval on a pending visitor
const channel = supabase
  .channel(`visitor-${visitorId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'visitors',
      filter: `id=eq.${visitorId}`,
    },
    (payload) => {
      setApprovalStatus(payload.new.status);
    }
  )
  .subscribe();
```

---

## 8. File Storage Strategy

### 8.1 Visitor Photo Storage

```
Supabase Storage Bucket: visitor-photos
    │
    ├── Access: Private (requires signed URL)
    ├── Bucket policies: society_id-scoped via RLS
    │
    └── Path structure:
        /{society_id}/{year}/{month}/{visitor_id}.jpg
        Example: /abc123-soc/2026/07/visitor-uuid-789.jpg
```

### 8.2 Photo Upload Flow (Guard App)

```
Guard taps "Capture Photo"
    │
    ├── expo-camera or expo-image-picker captures image
    │
    ├── Image compressed (max 800x600, 80% quality)
    │   using expo-image-manipulator
    │
    ├── If ONLINE:
    │   ├── Upload to Supabase Storage
    │   │   supabase.storage
    │   │     .from('visitor-photos')
    │   │     .upload(path, file)
    │   └── Store returned public_url in visitors.photo_url
    │
    └── If OFFLINE:
        ├── Save image to device filesystem
        │   (expo-file-system: FileSystem.documentDirectory)
        ├── Store local path in offline_visitors.photo_path
        └── On sync: upload photo first, then log visitor record
```

### 8.3 Signed URL Generation for Viewing

Visitor photos are private. The mobile app requests a short-lived signed URL before displaying:

```typescript
// services/storage.ts
export const getVisitorPhotoUrl = async (photoPath: string) => {
  const { data } = await supabase.storage
    .from('visitor-photos')
    .createSignedUrl(photoPath, 3600); // 1 hour expiry
  return data?.signedUrl;
};
```

### 8.4 Storage RLS Policy

```sql
-- Only users from the same society can access photos
CREATE POLICY "society_photo_access" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'visitor-photos'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'society_id')
  );

CREATE POLICY "guards_upload_photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'visitor-photos'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'society_id')
    AND (auth.jwt() ->> 'role') IN ('guard', 'society_admin')
  );
```

### 8.5 Retention Policy

- Visitor photos are retained for 90 days by default
- A scheduled Supabase Edge Function (CRON) deletes photos older than retention period
- Society Admin can configure retention window (30/60/90/365 days)

---

## 9. API Design Principles

### 9.1 Architecture Decision: Express BFF + Direct Supabase Client

The app uses a hybrid approach:

| Operation | Where handled | Reason |
|-----------|--------------|--------|
| Business logic (approve visitor, generate OTP) | Express on Render | Complex validation, SMS dispatch, FCM calls |
| Simple CRUD (fetch notices, flat list) | Supabase JS client directly | Faster, fewer hops, RLS handles auth |
| Realtime subscriptions | Supabase Realtime directly | WebSocket — no intermediary possible |
| File uploads | Supabase Storage directly | Binary transfer, no point going through Express |
| Auth (OTP send/verify) | Supabase Auth directly | Native support; Express calls SMS provider |

### 9.2 REST API Conventions

```
Base URL: https://society-app.onrender.com/api/v1

Resources:
  POST   /auth/send-otp              Send OTP SMS
  POST   /auth/verify-otp            Verify + return session (calls Supabase)

  GET    /visitors                   List visitors (paginated, filtered)
  POST   /visitors                   Log new visitor (guard)
  GET    /visitors/:id               Get single visitor
  POST   /visitors/:id/approve       Resident approves
  POST   /visitors/:id/deny          Resident denies

  POST   /pre-approvals              Create pre-approved guest + send OTP
  POST   /pre-approvals/verify-otp   Guard validates guest OTP

  POST   /qr/verify                  Guard scans resident QR

  GET    /staff                      List society staff (cached offline)
  POST   /staff-logs                 Log staff arrival/departure

  GET    /societies                  Super admin only
  POST   /societies                  Super admin only

  POST   /sync/visitors              Batch sync from guard offline queue

  POST   /notifications/register     Register FCM token
```

### 9.3 Request/Response Conventions

```typescript
// Standard success response
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}

// Standard error response
{
  "success": false,
  "error": {
    "code": "VISITOR_NOT_FOUND",
    "message": "Visitor with ID xyz does not exist",
    "details": {}
  }
}
```

### 9.4 Versioning

API is versioned via URL path (`/api/v1/`). Breaking changes require a new version. The mobile app sends `X-App-Version` header; Express can reject outdated clients if needed.

---

## 10. Security Considerations

### 10.1 Authentication and JWT

- **JWT verification:** Express verifies Supabase JWTs using the project's `JWT_SECRET` (from environment variables). Tokens are short-lived (1 hour) with refresh token rotation.
- **Refresh tokens:** Stored in `expo-secure-store` (iOS Keychain / Android Keystore), never in AsyncStorage.
- **Role escalation prevention:** Roles are set only by Supabase triggers on the `profiles` table, never by the client. Society Admins cannot change their own role.

### 10.2 Row-Level Security

- RLS is enabled on all tables. The Supabase service role key is used only server-side (Express). The mobile app uses the `anon` key with user JWT.
- Super Admin operations go through Express (which uses service role), not directly from the mobile app.

### 10.3 QR Code Security

- Resident QR codes are JWT-signed with the app's `QR_SECRET` (separate from auth JWT).
- QR tokens expire every 5 minutes (encoded in the payload as `exp`).
- The server verifies signature + expiry before accepting. Prevents screenshot replay attacks.
- QR is regenerated in-app every 30 seconds (auto-refresh).

### 10.4 OTP Security (Pre-Approved Guests)

- OTPs are 6-digit, cryptographically random.
- OTPs expire in 24 hours (configurable per pre-approval).
- OTPs are single-use (marked consumed on first successful verification).
- Failed attempts are rate-limited (5 tries, then locked for 15 minutes).
- OTP stored as a bcrypt hash in the database, not plaintext.

### 10.5 Rate Limiting

```typescript
// middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// OTP send: strict
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 3,                      // 3 OTPs per phone per 15min
  keyGenerator: (req) => req.body.phone,
  message: 'Too many OTP requests'
});

// General API
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 min
  max: 60,                     // 60 requests per minute per user
  keyGenerator: (req) => req.user?.sub || req.ip,
});

// Sync endpoint (guards)
export const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,                     // 10 sync batches per minute
  keyGenerator: (req) => req.user?.sub,
});
```

### 10.6 Input Validation and Sanitization

- All Express routes use `zod` for schema validation. Invalid inputs are rejected with 400.
- Phone numbers are normalized to E.164 format before processing.
- File uploads are validated for MIME type (images only) and size limit (max 5MB).
- SQL injection is not a concern (Supabase JS client uses parameterized queries).

### 10.7 CORS Configuration

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-App-Version'],
  credentials: true,
}));
```

Since the client is a mobile app (not browser), CORS is mainly for future web dashboard. The mobile app communicates via HTTPS directly.

### 10.8 Secrets Management

| Secret | Storage | Access |
|--------|---------|--------|
| Supabase JWT Secret | Render environment variables | Express only |
| Supabase Service Role Key | Render environment variables | Express only |
| Firebase Admin SDK key | Render environment variables | Express only |
| MSG91 API Key | Render environment variables | Express only |
| QR Signing Secret | Render environment variables | Express only |
| Supabase Anon Key | Expo config (public) | Mobile app (safe: RLS enforced) |
| Supabase Project URL | Expo config (public) | Mobile app |

---

## 11. Scalability Notes and Upgrade Path

### 11.1 Current Free Tier Limits

| Service | Free Tier Limit | Expected Usage | Risk |
|---------|----------------|---------------|------|
| Supabase DB | 500 MB storage | ~50 societies, 1M visitor logs/year | Medium |
| Supabase Auth | 50,000 MAU | ~2,000 users at launch | Low |
| Supabase Realtime | 200 concurrent connections | ~50 guards online | Low |
| Supabase Storage | 1 GB | ~10,000 visitor photos (100KB each) | High (photos) |
| Render (Express) | 750 hrs/month; spins down after 15min idle | API calls sporadic | Medium (cold start) |
| FCM | Unlimited (free) | All push notifications | None |
| MSG91 | Pay-per-OTP (no free tier, ~₹0.15/SMS) | Budget item | Operational cost |

### 11.2 Supabase Storage Pressure

Visitor photos at 100KB average, 10 entries/day per gate, 50 societies → **~50K photos/month = 5 GB/month**.

Mitigation on free tier:
- Compress photos to < 50KB at capture time
- 30-day automatic deletion for low-tier societies
- Move to Supabase Pro ($25/month) when storage > 800 MB

### 11.3 Render Cold Start

Free tier Render services spin down after 15 minutes of inactivity, causing 30-60 second cold starts.

Mitigation:
- Keep-alive: A scheduled ping (UptimeRobot free tier) hits `/api/health` every 14 minutes
- On upgrade: Render Starter ($7/month) eliminates spin-down

### 11.4 Supabase Realtime Connections

Each guard's open app holds 1–2 realtime connections. At 200 concurrent limit, this supports ~100 active guards.

Mitigation if exceeded:
- Share a single channel per society (fan-out pattern)
- Upgrade to Supabase Pro (unlimited realtime connections)

### 11.5 Horizontal Scaling Path

```
Phase 1 (Free / MVP, 0-50 societies)
  Supabase Free + Render Free + keep-alive ping

Phase 2 (Growth, 50-200 societies)
  Supabase Pro ($25/mo) — more storage, no connection limits
  Render Starter ($7/mo) — no cold starts
  Total: ~$32/month

Phase 3 (Scale, 200+ societies)
  Supabase Pro or Business tier
  Render Standard (multiple instances, auto-scale)
  Add Redis (Upstash free tier) for distributed rate limiting
  Consider Cloudflare R2 for visitor photo storage (cheaper than Supabase Storage)
  Total: ~$100-300/month

Phase 4 (Enterprise)
  Dedicated Supabase project per large society (full isolation)
  Render or Railway auto-scaling containers
  Separate Firebase projects per region
```

### 11.6 Database Query Optimization

Index strategy from day one to avoid slow queries as data grows:

```sql
-- Frequently queried together
CREATE INDEX idx_visitors_society_status ON visitors (society_id, status, created_at DESC);
CREATE INDEX idx_visitors_flat_id        ON visitors (flat_id, created_at DESC);
CREATE INDEX idx_profiles_user_id        ON profiles (user_id);
CREATE INDEX idx_profiles_society_role   ON profiles (society_id, role);
CREATE INDEX idx_staff_logs_society_date ON staff_logs (society_id, timestamp DESC);
```

### 11.7 Monitoring

- **Supabase Dashboard:** Query performance, slow query logs, storage usage
- **Render Dashboard:** Request logs, CPU/memory, response times
- **Sentry (free tier):** Mobile crash reporting and error tracking
- **Firebase Crashlytics:** Mobile stability
- **UptimeRobot (free):** Express API uptime monitoring

---

## Appendix A: Environment Variables

```bash
# Express on Render
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
FIREBASE_ADMIN_SDK_JSON=...       # Base64-encoded service account JSON
MSG91_AUTH_KEY=...
MSG91_TEMPLATE_ID=...
QR_SIGNING_SECRET=...
OTP_ENCRYPTION_KEY=...
ALLOWED_ORIGINS=...
RENDER_KEEP_ALIVE_TOKEN=...

# Expo Mobile App (public config)
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_BASE_URL=https://society-app.onrender.com/api/v1
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
```

## Appendix B: Key Dependencies

```json
// Mobile (package.json)
{
  "expo": "~51.0.0",
  "react-native": "0.74.x",
  "@supabase/supabase-js": "^2.x",
  "expo-router": "~3.x",
  "expo-sqlite": "~14.x",
  "expo-secure-store": "~13.x",
  "expo-camera": "~15.x",
  "expo-image-manipulator": "~12.x",
  "expo-file-system": "~17.x",
  "expo-notifications": "~0.28.x",
  "@react-native-community/netinfo": "^11.x",
  "@react-native-firebase/app": "^20.x",
  "@react-native-firebase/messaging": "^20.x",
  "react-native-qrcode-svg": "^6.x",
  "expo-barcode-scanner": "~13.x",
  "zustand": "^4.x",
  "zod": "^3.x"
}

// Server (package.json)
{
  "express": "^4.x",
  "@supabase/supabase-js": "^2.x",
  "firebase-admin": "^12.x",
  "express-rate-limit": "^7.x",
  "zod": "^3.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.x",
  "axios": "^1.x",
  "cors": "^2.x",
  "helmet": "^7.x"
}
```

---

*Document maintained by the Society App engineering team. Update version number and date on each significant revision.*
