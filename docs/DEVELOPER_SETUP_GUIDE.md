# Cart-R Developer Setup Guide

> **Last Updated:** January 2026  
> **Project Version:** Expo 51 / Next.js 16

This comprehensive guide will help you set up and run the Cart-R project from scratch. Cart-R is a full-stack logistics and delivery platform consisting of three main applications:

- **Customer App** - React Native (Expo) mobile app for customers to book deliveries
- **Driver App** - React Native (Expo) mobile app for drivers to accept and fulfill deliveries
- **Admin Dashboard** - Next.js web application for platform management

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Project Structure](#-project-structure)
3. [Initial Setup](#-initial-setup)
4. [Environment Configuration](#-environment-configuration)
5. [Backend Setup (Supabase)](#-backend-setup-supabase)
6. [Running the Apps](#-running-the-apps)
7. [Testing APK Files](#-testing-apk-files)
8. [Building APK Files](#-building-apk-files)
9. [Common Issues & Troubleshooting](#-common-issues--troubleshooting)
10. [Testing Credentials](#-testing-credentials)

---

## 🔧 Prerequisites

Before starting, ensure you have the following installed:

### Required Software

| Software | Version | Download Link |
|----------|---------|---------------|
| Node.js | 18+ (LTS recommended) | https://nodejs.org/ |
| npm | 9+ (comes with Node.js) | - |
| Git | Latest | https://git-scm.com/ |
| Android Studio | Latest | https://developer.android.com/studio |
| Supabase CLI | Latest | `npm install -g supabase` |
| EAS CLI | Latest | `npm install -g eas-cli` |
| Expo CLI | Latest | `npm install -g expo-cli` |

### Android Studio Setup

1. Install Android Studio
2. During installation, ensure these are checked:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (AVD)
3. After installation, go to **SDK Manager** and install:
   - Android 14 (API 34) - SDK Platform
   - Android SDK Build-Tools
4. Create an Android Virtual Device (emulator) or connect a physical device via USB

### Environment Variables (System)

Add these to your system PATH:
```
%LOCALAPPDATA%\Android\Sdk\platform-tools
%LOCALAPPDATA%\Android\Sdk\tools
```

---

## 📁 Project Structure

```
Cart-R-main/
├── apps/
│   ├── customer/          # Customer mobile app (Expo)
│   ├── driver/            # Driver mobile app (Expo)
│   └── admin/             # Admin web dashboard (Next.js)
├── supabase/
│   ├── functions/         # Edge Functions (Deno)
│   │   ├── assign-driver/
│   │   ├── calculate-fare/
│   │   ├── create-payment-order/
│   │   ├── verify-payment/
│   │   ├── payment-webhook/
│   │   ├── send-notification/
│   │   └── ...
│   └── migrations/        # Database migrations
├── packages/              # Shared packages
├── docs/                  # Documentation
├── .env.example           # Environment template
└── database schema.txt    # Database schema reference
```

---

## 🚀 Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Real0xdom/cart-r.git
cd cart-r
```

### 2. Install Dependencies

There are separate `node_modules` for each app. Install them individually:

```bash
# Customer App
cd apps/customer
npm install

# Driver App
cd ../driver
npm install

# Admin Dashboard
cd ../admin
npm install

# Return to root
cd ../..
```

> **Note:** The root `package.json` is minimal. Each app manages its own dependencies.

---

## 🔐 Environment Configuration

### Step 1: Copy the Example File

```bash
# From project root
copy .env.example .env
```

### Step 2: Fill in the Values

Open `.env` and configure these values:

```env
# =====================================================
# CARTER - Environment Variables
# =====================================================

# Supabase Configuration
# Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
EXPO_PUBLIC_SUPABASE_URL=https://epevjbiymsvwmmzybzib.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Google Maps API Keys
# Get from: https://console.cloud.google.com/apis/credentials
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
EXPO_PUBLIC_PLACES_API_KEY=your-google-maps-key
EXPO_PUBLIC_DIRECTIONS_API_KEY=your-google-maps-key

# Cashfree Payment Gateway
# Get from: https://merchant.cashfree.com/merchants/pg-dashboard
EXPO_PUBLIC_CASHFREE_APP_ID=your-cashfree-app-id
CASHFREE_SECRET_KEY=your-cashfree-secret-key
CASHFREE_ENVIRONMENT=sandbox

# Geoapify (for static map images)
# Get from: https://www.geoapify.com/
EXPO_PUBLIC_GEOAPIFY_API_KEY=your-geoapify-key

# App Configuration
EXPO_PUBLIC_SERVER_URL=https://cart-r.com
```

### Step 3: Admin Dashboard Environment

Create a separate `.env.local` file in `apps/admin/`:

```bash
cd apps/admin
# Create .env.local with Supabase credentials
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://epevjbiymsvwmmzybzib.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 🗄️ Backend Setup (Supabase)

The project uses Supabase for:
- **Authentication** (Phone OTP)
- **Database** (PostgreSQL)
- **Edge Functions** (Deno)
- **Realtime** (Live location tracking)
- **Storage** (Document uploads)

### Access the Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Login with the project credentials
3. Navigate to the project (Project ID: `epevjbiymsvwmmzybzib`)

### Database Migrations

Migrations are located in `supabase/migrations/`. They are numbered in order:

| Migration | Description |
|-----------|-------------|
| `001_initial_schema.sql` | Core tables (users, drivers, bookings) |
| `002_fix_rls_policies.sql` | Row Level Security fixes |
| `003_postgis_functions.sql` | Geolocation functions |
| `004_security_rls_policies.sql` | Enhanced security policies |
| `005_booking_enhancements.sql` | Booking flow improvements |
| `006_notify_drivers_trigger.sql` | Driver notification triggers |
| `007_notification_webhook.sql` | Push notification hooks |
| `009_driver_verification_history.sql` | Verification tracking |
| `010a_add_tempo_enum.sql` | Vehicle type enum |
| `010b_booking_flow.sql` | Complete booking flow |
| `011_check_phone_exists.sql` | Phone validation |
| `012_payment_confirmation.sql` | Payment verification |
| `013_fix_rls_and_notifications.sql` | Latest RLS and notification fixes |
| `014_fix_accept_booking_rls.sql` | Booking acceptance RLS |
| `20251226_add_wallet.sql` | Wallet functionality |

### Deploy Edge Functions

```bash
# Login to Supabase
supabase login

# Deploy a specific function
supabase functions deploy calculate-fare

# Deploy all functions
supabase functions deploy
```

---

## 🏃 Running the Apps

### Customer App (Expo)

```bash
cd apps/customer

# Start development server
npx expo start

# Run on Android (with device/emulator connected)
npx expo start --android

# Run with dev client (if you have a development build)
npx expo start --dev-client
```

### Driver App (Expo)

```bash
cd apps/driver

# Start development server
npx expo start

# Run on Android
npx expo start --android

# Run with dev client
npx expo start --dev-client
```

### Admin Dashboard (Next.js)

```bash
cd apps/admin

# Start development server
npm run dev
```

The admin dashboard will be available at: `http://localhost:3000`

---

## 📱 Testing APK Files

### What are Development APKs?

Development APKs are pre-built Android packages that include all native modules (like Google Maps, Cashfree payments, etc.) but connect to your development server for hot reloading. This means:

- ✅ Full native functionality (maps, payments, notifications)
- ✅ Hot reload for code changes
- ✅ Console logs visible in terminal
- ❌ Requires development server running

### How to Test with Existing APKs

#### Step 1: Locate the APK Files

APK locations after building:
- **Driver APK:** `apps/driver/android/app/build/outputs/apk/debug/app-debug.apk`
- **Customer APK:** Built via EAS or local build

#### Step 2: Install APK on Device/Emulator

**Option A: Using ADB (Command Line)**
```bash
# Connect your Android device via USB with USB debugging enabled
# OR start an Android emulator

# Install the APK
adb install path/to/your-app.apk

# If reinstalling, use -r flag
adb install -r path/to/your-app.apk
```

**Option B: Direct Transfer**
1. Copy the APK to your Android device
2. Open the file on your device
3. Allow installation from unknown sources when prompted
4. Install the app

#### Step 3: Start the Development Server

```bash
# For Customer App
cd apps/customer
npx expo start --dev-client

# For Driver App
cd apps/driver
npx expo start --dev-client
```

#### Step 4: Connect the App to Server

1. Open the installed APK on your device/emulator
2. The app will show a screen to enter the development server URL
3. **If on same network:** Scan the QR code shown in terminal
4. **If different network:** Enter the URL manually (e.g., `exp://192.168.1.100:8081`)

> **Tip:** Make sure your computer and device are on the same WiFi network!

### Testing Both Apps Simultaneously

You can test both customer and driver apps at the same time:

1. **Option A: Two Physical Devices**
   - Install customer APK on one device
   - Install driver APK on another device

2. **Option B: Emulator + Physical Device**
   - Run customer app on emulator
   - Run driver app on physical device (or vice versa)

3. **Option C: Two Emulators**
   - Create two Android Virtual Devices in Android Studio
   - Run each app on a different emulator

---

## 🔨 Building APK Files

### Using EAS Build (Recommended)

EAS Build is Expo's cloud build service. It's the easiest way to create APKs.

#### Setup (One-time)

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login
```

#### Build Development APK

```bash
# Customer App
cd apps/customer
eas build --platform android --profile development

# Driver App
cd apps/driver
eas build --platform android --profile development
```

#### Build Profiles

The `eas.json` file defines build profiles:

| Profile | Purpose | Output |
|---------|---------|--------|
| `development` | Dev testing with hot reload | APK |
| `preview` | Internal testing, no dev client | APK |
| `production` | Play Store release | AAB (App Bundle) |

### Local Build (No Expo Account Needed)

If you want to build locally:

```bash
cd apps/driver

# Generate native Android project
npx expo prebuild --platform android

# Build using Gradle
cd android
./gradlew assembleDebug

# APK will be at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🐛 Common Issues & Troubleshooting

### 1. "Metro bundler not found" or "Unable to connect"

**Solution:**
```bash
# Restart Metro bundler
npx expo start --clear
```

### 2. "SDK location not found"

**Solution:**
Create `local.properties` in `apps/[app]/android/`:
```
sdk.dir=C:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk
```

### 3. Google Maps not showing

**Possible Causes:**
- API key not configured
- API not enabled in Google Cloud Console

**Solution:**
1. Go to Google Cloud Console
2. Enable Maps SDK for Android
3. Verify API key in `app.json` and `.env`

### 4. "Invariant Violation: requireNativeComponent"

**Cause:** Native module not installed correctly

**Solution:**
```bash
cd apps/[app]
npx expo prebuild --clean
npx expo run:android
```

### 5. Payment SDK crashes in Expo Go

**Cause:** Cashfree native SDK not available in Expo Go

**Solution:** Use a development build (APK) instead of Expo Go. The code automatically falls back to web checkout in Expo Go.

### 6. "Error reverse geocoding" on app start

**Cause:** Location API timeout, often when running multiple apps

**Solution:** This is usually transient. The app handles this gracefully.

---

## 🧪 Testing Credentials

### Test Phone Numbers (OTP: 123456)

These phone numbers have a fixed OTP for testing:

```
+91 7744066077 → OTP: 123456
+91 9356505599 → OTP: 123456
+91 9876500001 → OTP: 123456
+91 9876500002 → OTP: 123456
+91 9876500011 → OTP: 123456
+91 9876500012 → OTP: 123456
+91 9876500013 → OTP: 123456
```

### Cashfree Sandbox Test Cards

For testing payments in sandbox mode:

| Card Type | Number | Expiry | CVV |
|-----------|--------|--------|-----|
| Visa | 4111111111111111 | Any future | Any 3-digit |
| Mastercard | 5555555555554444 | Any future | Any 3-digit |

---

## 📚 Additional Resources

### Key Files Reference

| File | Purpose |
|------|---------|
| `apps/customer/app.json` | Customer app configuration |
| `apps/driver/app.json` | Driver app configuration |
| `apps/*/eas.json` | EAS Build profiles |
| `.env.example` | Environment template |
| `database schema.txt` | Complete DB schema reference |
| `supabase/config.toml` | Supabase configuration |

### Useful Commands

```bash
# Clear Metro cache
npx expo start --clear

# Reset node_modules
rm -rf node_modules && npm install

# View Supabase function logs
supabase functions logs <function-name> --tail

# Check ADB devices
adb devices

# Debug build info
npx expo-doctor
```

---

## 📞 Need Help?

If you encounter issues not covered here:

1. Check the existing documentation in `/docs/`
2. Review the test case documents in the project root:
   - `Assessment of Cartr MVP Comprehensive Testing Plan.md`
   - `Cartr MVP Core Functional Testing Use Cases.md`
   - `Comprehensive Edge Case Testing Guide for Cartr Logistics MVP.md`
3. Check Supabase Dashboard for API/function errors
4. Review Metro bundler console for JavaScript errors

---

**Happy Coding! 🚀**
