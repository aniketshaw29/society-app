# Society App

A multi-tenant Society Management SaaS platform built for residential housing societies in India. Inspired by MyGate, purpose-built for smaller societies that need an affordable, self-hosted or cloud-hosted solution.

---

## What It Does

Society App digitizes the daily operations of a residential housing society — visitor management, gate entry/exit tracking, resident announcements, facility booking, maintenance billing, and emergency alerts — all in one mobile app used by residents, security guards, and society admins.

---

## Features

### Visitor Management
- Pre-authorize visitors by sharing a QR code or OTP
- Security guard logs entry and exit with photo capture
- Real-time push notification to resident when visitor arrives
- Visitor history accessible to residents and admins

### Gate Entry / Exit Tracking
- Guards log all vehicle and pedestrian entries
- Offline-capable: logs queue locally and sync when network resumes
- Staff entry management (maids, delivery, services)
- Daily/weekly/monthly entry reports for admins

### Resident Directory
- Resident profiles linked to flat/unit numbers
- Phone-based authentication (OTP only — no passwords)
- Multiple residents per flat (family members)
- Resident self-onboarding via society invite code

### Announcements
- Society admins post announcements to all residents
- Push notifications delivered via Firebase FCM
- Residents can acknowledge/react to announcements
- Pinned and priority announcements

### Maintenance & Billing
- Admin raises monthly maintenance invoices per flat
- Residents view and mark payments (basic tracking)
- Payment history per flat
- Overdue reminders via push notification

### Facility Booking
- Book common facilities (clubhouse, gym, pool, hall)
- Time-slot based, admin-configurable
- Booking conflicts prevented automatically

### Emergency Alerts
- One-tap SOS from any resident
- Alert broadcast to all society admins instantly
- Guard patrol check-in

### Multi-Tenant Architecture
- One deployment serves unlimited societies
- Complete data isolation between societies via Supabase RLS
- Each society gets its own invite code, admin panel, and settings
- Tenant onboarding flow for society admins

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo (SDK 51+) |
| Backend API | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth + Phone OTP (MSG91 / 2Factor.in) |
| Real-time | Supabase Realtime (WebSockets) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| File Storage | Supabase Storage |
| Backend Hosting | Render (free -> paid) |
| App Distribution | Expo EAS Build |
| OTA Updates | Expo Updates |

---

## Quick Start (Local Development)

### 1. Prerequisites

```bash
node --version   # Must be 20+
npm --version    # Must be 9+

# Install global tools
npm install -g expo-cli eas-cli
brew install supabase/tap/supabase   # macOS
```

### 2. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/society-app.git
cd society-app

# Backend
cd backend && npm install && cd ..

# Mobile
cd mobile && npm install && cd ..
```

### 3. Configure Environment

```bash
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
# Edit both files with your Supabase, Firebase, and SMS credentials
```

See `docs/deployment.md` for a full environment variables reference.

### 4. Set Up Supabase

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 5. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Mobile app
cd mobile && npx expo start
```

---

## Project Structure

