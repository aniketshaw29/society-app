# Deployment Guide — Society Management SaaS

This guide covers everything you need to go from zero to a fully running app, including free-tier limits, step-by-step setup for every service, and cost projections at scale.

---

## 1. Free Tier Limits and Costs Breakdown

### Supabase (Free Tier)

| Resource | Free Limit | Notes |
|---|---|---|
| Database storage | 500 MB | Shared across all tenants |
| API requests | Unlimited | No rate limit on free tier |
| Auth users | 50,000 MAU | Monthly active users |
| Realtime connections | 200 concurrent | Per project |
| Storage | 1 GB | Visitor photos, avatars |
| Storage bandwidth | 2 GB / month | Egress from storage |
| Edge Functions | 500,000 invocations / month | For webhooks, cron jobs |
| Backups | 7-day PITR | Point-in-time recovery |
| Projects | 2 active | Free org limit |

**Upgrade trigger:** 200 concurrent WebSocket connections is the hardest limit. At ~10 residents per society actively using the app simultaneously, you hit this at ~20 societies.

### Render (Free Tier — Web Service)

| Resource | Free Limit | Notes |
|---|---|---|
| Compute | 750 hours / month | ~1 full month for 1 service |
| RAM | 512 MB | Enough for Node/Express |
| Bandwidth | 100 GB / month | Outbound data transfer |
| Build minutes | 500 / month | CI/CD builds |
| Sleep behavior | Spins down after 15 min idle | Causes cold starts (~30s) |
| Custom domains | Unlimited | Free SSL included |

**Critical note:** Free tier services spin down after 15 minutes of inactivity. Cold start takes 20-30 seconds. Use a cron ping (e.g., UptimeRobot free tier) to keep it warm during business hours, or upgrade to Starter ($7/month) to disable sleep.

### Expo / EAS Build (Free Tier)

| Resource | Free Limit | Notes |
|---|---|---|
| Build credits | 30 builds / month | Across iOS + Android |
| OTA updates | Unlimited | Expo Updates |
| EAS Submit | Included | App store submission |
| Concurrent builds | 1 | Builds are queued |

### Firebase (Free Tier — Spark Plan)

| Resource | Free Limit | Notes |
|---|---|---|
| FCM push notifications | Unlimited | No cost at any scale |
| Analytics | Unlimited | Up to 500 event types |
| Crashlytics | Unlimited | Crash reporting |
| Cloud Messaging | Unlimited | Core use case here |

**Firebase FCM is free forever.** No upgrade needed for notifications at any scale.

### MSG91 (SMS OTP)

| Resource | Free / Pricing | Notes |
|---|---|---|
| Free trial credits | ~100 OTP SMS on signup | For testing only |
| Per SMS (India) | ~₹0.18 – ₹0.25 per SMS | Transactional route |
| OTP template approval | Required | DLT registration needed |
| DLT registration | ~₹500 one-time | TRAI mandate |

**2Factor.in alternative:** ₹0.25/OTP, no DLT registration needed for small volumes — easier for MVP.

### Summary: True Monthly Cost at MVP (1-5 societies)

| Service | Monthly Cost |
|---|---|
| Supabase | $0 |
| Render | $0 (or $7 to disable sleep) |
| Expo | $0 |
| Firebase | $0 |
| SMS OTP (100 new users/month) | ~₹25 (less than $0.30) |
| **Total** | **~$0 – $7** |

---

## 2. Free Tier Upgrade Thresholds

| Scale | Action Required | Estimated Cost |
|---|---|---|
| 1–15 societies, <500 residents | Free tier on everything | ~$0/month |
| 15–50 societies, 500–2000 residents | Upgrade Render to Starter ($7) to eliminate cold starts | $7/month |
| 50–100 societies | Upgrade Supabase to Pro ($25) for 200+ concurrent connections, 8 GB storage | $32/month |
| 100–500 societies | Supabase Pro + Render Starter + dedicated DB | ~$50–100/month |
| 500+ societies | Evaluate self-hosted Supabase on a VPS, or Supabase Team plan | Custom |

---

