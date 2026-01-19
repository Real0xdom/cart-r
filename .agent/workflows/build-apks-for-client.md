---
description: How to build Android APKs for Client Presentation (Admin remains on Vercel)
---

# Deploying for Client Presentation

For the best client experience, we use a hybrid approach:
1.  **Admin Panel**: Deploy to **Vercel** (Web).
2.  **Mobile Apps**: Build **Android APKs** (Native).

> **Why APKs?** The mobile apps use native features like **Cashfree Payments** and **Background Location** that **do not work** on the web. An APK ensures the client sees the full, real functionality.

## 1. Deploy Admin to Vercel
Follow the previous guide to deploy `apps/admin` to Vercel. This gives you a URL like `https://cart-r-admin.vercel.app` to show on a laptop/screen.

## 2. Build Android APKs
We will use **EAS Build** to generate standalone APK files that can be installed on any Android device.

### Prerequisites
- Ensure you are logged in to EAS: `npx eas login`
- Ensure you have a valid Google Maps API Key in `eas.json` (Already configured).

### Step 1: Build Customer App
1.  Open a terminal in the root or `apps/customer`.
2.  Run the build command:
    ```bash
    cd apps/customer
    npx eas build --profile preview --platform android
    ```
    *Note: This may take 10-20 minutes depending on the queue.*
3.  Once finished, EAS will provide a **Download Link** for the `.apk` file.

### Step 2: Build Driver App
1.  Open a terminal in `apps/driver`.
2.  Run the build command:
    ```bash
    cd apps/driver
    npx eas build --profile preview --platform android
    ```
3.  Wait for the **Download Link**.

## 3. Presenting to the Client
1.  **Admin**: Open the Vercel link on your laptop.
2.  **Mobile Apps**:
    - Download the APKs from the EAS links.
    - Upload them to **Google Drive** or **WeTransfer**.
    - Send the link to the client (or install it on a test device beforehand).
    - **Note**: Since these are "Preview" APKs not from the Play Store, the client may need to "Allow installation from unknown sources" on their phone.

## 4. Troubleshooting
- **Build Fails?** Check the logs provided by the EAS link.
- **Maps Blank?** Ensure the Google Maps API Key in `eas.json` is enabled in the Google Cloud Console and has "Android SDK" restrictions set up correctly (or unrestricted for testing).
- **Payment Crash?** Ensure the Cashfree package is correctly linked. The build log will show if native modules failed.