```
society-app/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── routes/             # Express route handlers
│   │   │   ├── auth.js         # OTP send/verify, JWT issue
│   │   │   ├── visitors.js     # Visitor CRUD
│   │   │   ├── gates.js        # Entry/exit logging
│   │   │   ├── announcements.js
│   │   │   ├── facilities.js
│   │   │   ├── maintenance.js
│   │   │   └── notifications.js # FCM send
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT verification
│   │   │   ├── society.js      # society_id injection
│   │   │   └── rateLimit.js    # OTP rate limiting
│   │   ├── services/
│   │   │   ├── supabase.js     # Supabase admin client
│   │   │   ├── firebase.js     # FCM client
│   │   │   └── sms.js          # MSG91 / 2Factor OTP
│   │   └── utils/
│   │       ├── otp.js          # OTP generation/storage
│   │       └── validators.js   # Input validation
│   ├── server.js               # Express app entry point
│   ├── .env.example
│   └── package.json
│
├── mobile/                     # React Native + Expo app
│   ├── app/                    # Expo Router file-based routing
│   │   ├── (auth)/             # Unauthenticated screens
│   │   │   ├── index.tsx       # Phone number entry
│   │   │   └── verify.tsx      # OTP entry
│   │   ├── (app)/              # Authenticated screens
│   │   │   ├── (tabs)/         # Bottom tab navigator
│   │   │   │   ├── home.tsx    # Dashboard
│   │   │   │   ├── visitors.tsx
│   │   │   │   ├── announcements.tsx
│   │   │   │   └── profile.tsx
│   │   │   ├── visitor/
│   │   │   │   ├── new.tsx     # Pre-authorize visitor
│   │   │   │   └── [id].tsx    # Visitor detail
│   │   │   ├── gate/
│   │   │   │   ├── entry.tsx   # Guard entry screen
│   │   │   │   └── log.tsx     # Entry/exit log
│   │   │   ├── facility/
│   │   │   │   ├── list.tsx
│   │   │   │   └── book.tsx
│   │   │   └── admin/          # Admin-only screens
│   │   │       ├── dashboard.tsx
│   │   │       ├── residents.tsx
│   │   │       └── settings.tsx
│   │   └── _layout.tsx         # Root layout
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # Base components (Button, Input, etc.)
│   │   ├── visitor/            # Visitor-specific components
│   │   ├── gate/               # Gate/entry components
│   │   └── common/             # Shared across features
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useSociety.ts
│   │   ├── useVisitors.ts
│   │   ├── useRealtime.ts
│   │   └── usePushNotifications.ts
│   ├── lib/                    # Core utilities
│   │   ├── supabase.ts         # Supabase client (anon key)
│   │   ├── api.ts              # Axios instance with auth headers
│   │   ├── storage.ts          # AsyncStorage helpers
│   │   └── notifications.ts    # FCM token registration
│   ├── store/                  # Zustand state management
│   │   ├── authStore.ts
│   │   ├── societyStore.ts
│   │   └── visitorStore.ts
│   ├── types/                  # TypeScript type definitions
│   │   ├── database.ts         # Supabase generated types
│   │   └── app.ts              # App-specific types
│   ├── constants/              # Colors, dimensions, config
│   ├── app.json                # Expo config
│   ├── .env.example
│   └── package.json
│
├── supabase/                   # Database schema and migrations
│   ├── migrations/             # Ordered SQL migration files
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_realtime.sql
│   │   └── 004_storage_policies.sql
│   └── seed.sql                # Test data for local dev
│
├── docs/
│   ├── deployment.md           # Deployment guide
│   └── skills.md               # Developer patterns reference
│
├── CLAUDE.md                   # AI assistant context file
└── README.md                   # This file
```

---

## Database Schema Overview

```
societies          -- Tenant master table
├── residents      -- Users belonging to a society
├── flats          -- Units in a society
├── visitor_logs   -- All visitor records (realtime enabled)
├── gate_entries   -- Guard entry/exit log (realtime enabled)
├── announcements  -- Society-wide messages (realtime enabled)
├── facilities     -- Bookable resources
├── bookings       -- Facility booking records
├── maintenance_bills -- Monthly invoices per flat
└── emergency_alerts  -- SOS records (realtime enabled)
```

Every table has a `society_id` foreign key. RLS policies enforce that users can only see and modify data belonging to their own society.

---

## Contributing

This is a solo-developer project. If you are forking or contributing:

1. Never bypass RLS. Every new table must have RLS enabled and policies defined.
2. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code.
3. Every query must include `society_id` filtering — even if RLS catches it, explicit filtering is required.
4. Phone OTP is the only authentication method. No email/password.
5. Test with multiple society accounts to verify tenant isolation.

---

## License

MIT License. See `LICENSE` for details.

---

## Deployment

See `docs/deployment.md` for full instructions covering Supabase, Render, Firebase, SMS OTP, and EAS Build setup.
