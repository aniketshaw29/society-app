# Society Management SaaS — Phase-wise Development Plan

**Stack:** React Native + Expo (mobile only) | Supabase (DB, Auth, Storage, Realtime) | Node.js/Express on Render | Firebase FCM | India-specific (Phone OTP)

**Model:** Multi-tenant SaaS — multiple societies, isolated per tenant

**Roles:** Super Admin | Society Admin | Guard | Flat Owner | Tenant

**Developer:** Solo

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Phase 0 — Project Setup & Infrastructure (Week 1)](#phase-0--project-setup--infrastructure-week-1)
3. [Phase 1 — Auth & Onboarding (Week 2)](#phase-1--auth--onboarding-week-2)
4. [Phase 2 — Core Visitor Management (Weeks 3–4) — MVP](#phase-2--core-visitor-management-weeks-34--mvp)
5. [Phase 3 — Advanced Visitor Flows (Week 5)](#phase-3--advanced-visitor-flows-week-5)
6. [Phase 4 — Resident Features (Week 6)](#phase-4--resident-features-week-6)
7. [Phase 5 — Society Admin Features (Week 7)](#phase-5--society-admin-features-week-7)
8. [Phase 6 — Offline Support for Guards (Week 8)](#phase-6--offline-support-for-guards-week-8)
9. [Phase 7 — Polish & Testing (Week 9)](#phase-7--polish--testing-week-9)
10. [Appendix: DB Schema Reference](#appendix-db-schema-reference)

---

## Testing Strategy

### Frameworks & Tools

| Layer | Tool | Purpose |
|---|---|---|
| Unit tests | Jest | Business logic, utilities, hooks |
| Component tests | React Native Testing Library (RNTL) | UI components in isolation |
| API tests | Supertest | Express route handlers |
| E2E tests | Maestro | Full user flows on real device/emulator |
| RLS tests | pg_tap or Jest + Supabase JS client | Row-level security policies |
| Snapshot tests | Jest + RNTL | Regression-guard UI components |

### File Naming Conventions

```
src/
  __tests__/
    unit/
      utils.test.ts
      hooks/useVisitorLog.test.ts
    integration/
      api/visitors.test.ts
    rls/
      visitors_rls.test.ts
  components/
    VisitorCard/
      VisitorCard.tsx
      VisitorCard.test.tsx          # co-located component test
e2e/
  flows/
    guard_log_visitor.maestro.yaml
    resident_approve.maestro.yaml
  fixtures/
    test-society.json
```

### Coverage Targets

| Scope | Target |
|---|---|
| Business logic / utils | 90%+ |
| API route handlers | 85%+ |
| React Native components | 75%+ |
| E2E critical paths | 100% of P0 flows |
| RLS policies | 100% of every policy |

### Supabase RLS Test Pattern

```ts
// tests/rls/visitors_rls.test.ts
// Sign in as each role, attempt reads/writes, assert allow/deny
describe('visitors RLS', () => {
  it('guard can insert visitor for their society only', async () => { ... });
  it('resident can read own flat visitors only', async () => { ... });
  it('cross-society read is denied', async () => { ... });
});
```

### CI Pipeline (GitHub Actions)

```
lint → unit tests → api tests → rls tests → e2e tests (on PR merge to main)
```

---

## Phase 0 — Project Setup & Infrastructure (Week 1)

### Goals

Establish a working, deployable skeleton that every subsequent phase builds on.

---

### Tasks / Tickets

#### T0-1: Expo Project Init & Folder Structure

**Acceptance Criteria**
- `npx create-expo-app society-app --template blank-typescript` succeeds
- EAS CLI configured and `eas.json` present
- Folder structure matches the layout below
- `expo start` runs without errors

**Files to Create**

```
society-app/
├── app/                        # Expo Router screens
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (guard)/
│   ├── (resident)/
│   ├── (admin)/
│   └── _layout.tsx
├── src/
│   ├── components/             # Shared UI components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client singleton
│   │   ├── api.ts              # Axios/fetch wrapper for backend
│   │   └── fcm.ts              # Firebase messaging helpers
│   ├── stores/                 # Zustand stores
│   │   ├── authStore.ts
│   │   └── societyStore.ts
│   ├── types/                  # Shared TypeScript types
│   │   └── index.ts
│   └── utils/                  # Pure utility functions
├── e2e/                        # Maestro E2E tests
├── docs/
├── .env.example
├── .env.local                  # gitignored
├── app.config.ts               # Dynamic Expo config (reads env vars)
└── eas.json
```

**Test Cases**
- `jest --passWithNoTests` exits 0 (baseline Jest config works)
- TypeScript compiles with `tsc --noEmit`

---

#### T0-2: Supabase Project Setup & Initial Schema

**Acceptance Criteria**
- Supabase project created in `ap-south-1` (Mumbai) region
- All tables created via migration files (not Supabase dashboard)
- RLS enabled on every table
- `supabase db push` applies all migrations cleanly to local and remote

**DB Migrations to Create**

```
supabase/migrations/
  001_initial_schema.sql
  002_rls_policies.sql
  003_storage_buckets.sql
  004_functions.sql
```

`001_initial_schema.sql` — core tables (see [DB Schema Reference](#appendix-db-schema-reference))

`002_rls_policies.sql` — enable RLS and initial policies per table

`003_storage_buckets.sql`

```sql
insert into storage.buckets (id, name, public) values
  ('visitor-photos', 'visitor-photos', false),
  ('profile-photos', 'profile-photos', false);
```

`004_functions.sql`

```sql
-- Helper: get the society_id for the currently authenticated user
create or replace function get_my_society_id()
returns uuid language sql stable security definer as $$
  select society_id from user_profiles where id = auth.uid();
$$;
```

**Test Cases**
- Unit: `get_my_society_id()` returns correct UUID for seeded user
- RLS: Anonymous select on `societies` returns 0 rows
- RLS: Authenticated user can only read their own `user_profiles` row

---

#### T0-3: Render Backend Setup (Node.js/Express)

**Acceptance Criteria**
- Express app deployed to Render (free tier)
- `GET /health` returns `{ status: 'ok', timestamp: ... }`
- Environment variables managed via Render dashboard
- Auto-deploy on push to `main`

**Files to Create**

```
backend/
├── src/
│   ├── index.ts                # Express app bootstrap
│   ├── routes/
│   │   └── health.ts
│   ├── middleware/
│   │   ├── auth.ts             # Verify Supabase JWT
│   │   └── errorHandler.ts
│   ├── lib/
│   │   └── supabaseAdmin.ts    # Service-role Supabase client
│   └── types/
│       └── index.ts
├── tests/
│   └── health.test.ts
├── .env.example
├── package.json
├── tsconfig.json
└── render.yaml
```

**API Endpoints**

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |

**Test Cases**
- Supertest: `GET /health` returns 200 with correct body
- Supertest: Request with missing/invalid JWT to protected route returns 401

---

#### T0-4: Firebase Project Setup

**Acceptance Criteria**
- Firebase project created, FCM enabled
- `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) added via EAS secrets (not committed)
- `expo-notifications` and `@react-native-firebase/messaging` installed and linked
- Test notification delivered to a dev device

**Files to Create**
- `src/lib/fcm.ts` — token registration, foreground/background handler stubs
- `backend/src/lib/firebase.ts` — Firebase Admin SDK init for sending notifications

**Test Cases**
- Unit: `registerForPushNotifications()` calls `getToken()` and stores in DB
- Unit: FCM send function called with correct payload structure

---

#### T0-5: Environment Configuration

**Acceptance Criteria**
- All secrets in `.env.local` (gitignored); `.env.example` documents every key
- `app.config.ts` injects env vars into Expo build via `extra`
- Backend uses `dotenv` + validation (e.g., `zod`) on startup — crashes if required vars missing

**Files to Create / Edit**
- `.env.example`

```
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # backend only

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
# ... other Firebase config keys

# Backend
BACKEND_URL=
API_SECRET_KEY=

# Feature flags
ENABLE_OFFLINE_MODE=false
```

- `backend/src/config.ts` — zod-validated env schema

**Test Cases**
- Unit: Backend startup throws if `SUPABASE_SERVICE_ROLE_KEY` is missing
- Unit: `app.config.ts` correctly maps env vars to `extra` object

---

#### T0-6: CI Basics (GitHub Actions)

**Acceptance Criteria**
- Pipeline runs on every push and PR
- Steps: lint, typecheck, unit tests
- Badge on README

**Files to Create**

```
.github/
  workflows/
    ci.yml
```

`ci.yml` steps:
1. Checkout
2. Setup Node 20
3. Install deps (mobile + backend)
4. `eslint` + `prettier --check`
5. `tsc --noEmit` (both workspaces)
6. `jest --coverage` (both workspaces)
7. Upload coverage to Codecov

---

### Phase 0 Exit Criteria

- [ ] `expo start` runs without errors
- [ ] `GET /health` on Render returns 200
- [ ] Supabase migrations applied, local Studio accessible
- [ ] `.env.example` documents every required variable
- [ ] CI pipeline green on `main`

---

## Phase 1 — Auth & Onboarding (Week 2)

### Goals

Every role can sign in via phone OTP. Users land on the correct screen based on their role. Societies can be created and populated.

---

### Tasks / Tickets

#### T1-1: Phone OTP Login (All Roles)

**Acceptance Criteria**
- User enters Indian phone number (`+91XXXXXXXXXX`)
- Supabase sends OTP via SMS (Twilio or MSG91 provider)
- OTP entry screen with 6-digit input and 30-second resend timer
- On success, Supabase session stored in SecureStore
- On failure (wrong OTP / expired), user-friendly error shown

**Files to Create**

```
app/(auth)/
  login.tsx               # Phone number entry
  otp.tsx                 # OTP verification
src/
  hooks/
    useAuth.ts            # signInWithPhone, verifyOtp, signOut
  stores/
    authStore.ts          # session, user, role, societyId
  lib/
    supabase.ts           # Supabase client (already from T0-2)
  components/
    PhoneInput.tsx        # +91 prefix, numeric keyboard
    OtpInput.tsx          # 6 boxes, auto-advance, paste support
```

**API Endpoints** — none (Supabase Auth handles this directly)

**DB Changes**
```sql
-- In 001_initial_schema.sql (already planned)
-- auth.users managed by Supabase
-- user_profiles links auth.users to roles/societies
```

**Test Cases**
- Unit: `useAuth.signInWithPhone` calls `supabase.auth.signInWithOtp` with formatted number
- Unit: Phone number validation rejects non-10-digit inputs and non-`+91` prefix
- Component: `OtpInput` auto-advances focus on digit entry
- Component: Resend button disabled during 30-second countdown
- E2E (`login_otp.maestro.yaml`): Enter phone → receive OTP → enter OTP → land on dashboard

---

#### T1-2: Role Detection Post-Login

**Acceptance Criteria**
- After OTP verification, app reads `user_profiles.role` from Supabase
- Navigation routes to correct root stack: Guard, Resident, Society Admin, Super Admin
- New users (no `user_profiles` row) route to onboarding screen
- Role stored in `authStore`

**Files to Create / Edit**

```
app/
  _layout.tsx               # Root layout with auth gate + role router
src/
  hooks/
    useRoleRouter.ts        # Determines destination screen from role
```

**Test Cases**
- Unit: `useRoleRouter` returns `/guard` for role `guard`
- Unit: `useRoleRouter` returns `/resident` for role `flat_owner` and `tenant`
- Unit: Missing profile row routes to `/onboarding/join`
- E2E: Guard login lands on gate screen; resident login lands on resident home

---

#### T1-3: Society Self-Registration Flow (Society Admin)

**Acceptance Criteria**
- New user selects "Register my society"
- Fills: Society Name, Address (line 1, city, state, PIN), total buildings count
- Society created with unique `invite_code` (6-char alphanumeric)
- User's `user_profiles` row created with `role = society_admin`
- Duplicate society name in same PIN code shows warning (not hard block)

**Files to Create**

```
app/(onboarding)/
  register-society.tsx
src/
  hooks/
    useSocietyRegistration.ts
  components/
    SocietyForm.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/societies` | Bearer JWT | Create society, returns society_id + invite_code |

**DB Migrations**

```sql
-- Already in 001_initial_schema.sql:
-- societies table with invite_code (unique)
-- user_profiles with role + society_id FK
```

**Test Cases**
- Unit: `invite_code` generator produces 6-char uppercase alphanumeric, no ambiguous chars (O/0/I/1)
- API (Supertest): `POST /societies` with valid body returns 201 + invite_code
- API: Duplicate society name same PIN returns 409 or warning flag in response
- RLS: Authenticated user can only update their own society row

---

#### T1-4: Society Admin Onboards Buildings, Flats, Residents, Guards

**Acceptance Criteria**
- Admin can add buildings (name/number, floor count)
- Admin can add flats (flat number, floor, building FK)
- Admin can add residents to flats (name, phone; sends invite SMS)
- Admin can add guards (name, phone; sends invite SMS)
- CSV bulk-import for flats (optional stretch goal, mark as backlog)

**Files to Create**

```
app/(admin)/
  onboarding/
    buildings.tsx
    flats.tsx
    residents.tsx
    guards.tsx
src/
  hooks/
    useAdminOnboarding.ts
  components/
    admin/
      BuildingForm.tsx
      FlatForm.tsx
      ResidentForm.tsx
      GuardForm.tsx
      OnboardingProgress.tsx    # Shows 4-step wizard progress
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/societies/:id/buildings` | Admin JWT | Add building |
| POST | `/societies/:id/flats` | Admin JWT | Add flat |
| POST | `/societies/:id/residents` | Admin JWT | Add resident, send invite SMS |
| POST | `/societies/:id/guards` | Admin JWT | Add guard, send invite SMS |

**DB Migrations** — already covered in `001_initial_schema.sql`

**Test Cases**
- Unit: Adding a flat without a building FK throws validation error
- API: `POST /societies/:id/guards` with duplicate phone returns 409
- API: Non-admin JWT on admin endpoints returns 403
- RLS: Admin can only insert buildings into their own `society_id`

---

#### T1-5: Resident Joins via Invite Code

**Acceptance Criteria**
- New user selects "Join my society"
- Enters 6-char invite code
- If code valid: society name shown for confirmation
- User selects their flat from a searchable list
- `user_profiles` row created with `role = flat_owner` (default) or `tenant`
- Duplicate join (same phone + same flat already active) blocked with error

**Files to Create**

```
app/(onboarding)/
  join-society.tsx
  select-flat.tsx
src/
  hooks/
    useJoinSociety.ts
  components/
    InviteCodeInput.tsx
    FlatPicker.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/societies/by-invite/:code` | Bearer JWT | Resolve invite code to society |
| POST | `/societies/:id/join` | Bearer JWT | Join society, assign flat |

**Test Cases**
- Unit: Invalid invite code format (< 6 chars, special chars) blocked on client
- API: `GET /societies/by-invite/INVALID` returns 404
- API: Duplicate join returns 409
- E2E (`resident_join.maestro.yaml`): Enter code → pick flat → land on resident home

---

### Phase 1 Exit Criteria

- [ ] All 5 roles can sign in via phone OTP on a real device
- [ ] Role-based routing works for all roles
- [ ] Society can be created, buildings/flats/residents/guards added
- [ ] Resident can join via invite code
- [ ] RLS prevents cross-society data access

---

## Phase 2 — Core Visitor Management (Weeks 3–4) — MVP

### Goals

A guard can log a visitor, the resident receives a real-time push notification, approves or denies, and the guard sees the result instantly. This is the P0 product loop.

---

### Tasks / Tickets

#### T2-1: Guard Logs Visitor Manually

**Acceptance Criteria**
- Guard opens gate screen and taps "Log Visitor"
- Fills: Visitor Name (required), Phone (optional), Purpose (dropdown: Delivery, Guest, Service, Cab, Other), flat to visit (searchable)
- Form validation before submit
- On submit, visitor entry created in DB with status `pending`

**Files to Create**

```
app/(guard)/
  gate.tsx                    # Guard home: active visitors list
  log-visitor.tsx             # Log visitor form
src/
  hooks/
    useVisitorLog.ts
  components/
    guard/
      VisitorForm.tsx
      PurposeSelector.tsx
      FlatSearch.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/visitors` | Guard JWT | Create visitor entry |
| GET | `/visitors/active` | Guard JWT | Active (pending/approved) visitors at gate |

**DB Migrations**

```sql
-- visitors table (in 001_initial_schema.sql)
create table visitors (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  guard_id uuid references user_profiles(id) not null,
  name text not null,
  phone text,
  purpose text not null,
  status text not null default 'pending',  -- pending|approved|denied|exited
  photo_url text,
  entry_time timestamptz default now(),
  exit_time timestamptz,
  created_at timestamptz default now()
);
```

**Test Cases**
- Unit: `useVisitorLog.submit` validates required fields before API call
- API: `POST /visitors` with missing `name` returns 422
- API: Guard from Society A cannot create visitor for Society B (returns 403)
- RLS: Guard can only read visitors for their own `society_id`

---

#### T2-2: Photo Capture

**Acceptance Criteria**
- Guard can optionally capture visitor photo using device camera
- Photo compressed to ≤ 200KB before upload
- Uploaded to Supabase Storage bucket `visitor-photos/{society_id}/{visitor_id}.jpg`
- Signed URL (1-hour expiry) stored in `visitors.photo_url`
- Photo shown in visitor card and notification

**Files to Create**

```
src/
  hooks/
    usePhotoCapture.ts      # expo-camera + expo-image-manipulator
  components/
    guard/
      CameraCapture.tsx
      PhotoPreview.tsx
  lib/
    storage.ts              # Upload helpers for Supabase Storage
```

**Test Cases**
- Unit: Image compressor reduces 2MB image to ≤ 200KB
- Unit: Upload function constructs correct storage path
- API: Upload with invalid MIME type (not image/*) returns 400
- RLS (Storage): Guard from Society B cannot read `visitor-photos/{society_a_id}/...`

---

#### T2-3: Real-time Push Notification to Resident

**Acceptance Criteria**
- On visitor creation, resident(s) of the target flat receive FCM push notification within 5 seconds
- Notification shows: Visitor name, purpose, guard name, photo thumbnail
- Notification delivered even when app is in background/killed
- Device FCM token stored in `user_profiles.fcm_token`, updated on each login

**Files to Create**

```
backend/src/
  services/
    notificationService.ts    # Build and send FCM messages
  routes/
    visitors.ts               # POST /visitors triggers notification
src/
  lib/
    fcm.ts                    # Token registration + foreground handler
```

**API Endpoints** — notification triggered within `POST /visitors` handler

**DB Changes**
```sql
alter table user_profiles add column fcm_token text;
```

**Test Cases**
- Unit: `notificationService.sendVisitorAlert` builds correct FCM payload
- Unit: Resident with no `fcm_token` is skipped gracefully (no crash)
- API: Mock FCM in tests — verify `sendToDevice` called with correct token
- Integration: Create visitor via API, assert FCM mock called once per flat resident

---

#### T2-4: Resident Approves / Denies

**Acceptance Criteria**
- Resident taps notification → deep link opens app to approval screen
- Screen shows visitor details (name, purpose, photo if available)
- Two buttons: "Allow Entry" and "Deny"
- Decision updates `visitors.status` in DB
- Supabase Realtime event emitted on status change

**Files to Create**

```
app/(resident)/
  visitor-approval.tsx        # Deep-linked approval screen
src/
  hooks/
    useVisitorApproval.ts
  components/
    resident/
      VisitorApprovalCard.tsx
      ApprovalButtons.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| PATCH | `/visitors/:id/status` | Resident JWT | Update status to approved/denied |

**DB Changes** — none (visitors table already has `status`)

**Test Cases**
- Unit: `useVisitorApproval` optimistically updates local state before API resolves
- API: `PATCH /visitors/:id/status` with `status: 'approved'` returns 200
- API: Resident from a different flat cannot approve — returns 403
- API: Already-decided visitor (not pending) cannot be re-decided — returns 409
- E2E (`resident_approve.maestro.yaml`): Tap notification → approve → visitor status = approved

---

#### T2-5: Guard Sees Result Live

**Acceptance Criteria**
- Guard's active visitor list updates in real-time when resident makes a decision
- Approved: Green badge, "Allow Entry" CTA shown
- Denied: Red badge, "Deny Entry" shown
- Status changes without manual refresh (Supabase Realtime subscription)

**Files to Create**

```
src/
  hooks/
    useRealtimeVisitors.ts    # Supabase realtime subscription on visitors table
  components/
    guard/
      VisitorStatusBadge.tsx
      ActiveVisitorCard.tsx
```

**Test Cases**
- Unit: `useRealtimeVisitors` subscribes to correct Supabase channel on mount, unsubscribes on unmount
- Component: `VisitorStatusBadge` renders green for `approved`, red for `denied`
- Integration: Insert status update in DB, assert component re-renders with new badge within 2s

---

#### T2-6: Visitor Log History

**Acceptance Criteria**
- Guard can view today's visitor log (paginated, 20/page)
- Filterable by status, building, date range
- Each entry shows: name, flat, time, status, photo thumbnail
- Residents can view visitor history for their own flat (last 30 days)

**Files to Create**

```
app/(guard)/
  visitor-history.tsx
app/(resident)/
  visitor-history.tsx
src/
  hooks/
    useVisitorHistory.ts
  components/
    shared/
      VisitorHistoryList.tsx
      VisitorHistoryFilters.tsx
      VisitorHistoryItem.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/visitors/history` | Guard/Resident JWT | Paginated visitor history with filters |

**Test Cases**
- API: `GET /visitors/history?status=approved&page=1` returns correct paginated result
- API: Resident can only see their own flat's visitors
- API: Guard can see all visitors for their society
- RLS: Direct Supabase query by resident returns only their flat's rows

---

### Phase 2 Exit Criteria

- [ ] Guard can log visitor with photo in under 60 seconds
- [ ] Resident receives push notification within 5 seconds on real device
- [ ] Guard sees real-time status update without refresh
- [ ] Visitor log history accessible to both guard and resident
- [ ] All RLS policies tested and verified

---

## Phase 3 — Advanced Visitor Flows (Week 5)

### Goals

Frictionless entry for expected guests. Pre-approved visitors bypass the real-time approval step.

---

### Tasks / Tickets

#### T3-1: Resident Pre-Approves Guest (OTP Sent to Guest)

**Acceptance Criteria**
- Resident creates a "Pre-approval" with: Guest Name, Guest Phone, Expected Date/Time window, Purpose
- System generates a 6-digit numeric OTP, sends SMS to guest's phone (via Twilio/MSG91)
- Pre-approval record stored with `status = active`, `otp_hash` (bcrypt), `valid_from`, `valid_until`
- Resident can cancel a pre-approval before it's used

**Files to Create**

```
app/(resident)/
  pre-approvals/
    index.tsx               # List of active pre-approvals
    create.tsx              # Create pre-approval form
src/
  hooks/
    usePreApprovals.ts
  components/
    resident/
      PreApprovalForm.tsx
      PreApprovalCard.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/pre-approvals` | Resident JWT | Create pre-approval, send OTP to guest |
| GET | `/pre-approvals` | Resident JWT | List own pre-approvals |
| DELETE | `/pre-approvals/:id` | Resident JWT | Cancel pre-approval |

**DB Migrations**

```sql
create table pre_approvals (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  resident_id uuid references user_profiles(id) not null,
  guest_name text not null,
  guest_phone text not null,
  purpose text,
  otp_hash text not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status text default 'active',   -- active|used|cancelled|expired
  used_at timestamptz,
  created_at timestamptz default now()
);
```

**Test Cases**
- Unit: OTP is 6 numeric digits, hashed with bcrypt before storage (plain OTP never stored)
- Unit: Pre-approval with `valid_until` in the past is rejected at creation
- API: `DELETE /pre-approvals/:id` by a different resident returns 403
- API: Creating pre-approval sends SMS mock call once

---

#### T3-2: Guard Validates Pre-Approval OTP

**Acceptance Criteria**
- Guard selects "OTP Visitor" on gate screen
- Enters guest phone + OTP
- Backend verifies OTP hash + time window + status = active
- On success: visitor entry auto-created as `approved`, pre-approval `status = used`
- On failure: clear error — expired / wrong OTP / already used
- Max 3 wrong attempts per pre-approval (then locked)

**Files to Create**

```
app/(guard)/
  otp-verify.tsx
src/
  hooks/
    useOtpVerification.ts
  components/
    guard/
      OtpVerifyForm.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/pre-approvals/verify` | Guard JWT | Verify OTP, auto-admit guest |

**Test Cases**
- Unit: Expired pre-approval (past `valid_until`) returns `expired` error
- API: Correct OTP returns 200, visitor entry created, pre-approval status = used
- API: Wrong OTP increments attempt counter; 3rd wrong attempt locks the pre-approval
- API: Used pre-approval returns `already_used` error

---

#### T3-3: QR Code Generation and Scanning at Gate

**Acceptance Criteria**
- On pre-approval creation, a QR code is generated encoding `preApprovalId + HMAC signature`
- QR code shareable as image via system share sheet
- Guard scans QR using device camera
- Backend validates HMAC, resolves pre-approval, checks validity
- Auto-admits guest same as OTP flow on success

**Files to Create**

```
src/
  components/
    resident/
      PreApprovalQR.tsx       # react-native-qrcode-svg
    guard/
      QRScanner.tsx           # expo-barcode-scanner
  lib/
    qrcode.ts                 # Generate/verify HMAC-signed QR payload
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/pre-approvals/verify-qr` | Guard JWT | Verify QR payload, auto-admit |

**Test Cases**
- Unit: QR payload HMAC verification rejects tampered payload
- Unit: Expired pre-approval QR returns error even with valid HMAC
- Component: `QRScanner` calls `onScan` callback with decoded string
- E2E (`qr_entry.maestro.yaml`): Resident shares QR → Guard scans → visitor admitted

---

#### T3-4: Recurring Staff Management

**Acceptance Criteria**
- Resident registers recurring staff: Name, Phone, Role (Maid, Cook, Driver, Other), allowed entry days (Mon–Sun), time window
- Each day, staff entry is auto-pre-approved in the time window
- Guard logs recurring staff by searching name/phone — entry auto-approved
- Resident can suspend/delete a recurring staff entry

**Files to Create**

```
app/(resident)/
  staff/
    index.tsx               # List of recurring staff
    add.tsx                 # Add staff form
src/
  hooks/
    useRecurringStaff.ts
  components/
    resident/
      StaffCard.tsx
      StaffForm.tsx
      DayOfWeekPicker.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/recurring-staff` | Resident JWT | Register recurring staff |
| GET | `/recurring-staff` | Resident JWT | List own recurring staff |
| PATCH | `/recurring-staff/:id` | Resident JWT | Suspend/update staff |
| DELETE | `/recurring-staff/:id` | Resident JWT | Remove staff |
| POST | `/visitors/staff-entry` | Guard JWT | Log recurring staff visit |

**DB Migrations**

```sql
create table recurring_staff (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  resident_id uuid references user_profiles(id) not null,
  name text not null,
  phone text,
  role text not null,
  allowed_days integer[] not null,   -- 0=Sun, 1=Mon, ..., 6=Sat
  entry_from time not null,
  entry_until time not null,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

**Test Cases**
- Unit: Staff entry outside allowed days returns `not_allowed_today`
- Unit: Staff entry outside time window returns `outside_window`
- API: Guard can look up recurring staff by phone in their society
- API: Resident from another flat cannot delete another resident's staff

---

### Phase 3 Exit Criteria

- [ ] Guest can enter with pre-approval OTP without real-time resident approval
- [ ] QR code scan works end-to-end on device
- [ ] Recurring staff management functional
- [ ] All OTP security edge cases tested (expiry, max attempts, reuse)

---

## Phase 4 — Resident Features (Week 6)

### Goals

Residents have a full self-service dashboard for their flat and safety features.

---

### Tasks / Tickets

#### T4-1: Resident Dashboard

**Acceptance Criteria**
- Shows: Active visitors awaiting approval (badge count), Recent visitor entries (last 5), Flat member list summary, Quick-action buttons (Pre-approve guest, Add staff, SOS)
- All data loaded with skeleton loaders, graceful empty states
- Pull-to-refresh

**Files to Create**

```
app/(resident)/
  index.tsx                   # Dashboard
src/
  hooks/
    useResidentDashboard.ts
  components/
    resident/
      DashboardHeader.tsx
      PendingApprovalBanner.tsx
      RecentVisitorsFeed.tsx
      QuickActions.tsx
```

**Test Cases**
- Component: Skeleton loaders shown while data is loading
- Component: Empty state shown when no recent visitors
- Unit: Dashboard hook aggregates data from multiple sources correctly

---

#### T4-2: Flat Member Management

**Acceptance Criteria**
- Flat owner can add/remove family members (name, phone, role: family/tenant)
- Added members get invite SMS and can sign in to the app with their own accounts
- All flat members share visibility of the flat's visitors and pre-approvals
- Only flat owner (primary) can add/remove members

**Files to Create**

```
app/(resident)/
  flat-members/
    index.tsx
    add.tsx
src/
  hooks/
    useFlatMembers.ts
  components/
    resident/
      MemberCard.tsx
      AddMemberForm.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/flats/:id/members` | Resident JWT | List flat members |
| POST | `/flats/:id/members` | Flat Owner JWT | Add member, send invite |
| DELETE | `/flats/:id/members/:memberId` | Flat Owner JWT | Remove member |

**Test Cases**
- API: Tenant (non-primary) cannot add a member — returns 403
- API: Adding a member with a phone already in another flat of the same society returns 409
- RLS: Flat member can only read their own flat's `user_profiles` rows

---

#### T4-3: Visitor History (Resident View)

Already partially covered in T2-6. This ticket completes the resident-specific UI.

**Acceptance Criteria**
- Shows all visitors for all flat members (not just current user)
- Filters: date range, status, visitor name search
- Export to PDF/CSV (stretch goal — move to backlog if time-constrained)

**Files to Create**

```
app/(resident)/
  visitor-history.tsx         # Full-screen history
src/
  components/
    resident/
      VisitorHistoryFilters.tsx
```

**Test Cases**
- Component: Filter change triggers re-fetch
- API: `GET /visitors/history?flatId=X` returns only that flat's visitors for resident role

---

#### T4-4: Pre-Approval Management

Already covered in T3-1. This ticket adds the management UI.

**Acceptance Criteria**
- List of all pre-approvals: active, used, expired, cancelled
- Each card shows QR + OTP code (for sharing)
- One-tap cancel for active pre-approvals
- "Create New" FAB

**Files to Create**

```
app/(resident)/
  pre-approvals/
    index.tsx                 # Enhanced list with status tabs
src/
  components/
    resident/
      PreApprovalTabs.tsx     # Active | Used | Expired
```

**Test Cases**
- Component: Cancelled pre-approvals show in correct tab
- Component: QR code renders without crash when `preApprovalId` provided

---

#### T4-5: SOS Alert

**Acceptance Criteria**
- SOS button accessible from resident dashboard (red, prominent)
- One-tap triggers: FCM alert to all guards in the society, FCM to Society Admin, DB record created
- Alert shows: Resident name, flat, timestamp
- Guards receive high-priority FCM notification that bypasses DND
- SOS history viewable by resident and admin

**Files to Create**

```
app/(resident)/
  sos.tsx                     # SOS confirmation screen
src/
  hooks/
    useSOS.ts
  components/
    resident/
      SOSButton.tsx
      SOSConfirmationModal.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/sos` | Resident JWT | Trigger SOS alert |
| GET | `/sos/history` | Resident/Admin JWT | SOS history |

**DB Migrations**

```sql
create table sos_alerts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  resident_id uuid references user_profiles(id) not null,
  resolved_at timestamptz,
  resolved_by uuid references user_profiles(id),
  created_at timestamptz default now()
);
```

**Test Cases**
- Unit: SOS confirmation modal requires explicit tap (no accidental trigger)
- API: `POST /sos` sends FCM to all guards + admin in society
- API: FCM send failure does not prevent SOS record creation (fire-and-forget with logging)
- E2E (`sos_alert.maestro.yaml`): Tap SOS → confirm → guard receives notification

---

### Phase 4 Exit Criteria

- [ ] Resident dashboard loads all widgets within 2 seconds on 4G
- [ ] Flat member management works with correct role restrictions
- [ ] SOS alert delivered to guards within 5 seconds
- [ ] All resident flows covered by at least one E2E test

---

## Phase 5 — Society Admin Features (Week 7)

### Goals

Society Admin has full visibility and control over their society's data and configuration.

---

### Tasks / Tickets

#### T5-1: Society Admin Dashboard

**Acceptance Criteria**
- KPI cards: Total flats, Occupied flats, Guards on duty, Visitors today, Active SOS
- Last 7 days visitor trend chart (bar chart, date × count)
- Recent activity feed (last 10 events across all visitor/SOS activity)
- Quick actions: Add notice, View reports, Manage guards

**Files to Create**

```
app/(admin)/
  index.tsx                   # Admin dashboard
src/
  hooks/
    useAdminDashboard.ts
  components/
    admin/
      KpiCard.tsx
      VisitorTrendChart.tsx    # react-native-chart-kit or Victory Native
      ActivityFeed.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | Admin JWT | KPI aggregates for dashboard |
| GET | `/admin/activity` | Admin JWT | Recent activity feed |

**Test Cases**
- API: `GET /admin/stats` returns correct visitor count for today
- API: Admin from Society A cannot read stats for Society B
- Component: KpiCard renders loading skeleton and error state

---

#### T5-2: Manage Buildings, Flats, Residents, Guards

**Acceptance Criteria**
- Full CRUD for buildings, flats, residents, guards
- Searchable and filterable lists
- Deactivate (soft-delete) instead of hard-delete for residents/guards
- Reassign flat: move a resident from one flat to another
- Bulk invite resend for residents who haven't joined

**Files to Create**

```
app/(admin)/
  manage/
    buildings.tsx
    flats.tsx
    residents.tsx
    guards.tsx
src/
  hooks/
    useAdminManagement.ts
  components/
    admin/
      ResidentTable.tsx
      GuardTable.tsx
      DeactivateConfirmModal.tsx
```

**API Endpoints** — extend existing CRUD endpoints with PATCH/DELETE and bulk operations

**Test Cases**
- API: Deactivated guard cannot log into the app (returns 403 on login)
- API: Reassigning a resident to a new flat updates all associated visitor/pre-approval FKs
- RLS: Admin can only manage entities in their own `society_id`

---

#### T5-3: Notices and Announcements

**Acceptance Criteria**
- Admin creates notice: Title, Body (rich text), Audience (all / specific building / all guards), Schedule (now or future datetime)
- Published notice triggers FCM to target audience
- Residents/Guards can view notices in their app (in-app notice board)
- Admin can edit (before publish) or archive notices

**Files to Create**

```
app/(admin)/
  notices/
    index.tsx
    create.tsx
    edit.tsx
app/(resident)/
  notices.tsx
app/(guard)/
  notices.tsx
src/
  hooks/
    useNotices.ts
  components/
    shared/
      NoticeCard.tsx
      NoticeBoard.tsx
    admin/
      NoticeForm.tsx
      AudiencePicker.tsx
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/notices` | Admin JWT | Create notice |
| GET | `/notices` | All roles JWT | Get notices for current user's society |
| PATCH | `/notices/:id` | Admin JWT | Edit notice |
| DELETE | `/notices/:id` | Admin JWT | Archive notice |

**DB Migrations**

```sql
create table notices (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  title text not null,
  body text not null,
  audience text not null default 'all',  -- all|building:{id}|guards
  status text default 'draft',           -- draft|published|archived
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references user_profiles(id) not null,
  created_at timestamptz default now()
);
```

**Test Cases**
- Unit: Scheduled notice is not sent immediately; cron/queue processes it at scheduled time
- API: Notice audience `building:{id}` sends FCM only to residents of that building
- API: Non-admin role cannot create or edit notices

---

#### T5-4: Reports (Visitor Logs, Staff Visits)

**Acceptance Criteria**
- Admin generates reports filtered by date range + building + guard
- Report types: Visitor Log, Staff Visit Log, SOS History
- In-app tabular view + export as CSV (share via system sheet)
- Reports are paginated and load incrementally

**Files to Create**

```
app/(admin)/
  reports/
    index.tsx
    visitor-log.tsx
    staff-log.tsx
    sos-history.tsx
src/
  hooks/
    useAdminReports.ts
  components/
    admin/
      ReportFilters.tsx
      ReportTable.tsx
      ExportButton.tsx
  utils/
    csvExport.ts
```

**API Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/reports/visitors` | Admin JWT | Visitor log report |
| GET | `/admin/reports/staff` | Admin JWT | Staff visit log |
| GET | `/admin/reports/sos` | Admin JWT | SOS history |

**Test Cases**
- API: Date range filter returns only records in range (inclusive)
- Unit: `csvExport` produces valid CSV string from array of objects
- API: Admin cannot query reports outside their `society_id`

---

### Phase 5 Exit Criteria

- [ ] Admin dashboard loads with correct live KPIs
- [ ] Full CRUD for all managed entities
- [ ] Notices delivered via FCM to correct audience
- [ ] CSV reports downloadable and accurate

---

## Phase 6 — Offline Support for Guards (Week 8)

### Goals

Guards at the gate often have poor connectivity. Visitor entries must work offline and sync when connectivity is restored.

---

### Tasks / Tickets

#### T6-1: Local SQLite Cache for Visitor Logs

**Acceptance Criteria**
- Guard app uses `expo-sqlite` for local storage of visitor entries
- On startup, sync last 24 hours of visitors from server to local DB
- All guard UI reads from local SQLite first, with server as source of truth for synced records
- Local schema mirrors a subset of `visitors` table columns

**Files to Create**

```
src/
  lib/
    db/
      localDb.ts            # expo-sqlite setup and migration runner
      schema.ts             # Local table definitions
      visitors.ts           # Local CRUD operations for visitors
  hooks/
    useLocalVisitors.ts
```

**Local DB Schema**

```sql
create table if not exists local_visitors (
  id text primary key,         -- UUID, matches server id if synced
  local_id text unique,        -- Client-generated temp ID for unsynced
  society_id text not null,
  flat_id text not null,
  name text not null,
  phone text,
  purpose text not null,
  status text not null default 'pending',
  photo_local_path text,       -- local file path before upload
  photo_url text,              -- server URL after sync
  entry_time text not null,
  sync_status text default 'pending',  -- pending|synced|error
  sync_error text,
  created_at text not null
);

create table if not exists sync_queue (
  id integer primary key autoincrement,
  entity_type text not null,   -- visitors|pre_approvals
  operation text not null,     -- insert|update
  payload text not null,       -- JSON stringified
  created_at text not null,
  attempts integer default 0,
  last_attempt text,
  status text default 'pending'  -- pending|success|error|abandoned
);
```

**Test Cases**
- Unit: `localDb.insert` writes correct record to SQLite
- Unit: `localDb.getActiveVisitors` returns correct status-filtered records
- Integration: App startup syncs server records to local DB when online

---

#### T6-2: Sync Queue for Offline Entries

**Acceptance Criteria**
- When guard submits a visitor entry offline, it writes to `sync_queue` with `sync_status = pending`
- A background sync service polls the queue every 30 seconds when network is available
- On sync success: local record updated with server `id`, `sync_status = synced`
- On sync failure: retry up to 3 times with exponential backoff; after 3 failures, mark `abandoned` and surface to guard as failed
- Photo upload: local file path retained offline; uploaded on sync
- Status updates (approve/deny) received from Supabase Realtime overwrite local status

**Files to Create**

```
src/
  services/
    syncService.ts            # Processes sync_queue entries
    networkMonitor.ts         # expo-network, triggers sync on reconnect
  hooks/
    useSyncStatus.ts          # Exposes pending count, last sync time
  components/
    guard/
      SyncStatusBar.tsx       # "3 pending entries" / "Offline" banner
```

**Test Cases**
- Unit: `syncService.processQueue` iterates queue, calls API for each item
- Unit: Failed sync increments `attempts`, sets correct backoff delay
- Unit: After 3 failures, entry marked `abandoned`, guard notified
- Integration: Submit entry offline → enable network → verify server has entry within 60s
- Component: `SyncStatusBar` shows "Offline" badge when `NetInfo.isConnected === false`

---

#### T6-3: Conflict Resolution

**Acceptance Criteria**
- Conflict scenario: Resident approves via push while guard is offline; guard later submits exit — should not overwrite the approval
- Strategy: Last-writer-wins for `status` (server timestamp wins over local)
- Strategy: Additive-only for `exit_time` (do not set if already set on server)
- Conflict events logged to `sync_conflict_log` table for admin visibility

**Files to Create**

```
src/
  services/
    conflictResolver.ts       # Merge logic for conflicting records
  lib/
    db/
      conflicts.ts            # Local conflict log table
```

**DB Migrations**

```sql
create table sync_conflict_log (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id),
  visitor_id uuid,
  conflict_type text,         -- status_conflict|exit_time_conflict
  local_value text,
  server_value text,
  resolved_value text,
  resolved_at timestamptz default now()
);
```

**Test Cases**
- Unit: Conflict resolver prefers server `status` when server timestamp is newer
- Unit: `exit_time` is not overwritten if server already has a non-null value
- Integration: Submit conflicting updates from two clients, verify correct resolution

---

### Phase 6 Exit Criteria

- [ ] Guard can log visitor with no network; entry appears in server log after reconnect
- [ ] Sync status banner visible and accurate
- [ ] Conflict resolution tested with simulated concurrent updates
- [ ] Offline photo upload works: photo captured offline, uploaded on sync

---

## Phase 7 — Polish & Testing (Week 9)

### Goals

Ship-ready quality: full test coverage, performance baseline met, error handling production-grade, app store assets prepared.

---

### Tasks / Tickets

#### T7-1: Full Test Suite

**Acceptance Criteria**
- Unit test coverage ≥ 90% for `src/utils`, `src/lib`, `src/services`
- Component test coverage ≥ 75% for all components
- API test coverage ≥ 85% for all Express routes
- All RLS policies covered by at least one passing test
- All E2E critical paths passing in CI

**Tasks**
- Audit coverage report, identify gaps
- Write missing unit tests for all utility functions
- Write missing component tests for all screens
- Write missing API tests for all routes
- Finalize Maestro flows for all P0 and P1 E2E paths

**Critical E2E Flows to Cover**

| Flow | File |
|---|---|
| Guard login → log visitor → resident approves | `e2e/flows/guard_visitor_full.maestro.yaml` |
| Resident login → pre-approve guest → guard scans QR | `e2e/flows/preapproval_qr.maestro.yaml` |
| Resident login → SOS alert | `e2e/flows/sos_alert.maestro.yaml` |
| Admin login → create notice → resident sees notice | `e2e/flows/admin_notice.maestro.yaml` |
| Guard offline entry → sync on reconnect | `e2e/flows/offline_sync.maestro.yaml` |

---

#### T7-2: Performance Optimization

**Acceptance Criteria**
- App cold start ≤ 3 seconds on mid-range Android device (Realme/Redmi equivalent)
- Visitor list renders 20 items without jank (60fps on a 2021-era device)
- API responses p95 ≤ 500ms for all endpoints (measured via Render logs)
- Supabase queries use indexes on all FK and high-cardinality filter columns

**Tasks**
- Add `React.memo`, `useCallback`, `useMemo` where profiling shows re-render waste
- Add DB indexes: `visitors(society_id, entry_time)`, `visitors(flat_id, status)`, `pre_approvals(guest_phone, status)`, `recurring_staff(society_id, phone)`
- Enable Supabase connection pooling (PgBouncer mode)
- Lazy-load heavy screens (reports, history) with `React.lazy` + Suspense equivalent

**DB Migrations**

```sql
-- 005_indexes.sql
create index visitors_society_time_idx on visitors(society_id, entry_time desc);
create index visitors_flat_status_idx on visitors(flat_id, status);
create index pre_approvals_guest_phone_idx on pre_approvals(guest_phone, status);
create index recurring_staff_society_phone_idx on recurring_staff(society_id, phone);
```

---

#### T7-3: Error Handling

**Acceptance Criteria**
- Every API endpoint has a consistent error response shape: `{ error: { code, message, details? } }`
- Frontend shows user-friendly messages for all known error codes (no raw API errors shown)
- Unhandled errors caught by React error boundary, show friendly fallback UI
- Sentry (or equivalent) integrated for crash reporting
- Network timeout (10s) and retry logic (2 retries, exponential backoff) on all API calls

**Files to Create / Edit**

```
src/
  components/
    shared/
      ErrorBoundary.tsx
      ErrorFallback.tsx
  lib/
    api.ts                    # Add retry + timeout config
    errorCodes.ts             # Map error codes to user messages
backend/src/
  middleware/
    errorHandler.ts           # Consistent error response shape
  lib/
    AppError.ts               # Custom error class with code + statusCode
```

**Test Cases**
- Unit: `ErrorBoundary` renders `ErrorFallback` when child throws
- Unit: `api.ts` retries on 5xx and network errors, not on 4xx
- API: All 4xx errors return `{ error: { code, message } }` shape

---

#### T7-4: App Store Preparation

**Acceptance Criteria**
- App icons (1024x1024 master, all required sizes generated via EAS)
- Splash screen matching brand colors
- Privacy policy URL in app (required for phone number collection)
- All `expo-permissions` justification strings in `app.config.ts` (`NSCameraUsageDescription`, `NSContactsUsageDescription`, etc.)
- Android: `google-services.json` injected via EAS secrets, `versionCode` set
- iOS: `GoogleService-Info.plist` injected via EAS secrets, `bundleIdentifier` set
- EAS build profile for `preview` (internal distribution) and `production`

**Files to Create / Edit**

```
assets/
  icon.png
  splash.png
  adaptive-icon.png
app.config.ts           # Complete permissions, bundle IDs, version
eas.json                # Preview + production build profiles
```

---

### Phase 7 Exit Criteria

- [ ] CI pipeline green with all test suites passing
- [ ] Coverage targets met (unit 90%, component 75%, API 85%, RLS 100%)
- [ ] App cold start ≤ 3s on target device
- [ ] Error boundaries in place, Sentry receiving test events
- [ ] EAS `preview` build installable on Android + iOS test devices
- [ ] App store listing assets ready

---

## Appendix: DB Schema Reference

Full schema across all phases. Apply via sequential migration files.

```sql
-- societies
create table societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line1 text not null,
  city text not null,
  state text not null,
  pin_code text not null,
  invite_code text unique not null,
  total_buildings integer default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- buildings
create table buildings (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  name text not null,
  total_floors integer,
  created_at timestamptz default now()
);

-- flats
create table flats (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  building_id uuid references buildings(id) not null,
  flat_number text not null,
  floor integer,
  is_occupied boolean default false,
  created_at timestamptz default now()
);

-- user_profiles (extends auth.users)
create table user_profiles (
  id uuid primary key references auth.users(id),
  society_id uuid references societies(id),
  flat_id uuid references flats(id),
  role text not null,   -- super_admin|society_admin|guard|flat_owner|tenant
  full_name text,
  phone text unique not null,
  fcm_token text,
  is_active boolean default true,
  is_primary_resident boolean default false,
  created_at timestamptz default now()
);

-- visitors
create table visitors (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  guard_id uuid references user_profiles(id) not null,
  name text not null,
  phone text,
  purpose text not null,
  status text not null default 'pending',
  photo_url text,
  entry_time timestamptz default now(),
  exit_time timestamptz,
  created_at timestamptz default now()
);

-- pre_approvals
create table pre_approvals (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  resident_id uuid references user_profiles(id) not null,
  guest_name text not null,
  guest_phone text not null,
  purpose text,
  otp_hash text not null,
  otp_attempts integer default 0,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status text default 'active',
  used_at timestamptz,
  visitor_id uuid references visitors(id),
  created_at timestamptz default now()
);

-- recurring_staff
create table recurring_staff (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  resident_id uuid references user_profiles(id) not null,
  name text not null,
  phone text,
  role text not null,
  allowed_days integer[] not null,
  entry_from time not null,
  entry_until time not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- notices
create table notices (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  title text not null,
  body text not null,
  audience text not null default 'all',
  status text default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references user_profiles(id) not null,
  created_at timestamptz default now()
);

-- sos_alerts
create table sos_alerts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id) not null,
  flat_id uuid references flats(id) not null,
  resident_id uuid references user_profiles(id) not null,
  resolved_at timestamptz,
  resolved_by uuid references user_profiles(id),
  created_at timestamptz default now()
);

-- sync_conflict_log
create table sync_conflict_log (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references societies(id),
  visitor_id uuid,
  conflict_type text,
  local_value text,
  server_value text,
  resolved_value text,
  resolved_at timestamptz default now()
);
```

### RLS Policy Summary

| Table | Rule |
|---|---|
| `societies` | Read: own society only. Write: super_admin |
| `buildings` | Read/Write: society_admin of same society |
| `flats` | Read: all members of same society. Write: society_admin |
| `user_profiles` | Read: own row + same-flat members. Write: own row |
| `visitors` | Read: guard (own society), resident (own flat), admin (own society). Write: guard (own society) |
| `pre_approvals` | Read/Write: resident (own flat). Read: guard (own society for verify) |
| `recurring_staff` | Read/Write: resident (own flat). Read: guard (own society) |
| `notices` | Read: all members of same society. Write: society_admin |
| `sos_alerts` | Write: resident (own flat). Read: guards + admin (own society) |

---

## Summary Timeline

| Week | Phase | Deliverable |
|---|---|---|
| 1 | Phase 0 | Working project skeleton, Supabase + backend deployed |
| 2 | Phase 1 | Phone OTP auth for all roles, society creation + join |
| 3–4 | Phase 2 | MVP: guard logs visitor, resident approves, real-time sync |
| 5 | Phase 3 | Pre-approvals, QR codes, recurring staff |
| 6 | Phase 4 | Full resident dashboard + SOS |
| 7 | Phase 5 | Admin dashboard, notices, reports |
| 8 | Phase 6 | Guard offline mode + sync |
| 9 | Phase 7 | Full test suite, performance, app store prep |
