# Society App — Claude Code Context

This file is read by Claude Code AI assistant to understand the project before making any changes. Read this file completely before touching any code.

---

## Project Overview

Society App is a multi-tenant Society Management SaaS for residential housing societies in India. It is a mobile-first product built with React Native + Expo, backed by a Node.js/Express API hosted on Render, using Supabase for database, auth, realtime, and storage, Firebase FCM for push notifications, and MSG91/2Factor for SMS OTP.

The product is similar to MyGate but designed for smaller societies and affordable deployment on free tiers. One backend deployment serves all societies (multi-tenant). Data isolation is enforced via Supabase Row-Level Security (RLS) policies keyed on `society_id`.

**Target users:**
- Residents: view visitor history, pre-authorize visitors, receive alerts, book facilities
- Security Guards: log entries/exits, scan visitor QR codes, take visitor photos
- Society Admins: manage residents, post announcements, raise maintenance bills, view reports
- Super Admin (platform owner): onboard new societies, view platform metrics

---

## Tech Stack Details

| Component | Technology | Version / Notes |
|---|---|---|
| Mobile | React Native | via Expo SDK 51+ |
| Routing | Expo Router | v3, file-based routing |
| State | Zustand | Lightweight global state |
| DB client (mobile) | @supabase/supabase-js | Anon key, RLS enforced |
| Styling | NativeWind (Tailwind for RN) | Or StyleSheet API |
| Backend | Node.js + Express | v20+, hosted on Render |
| Database | PostgreSQL via Supabase | Row-level security |
| Auth | Custom OTP + Supabase Auth | Phone OTP only, no email/password |
| Realtime | Supabase Realtime | WebSocket channels |
| Push notifications | Firebase Admin SDK (backend) | FCM HTTP v1 API |
| Storage | Supabase Storage | Visitor photos, avatars |
| SMS OTP | MSG91 or 2Factor.in | India DLT registered |
| OTA Updates | Expo Updates / EAS Update | JS-only changes |

---

## Folder Structure

```
society-app/
├── backend/                    # Node.js/Express API (deployed to Render)
│   ├── src/
│   │   ├── routes/             # One file per feature domain
│   │   ├── middleware/         # Auth, society injection, rate limiting
│   │   ├── services/           # External service clients (Supabase, FCM, SMS)
│   │   └── utils/              # Pure utility functions
│   ├── server.js               # App entry point, registers all routes
│   └── .env                    # Never commit this
│
├── mobile/                     # Expo React Native app
│   ├── app/                    # Expo Router screens
│   │   ├── (auth)/             # Login flow — no auth required
│   │   └── (app)/              # Protected screens — requires valid JWT
│   ├── components/             # Reusable React Native components
│   ├── hooks/                  # Custom hooks (data fetching, auth, realtime)
│   ├── lib/                    # Supabase client, Axios instance, storage utils
│   ├── store/                  # Zustand stores
│   ├── types/                  # TypeScript interfaces and Supabase types
│   └── constants/              # App-wide constants (colors, spacing, config)
│
├── supabase/
│   ├── migrations/             # SQL files, applied in order via supabase db push
│   └── seed.sql                # Dev/test seed data
│
└── docs/
    ├── deployment.md           # All deployment instructions
    └── skills.md               # Code patterns and templates
```

---

## Key Conventions

### Naming

- **Files:** `camelCase.ts` for utilities and hooks, `PascalCase.tsx` for components, `kebab-case` for route segments in Expo Router
- **Database tables:** `snake_case`, plural (e.g., `visitor_logs`, `gate_entries`)
- **Database columns:** `snake_case` (e.g., `society_id`, `created_at`, `flat_number`)
- **TypeScript interfaces:** `PascalCase`, no `I` prefix (e.g., `Visitor`, `Society`, `GateEntry`)
- **Hooks:** `useSomething.ts` (e.g., `useVisitors.ts`, `useRealtime.ts`)
- **Zustand stores:** `somethingStore.ts` (e.g., `authStore.ts`)
- **Backend routes:** plural nouns, kebab-case (e.g., `/api/visitor-logs`, `/api/gate-entries`)

### File Structure Rules

- **One feature per route file in backend** — `routes/visitors.js` handles all visitor-related endpoints
- **One hook per data domain** — don't mix visitor and announcement logic in the same hook
- **Components are dumb** — business logic lives in hooks and stores, not inside component files
- **No inline styles** — use NativeWind classes or a `styles` constant at the bottom of the file
- **No magic strings** — use `constants/` for repeated values