## 3. Estimated Monthly Cost by Scale

### 10 Societies (~400 residents)

| Service | Tier | Cost |
|---|---|---|
| Supabase | Free | $0 |
| Render | Free (add ping to avoid sleep) | $0 |
| Firebase FCM | Free | $0 |
| SMS OTP (~50 new logins/month) | Pay-per-use | ~₹12 |
| Expo EAS | Free | $0 |
| **Total** | | **~$0 + ₹12** |

### 100 Societies (~4,000 residents)

| Service | Tier | Cost |
|---|---|---|
| Supabase | Pro ($25) | $25 |
| Render | Starter ($7) | $7 |
| Firebase FCM | Free | $0 |
| SMS OTP (~200 new logins/month) | Pay-per-use | ~₹50 |
| Expo EAS | Free | $0 |
| **Total** | | **~$32 + ₹50** |

### 1000 Societies (~40,000 residents)

| Service | Tier | Cost |
|---|---|---|
| Supabase | Pro + compute add-ons (~$100) | ~$100 |
| Render | Standard ($25/instance × 2) | $50 |
| Firebase FCM | Free | $0 |
| SMS OTP (~1000 new logins/month) | Pay-per-use | ~₹250 |
| Expo EAS | Production ($99/month) | $99 |
| CDN / Storage egress | Supabase add-on | ~$20 |
| **Total** | | **~$270 + ₹250** |

---

## 4. Local Development Setup

### Prerequisites

- Node.js 20+ (use `nvm`: `nvm install 20 && nvm use 20`)
- npm or yarn
- Git
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Supabase CLI: `brew install supabase/tap/supabase`
- Android Studio (for Android emulator) or Xcode (for iOS simulator)
- Expo Go app on a physical device (for quick testing)

### Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/society-app.git
cd society-app

# Install backend dependencies
cd backend
npm install

# Install mobile app dependencies
cd ../mobile
npm install
```

### Environment Variables

Copy the example env files:

```bash
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
```

Fill in all values (see section 8 for the full list).

### Start Local Development

```bash
# Terminal 1 — Backend (Node/Express)
cd backend
npm run dev

# Terminal 2 — Expo (React Native)
cd mobile
npx expo start
```

Scan the QR code with Expo Go or press `i` for iOS simulator / `a` for Android emulator.

---

## 5. Supabase Project Setup

### Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose your organization, set a project name (e.g., `society-app-prod`), and pick a strong database password — **save this password**.
4. Choose region: **ap-south-1 (Mumbai)** for India latency.
5. Wait ~2 minutes for provisioning.

### Step 2: Get Connection Details

From the Supabase dashboard:
- Go to **Settings > API**
- Copy `Project URL` → `SUPABASE_URL`
- Copy `anon` key → `SUPABASE_ANON_KEY`
- Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — backend only)

### Step 3: Run Migrations

```bash
# In the project root
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Run all migrations
supabase db push

# Or manually via SQL editor in Supabase dashboard:
# Paste contents of supabase/migrations/*.sql in order
```

### Step 4: Set Up Row-Level Security (RLS)

RLS policies are included in the migration files. To verify they are active:

```sql
-- Run in Supabase SQL Editor
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`. If any show `false`, run:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Step 5: Enable Realtime

1. Go to **Database > Replication** in the Supabase dashboard.
2. Under **Realtime**, enable the following tables:
   - `visitor_logs`
   - `gate_entries`
   - `announcements`
   - `emergency_alerts`
3. These tables will now push changes to subscribed clients in real time.

### Step 6: Configure Storage Buckets

1. Go to **Storage** in the Supabase dashboard.
2. Create bucket: `visitor-photos` — set to **Private** (accessed via signed URLs)
3. Create bucket: `avatars` — set to **Public**
4. Storage RLS policies are in `supabase/storage-policies.sql`

### Step 7: Configure Auth

1. Go to **Authentication > Providers**
2. Disable Email/Password (we use phone OTP only)
3. Enable Phone provider
4. Under **Phone**, configure your SMS provider (Twilio or custom — we use MSG91 via backend, so phone auth is handled manually in the backend)

**Note:** For custom OTP flow (MSG91/2Factor), phone auth in Supabase is bypassed. The backend verifies OTP, then calls `supabase.auth.admin.createUser()` or `signInWithPassword()` using a generated token.

---

## 6. Render Deployment

### Step 1: Push to GitHub

Ensure your backend code is in a GitHub repository. The `backend/` folder should have a `package.json` with a start script:

```json
{
  "scripts": {
    "start": "node server.js",
    "build": "echo 'No build step'",
    "dev": "nodemon server.js"
  }
}
```

### Step 2: Create Render Web Service

1. Go to [https://render.com](https://render.com) and sign in.
2. Click **New > Web Service**.
3. Connect your GitHub account and select the `society-app` repository.
4. Configure:
   - **Name:** `society-app-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free

