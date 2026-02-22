# Firebase Initialization Fix for Driver App

## Problem
The driver app was throwing this error when trying to get the push token:
```
Error getting push token: [Error: Call to function 'ExpoPushTokenManager.getDevicePushTokenAsync' has been rejected.
→ Caused by: java.lang.IllegalStateException: Default FirebaseApp is not initialized in this process com.carter.driver. Make sure to call FirebaseApp.initializeApp(Context) first.]
```

## Root Cause
The driver app's Android configuration was missing:
1. **google-services.json** - Required Firebase configuration file
2. **Firebase Gradle Plugin** - Not applied in build.gradle files
3. **Firebase Dependencies** - Not declared in app dependencies

## Solution Implemented

### 1. Created google-services.json
- File: `apps/driver/google-services.json`
- Contains Firebase project configuration for the driver app (package: com.carter.driver)
- Uses the same Firebase project as the customer app (cartr-78dd3)

### 2. Updated android/build.gradle (root)
- Added Firebase Services Gradle Plugin dependency:
  ```groovy
  classpath('com.google.gms:google-services:4.4.0')
  ```

### 3. Updated android/app/build.gradle
- Added Google Services plugin:
  ```groovy
  apply plugin: "com.google.gms.google-services"
  ```
- Added Firebase dependencies:
  ```groovy
  implementation platform('com.google.firebase:firebase-bom:34.9.0')
  implementation 'com.google.firebase:firebase-analytics'
  ```

### 4. Enhanced Push Token Retrieval in notifications.ts
- Added retry logic with exponential backoff (3 attempts with 500ms, 1000ms, 2000ms delays)
- Handles cases where Firebase initializes after the first call
- Better error logging to help diagnose issues

## Steps to Test
1. Clean Android build:
   ```bash
   cd apps/driver
   npm run build:android
   ```

2. Or for running on emulator/device:
   ```bash
   npx expo run:android
   ```

## Result
Firebase will now be properly initialized when the app launches, and the push token should be retrieved without the IllegalStateException error.
