# Society App — Setup & Getting Started Guide

> A complete, step-by-step guide for developers setting up the Society App for the first time.
> This covers everything from creating third-party accounts to running the app end-to-end on a real device.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and Install](#2-clone-and-install)
3. [Supabase Setup](#3-supabase-setup)
4. [Firebase Setup (Push Notifications)](#4-firebase-setup-push-notifications)
5. [SMS OTP Setup](#5-sms-otp-setup)
6. [Backend Environment Setup](#6-backend-environment-setup)
7. [Mobile Environment Setup](#7-mobile-environment-setup)
8. [Running Locally](#8-running-locally)
9. [EAS Build Setup (Real Device Testing)](#9-eas-build-setup-real-device-testing)
10. [App Assets](#10-app-assets)
11. [Render Deployment (Backend)](#11-render-deployment-backend)
12. [GitHub CI/CD Setup](#12-github-cicd-setup)
13. [First-Time App Flow (End-to-End Test)](#13-first-time-app-flow-end-to-end-test)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

Install the following before proceeding. Each item links to the relevant download or signup page.

### Required Software

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org (choose LTS) |
| npm | 9+ | Bundled with Node.js |
| Git | Any recent | https://git-scm.com |
| Expo CLI | Latest | `npm install -g expo-cli` |
| EAS CLI | Latest | `npm install -g eas-cli` |
| Supabase CLI | Latest | See below |

**Verify your Node version:**

```bash
node --version   # must be v20.x.x or higher
npm --version    # must be 9.x.x or higher
```

**Install Expo and EAS CLIs:**

```bash
npm install -g expo-cli eas-cli
```

**Install Supabase CLI:**

On macOS (recommended):

```bash
brew install supabase/tap/supabase
```

On Linux / Windows (via npm):

```bash
npm install -g supabase
```

Verify:

```bash
supabase --version    # should print 1.x.x or higher
```

### Required Accounts (all free tiers)

Sign up for these accounts before continuing — you'll need credentials from each:

| Service | Purpose | URL |
|---------|---------|-----|
| Supabase | Database, Auth, Storage, Realtime | https://supabase.com |
| Firebase | Push notifications (FCM) | https://console.firebase.google.com |
| Render | Backend hosting | https://render.com |
| Expo | EAS builds and OTA updates | https://expo.dev |
| GitHub | Source control, CI/CD | https://github.com |
| MSG91 or 2Factor.in | SMS OTP (India numbers) | https://msg91.com or https://2factor.in |

> **Note:** Firebase and SMS are optional for local development. You can run and test the app without them by using mock/console modes described in sections 4 and 5.

---

## 2. Clone and Install

### Clone the repository

```bash
git clone https://github.com/aniketshaw29/society-app.git
cd society-app
```

### Install backend dependencies

```bash
cd backend && npm install && cd ..
```

### Install mobile dependencies

```bash
cd mobile && npm install && cd ..
```

Your directory structure should look like:

```
society-app/
├── backend/          # Node.js/Express API
│   ├── src/
│   ├── package.json
│   └── .env.example
├── mobile/           # React Native + Expo
│   ├── src/
│   ├── app/
│   ├── assets/
│   ├── eas.json
│   └── .env.example
├── supabase/         # Supabase config and migrations
│   ├── migrations/
│   └── config.toml
└── .github/
    └── workflows/
```

---

## 3. Supabase Setup

This is the most critical section. Supabase provides the database (PostgreSQL), authentication, file storage, and realtime subscriptions. Take your time here.

### Step 1: Create a new Supabase project

1. Go to https://supabase.com and sign in.
2. Click **New project**.
3. Fill in:
   - **Name:** `society-app` (or your preferred name)
   - **Database Password:** Choose a strong password and save it securely.
   - **Region:** Select **ap-south-1 (Mumbai)** — this is closest to Indian users and minimises latency.
4. Click **Create new project** and wait ~2 minutes for provisioning.

### Step 2: Note your project credentials

Once the project is ready, go to **Project Settings → API** and copy:

- **Project URL** — looks like `https://abcdefghijkl.supabase.co`
- **anon/public key** — a long JWT starting with `eyJ...`
- **service_role key** — another long JWT. **Keep this secret — it bypasses all RLS policies.**

Also note your **Project Reference ID** (the short code in your project URL, e.g. `abcdefghijkl`). You can find it at **Settings → General**.

### Step 3: Log in to the Supabase CLI

```bash
supabase login
```

This opens a browser window. Log in with your Supabase account and authorise the CLI.

### Step 4: Link the CLI to your project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the reference ID from Step 2 (e.g., `abcdefghijkl`).

When prompted, enter the database password you set in Step 1.

Verify the link:

```bash
supabase projects list
```

You should see your project listed with a checkmark on the linked project.

### Step 5: Run all database migrations

```bash
supabase db push
```

This applies all 7 migration files in `supabase/migrations/` to your remote database:

| File | What it creates |
|------|----------------|
| `001_initial_schema.sql` | Core tables: societies, buildings, flats, residents, guards, visitors, staff |
| `002_rls_policies.sql` | Row-Level Security policies for full data isolation between societies |
| `003_storage_buckets.sql` | Storage buckets for visitor photos, resident avatars, notice attachments |
| `004_functions.sql` | PostgreSQL helper functions (OTP generation, invite code logic) |
| `005_sync_conflict_log.sql` | Offline sync conflict resolution table for guard SQLite sync |
| `006_performance_indexes.sql` | Indexes on frequently queried columns |
| `007_rls_verification.sql` | Verification checks confirming RLS is enabled on all tables |

Expected output:

```
Applying migration 001_initial_schema.sql...OK
Applying migration 002_rls_policies.sql...OK
...
Applying migration 007_rls_verification.sql...OK
```

If any migration fails, see [Troubleshooting](#14-troubleshooting).

### Step 6: Enable Phone Authentication

The app uses phone OTP as its only login method — no passwords.

1. In the Supabase Dashboard, go to **Authentication → Providers → Phone**.
2. Toggle **Enable Phone Provider** to on.
3. For local development, you can leave the phone provider unconfigured — the backend's mock SMS provider handles OTPs without Supabase needing a real SMS service.
4. For production: add your MSG91 or Twilio credentials here, or configure the backend SMS provider (see Section 5) to send OTPs directly and use Supabase only for session management.

### Step 7: Verify storage buckets

Go to **Storage** in the Supabase Dashboard. You should see these buckets created by migration 003:

- `visitor-photos` — photos captured at the gate
- `avatars` — resident profile pictures  
- `notice-attachments` — files attached to society notices

If the buckets are missing, you can create them manually or re-run `supabase db push`.

> **Tip:** The free tier includes 1 GB of storage. For production, compress photos in the mobile app before upload (the app uses `expo-image-manipulator` for this).

---

## 4. Firebase Setup (Push Notifications)

Firebase Cloud Messaging (FCM) sends push notifications to residents when visitors arrive, notices are posted, etc.

> **You can skip this entire section for local development.** Push notifications simply won't fire. Come back here when you're ready to test notifications.

### Step 1: Create a Firebase project

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**.
3. Name it `society-app` (or similar).
4. Disable Google Analytics (not needed) and click **Create project**.

### Step 2: Add the Android app

1. In your Firebase project, click the **Android icon** to add an Android app.
2. Android package name: `com.societyapp.mobile`
3. App nickname: `Society App Android` (optional)
4. Click **Register app**.
5. Download `google-services.json` — save it somewhere safe (you'll upload it as an EAS secret in Section 9).
6. Skip the SDK setup steps (the app already has them configured).

### Step 3: Add the iOS app

1. Click the **iOS icon** to add an iOS app.
2. iOS bundle ID: `com.societyapp.mobile`
3. App nickname: `Society App iOS` (optional)
4. Click **Register app**.
5. Download `GoogleService-Info.plist` — save it somewhere safe.
6. Skip the SDK setup steps.

### Step 4: Enable Cloud Messaging

1. Go to **Project Settings** (gear icon) → **Cloud Messaging** tab.
2. Confirm that Firebase Cloud Messaging API is enabled. If you see a button to enable it, click it.

### Step 5: Get the service account key (for the backend)

The backend uses the Firebase Admin SDK to send notifications. It needs a service account key.

1. Go to **Project Settings → Service accounts**.
2. Click **Generate new private key**.
3. Click **Generate key** to confirm.
4. A JSON file is downloaded. Open it and extract these three values:
   - `project_id`
   - `client_email`
   - `private_key` (the full RSA private key including `-----BEGIN PRIVATE KEY-----` header and footer)

You'll add these to `backend/.env` in Section 6.

> **Security note:** Never commit the service account JSON file to git. Treat `private_key` like a password.

---

## 5. SMS OTP Setup

The app uses phone OTP for authentication. Three options are available — choose based on your use case.

### Option A: Mock / Console (local development — recommended to start)

No external account needed. OTPs are printed directly to the backend terminal.

Set in `backend/.env`:

```env
SMS_PROVIDER=mock
```

When a user requests an OTP, you'll see something like this in your backend terminal:

```
[SMS MOCK] Sending OTP 482917 to +919876543210
```

**Use this for all local development.** Switch to a real provider only when testing the full production flow.

### Option B: 2Factor.in (easier for testing with real Indian numbers)

Good for quick testing with actual Indian SIM cards before completing MSG91 DLT registration.

1. Sign up at https://2factor.in.
2. After login, go to **API** section and copy your API key.
3. Set in `backend/.env`:

```env
SMS_PROVIDER=twofactor
TWOFACTOR_API_KEY=your-api-key-here
```

Free tier includes a limited number of SMS per month — sufficient for development and early testing.

### Option C: MSG91 (recommended for production)

MSG91 is a Tier-1 SMS provider in India with excellent delivery rates. Required for production traffic.

> **Important:** TRAI regulations in India require **DLT (Distributed Ledger Technology) registration** for all transactional and promotional SMS. This involves registering your business entity and OTP message template with TRAI's DLT portal. The process takes 1–7 business days.

1. Sign up at https://msg91.com.
2. Complete DLT registration (required by law for Indian SMS):
   - Register your business entity on the DLT portal.
   - Register your OTP template. Example template: `Your Society App OTP is {#var#}. Valid for 5 minutes. Do not share with anyone.`
   - Note your **Template ID** once approved.
3. In MSG91 dashboard → **OTP** → get your **Auth Key**.
4. Note your **Sender ID** (6-character alphanumeric, e.g., `SOCAPP`).
5. Set in `backend/.env`:

```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your-auth-key
MSG91_TEMPLATE_ID=your-dlt-template-id
MSG91_SENDER_ID=SOCAPP
MSG91_ROUTE=4
```

> **Note:** `MSG91_ROUTE=4` is the transactional route for OTPs in India. Do not change this.

---

## 6. Backend Environment Setup

### Step 1: Copy the example environment file

```bash
cp backend/.env.example backend/.env
```

### Step 2: Fill in the values

Open `backend/.env` in your editor. Here is the complete file with descriptions:

```env
# ============================================================
# Society App Backend — Environment Variables
# ============================================================

# ----- Server -----

# Port the HTTP server listens on
PORT=3000

# Runtime environment
NODE_ENV=development


# ----- Supabase -----

# Your Supabase project URL (from Settings → API)
SUPABASE_URL=https://your-project-ref.supabase.co

# Service role key — bypasses RLS, NEVER expose to the frontend
# Found in: Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...


# ----- Firebase (push notifications — optional for local dev) -----

# Firebase project ID (from Firebase Console → Project Settings → General)
FIREBASE_PROJECT_ID=your-firebase-project-id

# Service account email (from the downloaded service account JSON)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Service account private key — include full key, escape newlines as \n
# e.g., "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"


# ----- CORS -----

# Allowed origin for the frontend (no trailing slash)
# For local dev with Expo: http://localhost:8081
FRONTEND_URL=http://localhost:8081


# ----- Security -----

# Secret key for internal API-to-API calls (minimum 32 characters)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_SECRET_KEY=change_me_to_a_long_random_secret_at_least_32_chars

# HMAC secret for signing and verifying QR code payloads
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
QR_HMAC_SECRET=change_me_to_a_long_random_qr_secret_at_least_32_chars


# ----- SMS / OTP -----

# Provider: 'mock' (prints to terminal) | 'twofactor' | 'msg91'
# Use 'mock' for all local development
SMS_PROVIDER=mock

# 2Factor.in credentials (only when SMS_PROVIDER=twofactor)
TWOFACTOR_API_KEY=your-2factor-api-key

# MSG91 credentials (only when SMS_PROVIDER=msg91)
MSG91_AUTH_KEY=your-msg91-auth-key
MSG91_TEMPLATE_ID=your-dlt-approved-template-id
MSG91_SENDER_ID=SOCAPP
MSG91_ROUTE=4

# OTP configuration
OTP_LENGTH=6
OTP_EXPIRY_SECONDS=300
```

### Required variables for local development

At minimum, you need these four to start the backend:

| Variable | Where to get it |
|----------|----------------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `API_SECRET_KEY` | Generate with the command above |
| `QR_HMAC_SECRET` | Generate with the command above |

Everything else is optional for local development. Firebase vars are needed for push notifications; SMS vars are only needed when using a real SMS provider (use `SMS_PROVIDER=mock` locally).

### Generate secret keys

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this twice — once for `API_SECRET_KEY` and once for `QR_HMAC_SECRET`. Each value should be a unique 64-character hex string.

---

## 7. Mobile Environment Setup

### Step 1: Copy the example environment file

```bash
cp mobile/.env.example mobile/.env.local
```

> **Why `.env.local`?** Expo reads `.env.local` for local overrides. Values prefixed with `EXPO_PUBLIC_` are bundled into the app and accessible at runtime via `process.env.EXPO_PUBLIC_*`.

### Step 2: Fill in the values

Open `mobile/.env.local`:

```env
# Supabase project URL (same as SUPABASE_URL in backend/.env)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase anon key — this is the PUBLIC key, NOT the service_role key
# Found in: Supabase Dashboard → Settings → API → anon/public key
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API URL
# For LOCAL development: use your machine's LAN IP address, NOT localhost
# Find your IP: on macOS run `ipconfig getifaddr en0`, on Linux `hostname -I`
# Example: http://192.168.1.42:3000
# For production: https://your-app-xxxx.onrender.com
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.42:3000

# Firebase web app config (optional — push notifications won't work without it)
# Found in: Firebase Console → Project Settings → General → Your apps → Web app config
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

### Finding your machine's LAN IP address

The Expo app on a physical device or Android emulator cannot reach `localhost` — it needs your machine's actual IP on the local network.

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows (PowerShell)
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress
```

Use that IP (e.g., `192.168.1.42`) in:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.42:3000
```

> **Important:** Both your development machine and your phone/emulator must be on the same Wi-Fi network.

---

## 8. Running Locally

### Terminal 1 — Start the backend

```bash
cd backend && npm run dev
```

Expected output:

```
[ts-node-dev] Starting...
Server running on port 3000
Supabase connected ✓
```

Verify it's working:

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Terminal 2 — Start the mobile app

```bash
cd mobile && npx expo start
```

This opens the Expo dev server in your terminal with a QR code.

**To run on a device or simulator:**

| Command | What it does |
|---------|-------------|
| Press `a` | Open in Android emulator (requires Android Studio) |
| Press `i` | Open in iOS simulator (macOS + Xcode only) |
| Scan QR code | Open in Expo Go app on a physical device |

> **Expo Go** is available on the App Store and Google Play. It lets you run the app on a real device without building a native binary. Install it first, then scan the QR code from `npx expo start`.

> **Note:** Some features — push notifications, biometric auth, native camera in certain modes — do not work in Expo Go. For those, use an EAS development build (Section 9).

---

## 9. EAS Build Setup (Real Device Testing)

EAS (Expo Application Services) builds native Android `.apk` and iOS `.ipa` files in the cloud. Use this when Expo Go isn't enough (e.g., testing push notifications).

### Step 1: Log in to your Expo account

```bash
eas login
```

### Step 2: Initialise EAS for the project

```bash
cd mobile
eas init
```

This creates a project on expo.dev and prints a project ID like `abc12345-...`. Copy it.

Open `mobile/app.config.ts` and add the `extra.eas.projectId` field if it's not already there:

```typescript
extra: {
  eas: {
    projectId: 'your-eas-project-id-here',
  },
},
```

Also update `mobile/eas.json` if prompted.

### Step 3: Add Firebase files as EAS secrets

Firebase config files contain sensitive credentials and must not be committed to git. Upload them as EAS secrets instead:

```bash
# From the directory where you downloaded the Firebase files
eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
  --type file --value ./google-services.json

eas secret:create --scope project --name GOOGLE_SERVICES_INFO_PLIST \
  --type file --value ./GoogleService-Info.plist
```

### Step 4: Build a development client

A development client is a custom Expo Go that includes all native modules your app needs.

**Android (faster, recommended first):**

```bash
eas build --platform android --profile development
```

**iOS (requires Apple Developer account, $99/year):**

```bash
eas build --platform ios --profile development
```

The build runs in the cloud and takes 5–20 minutes. When it finishes, you'll get a download link. Install the `.apk` on your Android device (you may need to enable "Install from unknown sources" in device settings).

### EAS build profiles

The `mobile/eas.json` defines three build profiles:

| Profile | Purpose | Distribution |
|---------|---------|-------------|
| `development` | Dev client for testing with live Expo server | Internal (direct install) |
| `preview` | Release-like build for QA and stakeholder testing | Internal |
| `production` | App Store / Play Store submission | Store |

---

## 10. App Assets

The `mobile/assets/` directory needs real image assets before you can submit to app stores (or before the app looks polished). Currently the directory contains a placeholder README.

Replace the following files with your actual assets:

| File | Size | Notes |
|------|------|-------|
| `icon.png` | 1024×1024px | App icon. No transparency — solid background. |
| `splash.png` | 1242×2436px | Splash screen shown at launch. |
| `adaptive-icon.png` | 1024×1024px | Android adaptive icon foreground layer. |
| `notification-icon.png` | 96×96px | Android notification tray icon. White on transparent background. |
| `favicon.png` | 32×32px | For Expo web (optional). |

### Brand colours

The primary brand colour is `#1B6B3A` (dark green). The splash screen background and Android adaptive icon background both use this colour (already set in `app.config.ts`).

### Generating icons

Use these free tools to generate all icon sizes from a single source image:

- **buildicon:** https://buildicon.netlify.app/ — generates all Expo icon variants
- **EAS Asset Generator:** `npx expo-asset-generator` (CLI tool)
- **Figma:** Design your icon at 1024×1024 and export at the required sizes

> **Note:** For local development and testing, the placeholder icon is fine. You only need final assets before submitting to the App Store or Play Store.

---

## 11. Render Deployment (Backend)

Render hosts the backend Node.js/Express API. The free (starter) tier is sufficient for development and small societies.

### Step 1: Push your code to GitHub

The repository must be on GitHub before Render can connect to it.

```bash
git push origin main
```

### Step 2: Create a new Web Service on Render

1. Go to https://render.com and sign in.
2. Click **New → Web Service**.
3. Connect your GitHub account if you haven't already.
4. Select the `society-app` repository.
5. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `society-app-backend` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Node version** | 20 |
| **Build command** | `npm install && npm run build` |
| **Start command** | `npm start` |
| **Health check path** | `/health` |
| **Region** | Singapore (closest to India) or Oregon |
| **Plan** | Free (starter) |

### Step 3: Add environment variables

In the Render dashboard for your service, go to **Environment** and add all the variables from `backend/.env`. At minimum:

- `NODE_ENV` = `production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_SECRET_KEY`
- `QR_HMAC_SECRET`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (for push notifications)
- `SMS_PROVIDER` and relevant SMS credentials

> **Tip for `FIREBASE_PRIVATE_KEY`:** Paste the full private key including the `-----BEGIN PRIVATE KEY-----` header. Make sure all newlines are represented as `\n` in a single-line string. Render handles this correctly when you paste into the dashboard.

### Step 4: Deploy

Click **Create Web Service**. Render will build and deploy automatically. The first deploy takes 2–5 minutes.

After deployment, your backend URL will be something like:

```
https://society-app-backend-xxxx.onrender.com
```

Test it:

```bash
curl https://society-app-backend-xxxx.onrender.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Free tier keep-alive

The Render free tier **spins down after 15 minutes of inactivity**. The first request after a cold start takes ~30 seconds (502 errors during spin-up).

Prevent cold starts with a free uptime monitor:

1. Go to https://uptimerobot.com and create a free account.
2. Click **Add New Monitor**.
3. Type: **HTTP(s)**
4. URL: `https://your-app-xxxx.onrender.com/health`
5. Monitoring interval: **5 minutes**

This keeps the service warm 24/7 at no cost.

### Step 5: Update mobile environment for production

Once deployed, update `mobile/.env.local` (and your EAS environment) to point to the production backend:

```env
EXPO_PUBLIC_BACKEND_URL=https://society-app-backend-xxxx.onrender.com
```

---

## 12. GitHub CI/CD Setup

CI runs automatically on every push to `main` or `develop` via `.github/workflows/ci.yml`. No setup required for CI to run.

### What CI checks

For both `backend/` and `mobile/`:

1. `npm ci` — clean install of dependencies
2. `npm run typecheck` — TypeScript type checking
3. `npm test -- --coverage` — Jest unit tests with coverage
4. Coverage upload to Codecov (optional)

### Optional: Enable Codecov coverage reports

1. Go to https://codecov.io and sign in with GitHub.
2. Add your repository.
3. Copy your **Codecov token**.
4. In your GitHub repository, go to **Settings → Secrets and variables → Actions**.
5. Add a new secret: `CODECOV_TOKEN` = your token.

### Auto-deploy to Render on push

The workflow `.github/workflows/deploy-backend.yml` automatically triggers a Render deploy whenever code in `backend/` is pushed to `main`.

To enable it:

1. In the Render dashboard, go to your service → **Settings → Deploy Hook**.
2. Copy the deploy hook URL (looks like `https://api.render.com/deploy/srv-xxxx?key=yyyy`).
3. In your GitHub repository → **Settings → Secrets and variables → Actions**.
4. Add a new secret: `RENDER_DEPLOY_HOOK_URL` = the hook URL.

Now every push to `main` that touches `backend/` will automatically trigger a new Render deployment.

---

## 13. First-Time App Flow (End-to-End Test)

Once both backend and mobile are running, walk through this flow to verify everything is connected correctly.

### Setup checklist before testing

- [ ] Backend running on port 3000 (`npm run dev`)
- [ ] Mobile dev server running (`npx expo start`)
- [ ] `EXPO_PUBLIC_BACKEND_URL` set to your machine's LAN IP (not localhost)
- [ ] `SMS_PROVIDER=mock` in `backend/.env` so OTPs appear in the terminal
- [ ] Supabase migrations applied (`supabase db push`)

### Full end-to-end flow

**1. Register a society (as Admin)**

- Open the app on your device or simulator.
- Enter a phone number → tap "Send OTP".
- In your **backend terminal**, look for: `[SMS MOCK] Sending OTP 482917 to +91...`
- Enter the 6-digit OTP shown in the terminal.
- New users see a "Welcome" screen → tap **"Register my Society"**.
- Fill in society name, address, city → tap "Create Society".
- You are now the society admin. Note the **invite code** shown on screen.

**2. Set up society structure**

- From the admin dashboard, tap **"Add Building"** → name it "Block A".
- Tap **"Add Flat"** → add two flats: `101` and `102`.
- Tap **"Add Guard"** → enter a guard's phone number.

**3. Log a visitor (as Guard)**

- Log out from the admin account.
- Log in with the guard's phone number (same OTP flow).
- On the guard dashboard, tap **"Log Visitor"**.
- Fill in: visitor name, phone, purpose, flat to visit.
- Tap **"Submit"**.
- A push notification (or Supabase realtime event) is sent to the flat's resident.

**4. Approve the visitor (as Resident)**

- Log out from the guard account.
- Log in with a resident's phone number. If the resident hasn't registered yet:
  - On the "Welcome" screen, tap **"Join my Society"**.
  - Enter the invite code from Step 1.
  - Select your flat (e.g., Flat 101).
- On the resident dashboard, you should see a **pending visitor approval card**.
- Tap **"Allow Entry"**.

**5. Verify realtime update**

- Switch back to the guard account.
- The guard's screen should update in real time showing the visitor is approved.

If this full flow works, your setup is complete.

---

## 14. Troubleshooting

### "Cannot connect to backend" / network errors in the app

**Cause:** `EXPO_PUBLIC_BACKEND_URL` is set to `localhost` or `127.0.0.1`, which refers to the device's own localhost, not your development machine.

**Fix:** Find your machine's LAN IP and use it instead:

```bash
# macOS
ipconfig getifaddr en0
```

Then set:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.42:3000
```

Both your machine and device must be on the same Wi-Fi network.

---

### "OTP not received" / OTP never arrives

**Fix:** Ensure you're using the mock provider in local development:

```env
SMS_PROVIDER=mock
```

Restart the backend after changing `.env`. The OTP will be printed in the backend terminal:

```
[SMS MOCK] Sending OTP 482917 to +919876543210
```

If using a real provider and OTP still doesn't arrive, check:
- MSG91: verify DLT registration is approved and template ID is correct.
- 2Factor.in: verify the API key is active and the account has credits.

---

### "supabase db push" fails

**Common causes:**

1. Not linked to the correct project.

```bash
supabase projects list          # verify the correct project is linked
supabase link --project-ref YOUR_CORRECT_REF
```

2. Wrong database password. Re-link with the correct password.

3. A migration was partially applied. Check the Supabase dashboard → **Database → Migrations** to see which migrations ran.

---

### "Push notifications not working"

**Cause:** Firebase environment variables are missing or incorrect in `backend/.env`.

**Fix:**
1. Verify all three Firebase vars are set: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
2. Ensure the private key is a single line with `\n` representing newlines: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`
3. Restart the backend after updating `.env`.
4. For Render: redeploy after updating environment variables in the dashboard.

> Push notifications also require the app to be built with the development or production EAS profile — they do **not** work in Expo Go.

---

### "Render 502 / service sleeping"

**Cause:** Render free tier spins down after 15 minutes of inactivity. The first request after spin-up returns a 502 while the service warms up (~30 seconds).

**Fix:** Set up UptimeRobot to ping `GET /health` every 5 minutes (see [Section 11](#step-4-free-tier-keep-alive)).

---

### TypeScript errors in CI (`tsc errors`)

**Fix:** Run typecheck locally before pushing:

```bash
cd backend && npm run typecheck
cd mobile && npm run typecheck
```

Common causes:
- Missing type for a new dependency — run `npm install @types/package-name`.
- A new file has implicit `any` types — add explicit types.
- A required env variable is not typed — update the types in `src/config.ts`.

---

### "eas build" fails with missing assets

**Cause:** `mobile/assets/` directory is missing required image files.

**Fix:** Add the required assets described in [Section 10](#10-app-assets). For a quick placeholder, you can use any PNG image resized to the correct dimensions.

---

### Android emulator can't reach the backend

**Cause:** Android emulators route `localhost` to the emulator's own loopback, not your host machine.

**Fix options:**

1. Use your machine's LAN IP (same fix as physical device).
2. Use the Android emulator's special alias for host localhost: `10.0.2.2`

```env
EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:3000
```

---

### "supabase login" command not found

**Cause:** Supabase CLI not installed or not in PATH.

**Fix:**

```bash
# macOS
brew install supabase/tap/supabase

# Verify
which supabase
supabase --version
```

---

*Last updated: July 2026*