### Step 3: Add Environment Variables

In the Render dashboard for your service, go to **Environment** and add all variables from section 8.

### Step 4: Deploy

Click **Create Web Service**. Render will build and deploy automatically on every push to your main branch.

### Step 5: Note Your Service URL

Your backend will be available at: `https://society-app-backend.onrender.com`

Add this to your mobile app's `.env` as `EXPO_PUBLIC_API_URL`.

### Step 6: Keep Alive (Free Tier)

Set up a free UptimeRobot monitor to ping your Render URL every 14 minutes:

1. Go to [https://uptimerobot.com](https://uptimerobot.com)
2. Add a new monitor: HTTP(s), URL = `https://society-app-backend.onrender.com/health`
3. Interval: 5 minutes

Add a health check endpoint to your Express app:

```js
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
```

---

## 7. Firebase Setup

### Step 1: Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, name it `society-app`
3. Disable Google Analytics (optional)
4. Click **Create project**

### Step 2: Add Android App

1. Click the Android icon (Add app)
2. Package name: `com.yourname.societyapp` (must match `app.json` `android.package`)
3. Download `google-services.json`
4. Place it at `mobile/google-services.json`

### Step 3: Add iOS App

1. Click the iOS icon (Add app)
2. Bundle ID: `com.yourname.societyapp` (must match `app.json` `ios.bundleIdentifier`)
3. Download `GoogleService-Info.plist`
4. Place it at `mobile/GoogleService-Info.plist`

### Step 4: Get FCM Server Key (for backend)

1. Go to **Project Settings > Cloud Messaging**
2. Under **Cloud Messaging API (Legacy)**, enable the API and copy the **Server key**
3. Add to backend `.env` as `FCM_SERVER_KEY`

**OR use Firebase Admin SDK (recommended):**

1. Go to **Project Settings > Service Accounts**
2. Click **Generate new private key**
3. Download the JSON file and save as `backend/firebase-service-account.json`
4. Add `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` to backend `.env`
5. Add `firebase-service-account.json` to `.gitignore` — never commit this file

### Step 5: Configure Expo for Push Notifications

In `mobile/app.json`:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging"
    ]
  }
}
```

---

## 8. SMS OTP Setup

### Option A: MSG91 (Recommended for production)

1. Sign up at [https://msg91.com](https://msg91.com)
2. Complete KYC (required for OTP route in India)
3. Register on DLT (Distributed Ledger Technology) via your telecom — required by TRAI
   - Register at [https://www.vilpower.in](https://www.vilpower.in) or your telco's DLT portal
   - Approve your sender ID and OTP template
4. In MSG91 dashboard, create an OTP template
5. Copy your **API Key** from Account > API
6. Add to `.env`:
   ```
   MSG91_API_KEY=your_api_key
   MSG91_TEMPLATE_ID=your_dlt_template_id
   MSG91_SENDER_ID=YOURID
   ```

### Option B: 2Factor.in (Easier for MVP, no DLT needed for low volume)

1. Sign up at [https://2factor.in](https://2factor.in)
2. Get API key from dashboard
3. Add to `.env`:
   ```
   TWOFACTOR_API_KEY=your_api_key
   ```

### OTP Flow Overview

```
Mobile App                    Backend                      MSG91/2Factor
    |                             |                              |
    |-- POST /auth/send-otp ------>|                              |
    |   { phone: "+919876543210" } |-- Send OTP request --------->|
    |                             |<-- OTP sent (6 digits) -------|
    |<-- { success: true } --------|                              |
    |                             |                              |
    |-- POST /auth/verify-otp ---->|                              |
    |   { phone, otp: "123456" }  |-- Verify OTP in memory ------|
    |                             |-- Create/fetch Supabase user  |
    |<-- { token, user } ----------|                              |
