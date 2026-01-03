# Cart-R APK Testing Guide

> **Step-by-step guide for testing development APK builds**

This guide explains how to test the Cart-R Customer and Driver apps using pre-built development APKs.

---

## 📋 What You Need

1. **APK Files** - Development builds of Customer and/or Driver apps
2. **Android Device** or **Emulator** with USB debugging enabled
3. **Computer** running the development server
4. **Same WiFi Network** for device and computer

---

## 🔌 Setting Up Your Android Device

### For Physical Device

1. **Enable Developer Options:**
   - Go to **Settings > About Phone**
   - Tap **Build Number** 7 times
   - You'll see "You are now a developer!"

2. **Enable USB Debugging:**
   - Go to **Settings > Developer Options**
   - Enable **USB debugging**
   - Connect device to computer via USB cable
   - Accept the "Allow USB debugging?" prompt on your device

3. **Allow Unknown Sources:**
   - Go to **Settings > Security**
   - Enable **Install from unknown sources** (or per-app in newer Android)

### For Emulator

1. Open Android Studio
2. Go to **Tools > Device Manager**
3. Create or start a virtual device (recommended: Pixel 4 with API 34)

---

## 📲 Installing the APK

### Method 1: ADB Command (Recommended)

```bash
# Check if device is connected
adb devices

# Install Customer APK
adb install path/to/customer-dev.apk

# Install Driver APK
adb install path/to/driver-dev.apk

# Force reinstall (if already installed)
adb install -r path/to/your-app.apk
```

### Method 2: Direct Installation

1. Copy the APK file to your device (via USB, email, or cloud storage)
2. Open a file manager on your Android device
3. Navigate to the APK file
4. Tap to install
5. Accept any security prompts

---

## 🚀 Running with Development Server

Development APKs need a dev server to load JavaScript code. Here's how to set it up:

### Step 1: Start the Dev Server

```bash
# For Customer App
cd apps/customer
npx expo start --dev-client

# For Driver App  
cd apps/driver
npx expo start --dev-client
```

### Step 2: Note the Server URL

When the dev server starts, you'll see something like:
```
› Metro waiting on exp://192.168.1.100:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### Step 3: Connect the App

1. Open the installed APK on your device
2. You should see the Expo Dev Client interface
3. **Option A:** Scan the QR code shown in terminal
4. **Option B:** Manually enter the URL: `http://192.168.1.100:8081`

The app should load and you can now test with hot reload!

---

## 🔄 Testing Both Apps Together

### Scenario: Complete Booking Flow Test

To test the full flow (customer books → driver accepts → delivery completes), you need both apps running.

#### Setup Options:

| Option | Customer App | Driver App |
|--------|-------------|------------|
| **Two Devices** | Physical phone 1 | Physical phone 2 |
| **Emulator + Device** | Android emulator | Physical phone |
| **Two Emulators** | Emulator 1 | Emulator 2 |

#### Test Flow:

1. **Login as Customer** (use test phone: +91 9876500001)
2. **Login as Driver** on other device (use test phone: +91 9876500011)
3. **Driver:** Go online in the app
4. **Customer:** Create a booking
5. **Driver:** Should receive notification, accept the booking
6. **Both:** Track the journey through completion

---

## ⚡ Fast Testing Tips

### Tip 1: One-Time Build, Many Tests

After installing a dev APK, you only need to:
1. Start the dev server
2. Open the app

The APK connects to your latest code automatically!

### Tip 2: Shake to Open Dev Menu

On a physical device, shake the phone to open the React Native dev menu for:
- Reload
- Debug JS Remotely
- Toggle Inspector
- Performance Monitor

### Tip 3: Test Payments Without Rebuilding

The payment code falls back to web checkout if native SDK fails. This means:
- You can test payment flow even in Expo Go
- Changes to payment logic don't require new APK

---

## 🐛 Troubleshooting

### "Could not connect to development server"

**Causes:**
- Device and computer not on same network
- Firewall blocking connection
- Wrong URL entered

**Solutions:**
1. Verify both are on same WiFi
2. Temporarily disable firewall
3. Use the IP address shown in terminal, not `localhost`

### "App crashes on launch"

**Causes:**
- Native modules not built correctly
- Missing dependencies

**Solutions:**
1. Rebuild with `eas build --profile development`
2. Check that `.env` files exist

### "Metro bundler failed"

**Solutions:**
```bash
# Clear cache and restart
npx expo start --clear

# Or nuke node_modules
rm -rf node_modules
npm install
npx expo start --dev-client
```

### "Google Maps not loading"

**Causes:**
- API key not configured in build
- Maps API not enabled in Google Cloud

**Verify in:**
- `apps/customer/app.json` → `android.config.googleMaps.apiKey`
- `apps/driver/app.json` → `android.config.googleMaps.apiKey`

---

## 📍 APK File Locations

After building, APKs are located at:

| Build Type | Location |
|------------|----------|
| EAS Cloud Build | Downloaded from Expo website |
| Local Debug Build | `apps/[app]/android/app/build/outputs/apk/debug/app-debug.apk` |
| Local Release Build | `apps/[app]/android/app/build/outputs/apk/release/app-release.apk` |

---

## 🔐 Test Accounts

### Customer Test Numbers
```
+91 9876500001 → OTP: 123456
+91 9876500002 → OTP: 123456
```

### Driver Test Numbers
```
+91 9876500011 → OTP: 123456
+91 9876500012 → OTP: 123456
+91 9876500013 → OTP: 123456
```

### Admin Test Numbers
```
+91 7744066077 → OTP: 123456
+91 9356505599 → OTP: 123456
```

---

## 📚 Related Documentation

- [Full Developer Setup Guide](./DEVELOPER_SETUP_GUIDE.md) - Complete setup from scratch
- [Quick Reference](./QUICK_REFERENCE.md) - Commands and credentials cheat sheet
- [Payment Testing Workflow](../.agent/workflows/fast-payment-testing.md) - Fast payment iteration

---

**Need more help?** Check the Expo documentation at https://docs.expo.dev/