### Multi-Tenancy Rules

- **Every database table** (except `societies` itself) must have a `society_id UUID NOT NULL` column with a foreign key to `societies.id`
- **Every query** (both backend and mobile Supabase queries) must filter by `society_id`
- **RLS is the safety net, not the primary guard** — always filter in code AND let RLS be the backup
- **Backend middleware** (`src/middleware/society.js`) injects `req.society_id` from the JWT on every authenticated request
- **Mobile** reads `society_id` from `authStore` and passes it to every query

---

## Always-Remember Rules

These are non-negotiable. Do not write code that violates them.

### 1. society_id on Every Query

```js
// WRONG — never do this
const { data } = await supabase.from('visitors').select('*');

// CORRECT — always scope to society
const { data } = await supabase
  .from('visitors')
  .select('*')
  .eq('society_id', society_id);
```

### 2. RLS Must Be Enabled on Every Table

When creating a new migration with a new table:

```sql
-- Step 1: Create table
CREATE TABLE new_feature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  -- other columns
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Enable RLS immediately — never skip this
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

-- Step 3: Add policies — see docs/skills.md for policy templates
```

### 3. Phone OTP is the Only Auth Method

- No email/password auth. No OAuth. No magic links.
- Authentication flow: Mobile collects phone number -> Backend sends OTP via SMS -> Mobile submits OTP -> Backend verifies -> Backend signs Supabase JWT -> Mobile stores JWT
- The `SUPABASE_SERVICE_ROLE_KEY` is used **only** in the backend to create/fetch users after OTP verification
- The mobile app uses the **anon key** only

### 4. Service Role Key is Backend-Only

```js
// CORRECT — backend service (has service role key)
// backend/src/services/supabase.js
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORRECT — mobile app (anon key only, RLS enforced)
// mobile/lib/supabase.ts
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Never put `SUPABASE_SERVICE_ROLE_KEY` in mobile/.env or app.json.**

### 5. FCM Notifications Go Through Backend Only

The mobile app never calls FCM directly. All push notifications are sent via a backend endpoint that holds the Firebase Admin credentials.

### 6. Offline-First for Guards

Gate entry screens (`mobile/app/(app)/gate/`) must handle offline scenarios. Use the offline queue pattern (see `docs/skills.md`). Guards in basement parking or low-signal areas cannot be blocked from logging entries.

---

## How to Run the Project

```bash
# Backend (from backend/ directory)
npm run dev                    # Starts nodemon with hot reload on port 3000

# Mobile (from mobile/ directory)
npx expo start                 # Starts Metro bundler
# Then: press 'a' for Android, 'i' for iOS, scan QR for Expo Go

# Run backend tests
cd backend && npm test

# Run database migrations against your linked Supabase project
supabase db push

# Generate TypeScript types from Supabase schema
supabase gen types typescript --linked > mobile/types/database.ts

# Check migration status
supabase db diff
```

---

## Test Commands

```bash
# Backend unit tests (Jest)
cd backend && npm test

# Backend test with coverage
cd backend && npm run test:coverage

# Backend test in watch mode
cd backend && npm run test:watch

# Lint mobile app
cd mobile && npx expo lint

# TypeScript type check (mobile)
cd mobile && npx tsc --noEmit

# Check for RLS policy gaps (manual step in Supabase SQL editor)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Common Patterns

### How to Add a New Feature (e.g., "Parking Slots")

**Step 1: Database migration**

Create `supabase/migrations/005_parking.sql`:

```sql
CREATE TABLE parking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  slot_number TEXT NOT NULL,
  flat_id UUID REFERENCES flats(id),
  vehicle_number TEXT,
  is_occupied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE parking_slots ENABLE ROW LEVEL SECURITY;

-- Residents can view parking in their society
CREATE POLICY "residents_view_parking" ON parking_slots
  FOR SELECT USING (
    society_id IN (
      SELECT society_id FROM residents WHERE user_id = auth.uid()
    )
  );

-- Only admins can modify parking
CREATE POLICY "admins_manage_parking" ON parking_slots
  FOR ALL USING (
    society_id IN (
      SELECT society_id FROM residents
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
```

Run: `supabase db push`

**Step 2: Regenerate TypeScript types**