```

---

## 9. Expo Build and Publish (EAS Build)

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure EAS

```bash
cd mobile
eas build:configure
```

This creates `eas.json`. Update it:

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 3: Build for Development (creates a dev client APK for testing)

```bash
eas build --platform android --profile development
```

This uses 1 of your 30 free monthly builds. The APK link will be emailed to you and available in the EAS dashboard.

### Step 4: Build for Production

```bash
# Build both platforms
eas build --platform all --profile production

# Build just Android
eas build --platform android --profile production

# Build just iOS
eas build --platform ios --profile production
```

### Step 5: OTA Updates (no new build needed for JS changes)

```bash
# Push a JS-only update to all users instantly
eas update --branch production --message "Fix visitor log display"
```

OTA updates do not consume build credits. Use them for bug fixes and minor features.

### Step 6: Submit to App Stores

```bash
# Submit to Google Play (requires service account JSON)
eas submit --platform android --latest

# Submit to Apple App Store (requires Apple credentials)
eas submit --platform ios --latest
```

---

## 10. Environment Variables

### Backend (`backend/.env`)

```bash
# Server
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
# OR use JSON string directly (for Render env vars):
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}

# SMS OTP — MSG91
MSG91_API_KEY=your_msg91_api_key
MSG91_TEMPLATE_ID=your_dlt_approved_template_id
MSG91_SENDER_ID=YOURID

# SMS OTP — 2Factor.in (alternative)
TWOFACTOR_API_KEY=your_2factor_api_key

# Security
JWT_SECRET=a_long_random_secret_string_min_32_chars
OTP_EXPIRY_SECONDS=300

# Misc
ALLOWED_ORIGINS=https://your-expo-app-domain.com,exp://192.168.x.x:8081
```

### Mobile App (`mobile/.env`)

```bash
# Backend API
EXPO_PUBLIC_API_URL=https://society-app-backend.onrender.com

# Supabase (anon key only — safe for client)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App Config
EXPO_PUBLIC_APP_ENV=production
```

**Never put `SUPABASE_SERVICE_ROLE_KEY` or `FCM_SERVER_KEY` in the mobile app .env.**

---

## 11. How to Run Locally

```bash
# 1. Start the backend
cd backend
npm run dev
# Server runs at http://localhost:3000

# 2. Start the Expo dev server (new terminal)
cd mobile
npx expo start

# Options:
# Press 'a' for Android emulator
# Press 'i' for iOS simulator
# Scan QR with Expo Go for physical device

# 3. Run backend tests
cd backend
npm test

# 4. Check Supabase migration status
supabase db diff        # See unapplied changes
supabase db push        # Apply migrations to linked project

# 5. Reset local Supabase (if using supabase local dev)
supabase db reset       # WARNING: destroys all local data
```

---

## 12. When to Upgrade from Free Tier

| Trigger | Service to Upgrade | Cost |
|---|---|---|
| Users complain of slow first load (cold start) | Render Free → Starter | +$7/month |
| App disconnects during peak usage | Supabase Free → Pro (200+ concurrent Realtime connections) | +$25/month |
| DB approaching 500 MB | Supabase Free → Pro (8 GB included) | +$25/month |
| More than 30 builds/month needed | EAS Free → Production | +$99/month |
| Storage bandwidth > 2 GB/month (visitor photos) | Supabase Pro (10 GB egress) | Included in $25 |
| SMS OTP costs growing | Evaluate bulk pricing with MSG91 | Negotiable |

**Rule of thumb:** You can comfortably run 50 active societies on Render Starter ($7) + Supabase Free ($0). Beyond that, upgrade Supabase to Pro.