```bash
supabase gen types typescript --linked > mobile/types/database.ts
```

**Step 3: Backend route**

Create `backend/src/routes/parking.js`:

```js
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const supabase = require('../services/supabase');

// GET /api/parking - list all slots for society
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('parking_slots')
    .select('*')
    .eq('society_id', req.society_id)
    .order('slot_number');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
```

Register in `server.js`:

```js
app.use('/api/parking', require('./src/routes/parking'));
```

**Step 4: Mobile hook**

Create `mobile/hooks/useParking.ts`:

```ts
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useParking() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/parking')
      .then(res => setSlots(res.data))
      .finally(() => setLoading(false));
  }, []);

  return { slots, loading };
}
```

**Step 5: Screen**

Create `mobile/app/(app)/parking/index.tsx` using the hook.

---

### How to Add a New RLS Policy

Always add policies in a migration file, not manually in the Supabase dashboard (they won't persist properly across team members).

```sql
-- Template for a new policy
CREATE POLICY "policy_name" ON table_name
  FOR [SELECT | INSERT | UPDATE | DELETE | ALL]
  [TO authenticated]
  USING (
    -- Row filter: which rows this user can access
    society_id IN (
      SELECT society_id FROM residents WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Write filter: what values can be inserted/updated
    society_id IN (
      SELECT society_id FROM residents WHERE user_id = auth.uid()
    )
  );
```

See `docs/skills.md` for more RLS policy templates.

---

## Things to Never Do

| Action | Why |
|---|---|
| Query without `society_id` filter | Exposes all tenants' data |
| Put `SUPABASE_SERVICE_ROLE_KEY` in mobile code | Bypasses all RLS, full DB access |
| Disable RLS on any table (`ALTER TABLE x DISABLE ROW LEVEL SECURITY`) | Breaks tenant isolation |
| Add email/password auth | Violates phone-only auth contract |
| Send FCM notifications from mobile | Firebase credentials should not be in client |
| Store unencrypted OTPs in database | OTPs are in-memory only with expiry |
| Use `*` in select without field list in sensitive tables | Avoid leaking unneeded data |
| Commit `.env` files or `firebase-service-account.json` | Credential exposure |
| Create a table without `society_id` column (unless it's a lookup table) | Multi-tenancy breaks |
| Skip the `WITH CHECK` clause on INSERT/UPDATE policies | Allows writing to other societies |
| Use `supabase.rpc()` without checking function's `SECURITY DEFINER` vs `INVOKER` | Can bypass RLS |
| Use `DELETE CASCADE` shortcuts to avoid RLS on child tables | Child tables still need their own RLS |
| Hardcode phone numbers or society names in seed data that matches prod | Seed data leaks |

---

## Architecture Decisions

### Why Node.js backend instead of direct Supabase from mobile?

- OTP verification requires server-side logic and secret API keys (MSG91)
- FCM notifications require Firebase Admin SDK (service account)
- Rate limiting for OTP requests must be server-side
- Some business logic (billing calculations, report generation) should not run on mobile
- The backend is a thin layer — most reads go directly from mobile to Supabase via RLS

### Why Supabase over Firebase Firestore?

- Postgres gives us proper relational modeling (flats, residents, visitors — all have FK relationships)
- RLS policies are SQL — auditable, version-controlled, powerful
- Realtime is built on Postgres logical replication — very reliable
- Free tier is more generous for our use case (50K MAU vs Firestore's operations count)

### Why Expo Router over React Navigation?

- File-based routing mirrors web development mental model
- Easier deep linking setup (important for visitor QR codes)
- Built-in layout system (tabs, stacks) reduces boilerplate

### Why Zustand over Redux?

- Less boilerplate for a solo developer
- Works well with React Native
- Persist middleware integrates with AsyncStorage easily
- Society_id and user profile live in `authStore` and are read by all other stores

---

## Security Checklist

Before deploying any change, verify:

- [ ] New tables have RLS enabled
- [ ] All RLS policies tested with multiple user accounts from different societies
- [ ] No service role key in mobile code
- [ ] New backend endpoints use `requireAuth` middleware
- [ ] OTP codes are not logged in production logs
- [ ] File upload endpoints validate mime type and size
- [ ] All user inputs are validated (use `validators.js`)
- [ ] `society_id` is taken from JWT (not from request body) in backend endpoints
