---
description: How to deploy Admin, Customer, and Driver apps to Vercel
---

# Deploying Cart-R to Vercel

This guide helps you deploy the **Admin panel**, **Customer app**, and **Driver app** to Vercel for remote access and client presentation.

## Prerequisites
- A GitHub repository with your code pushed.
- A Vercel account linked to your GitHub.

## 1. Prepare and Push Code
The configuration files (`package.json`, `app.json`) have been updated to support Vercel deployment.
1.  Open your terminal in the root directory.
2.  Commit the changes:
    ```bash
    git add .
    git commit -m "Configure Vercel deployment"
    git push origin main
    ```

## 2. Deploy Admin Panel (`apps/admin`)
1.  Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** -> **"Project"**.
2.  Import your `cart-r` repository.
3.  **Configure Project:**
    - **Project Name:** `cart-r-admin` (or similar).
    - **Root Directory:** Click "Edit" and select `apps/admin`.
    - **Framework Preset:** Ensure `Next.js` is selected.
    - **Environment Variables:** Copy any variables from your local `.env` or `.env.local` file to Vercel.
4.  Click **Deploy**.

## 3. Deploy Customer App (`apps/customer`)
1.  Go to Dashboard -> **"Add New..."** -> **"Project"** (Import the same repo again).
2.  **Configure Project:**
    - **Project Name:** `cart-r-customer`.
    - **Root Directory:** Click "Edit" and select `apps/customer`.
    - **Framework Preset:** Select **Other**.
    - **Build and Output Settings:**
        - **Build Command:** Toggle VALID override and enter: `npm run build`
        - **Output Directory:** Toggle VALID override and enter: `dist`
    - **Environment Variables:**
        - Add all variables from `apps/customer/.env`.
        - **Important:** Ensure public variables start with `EXPO_PUBLIC_` (e.g. `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`).
3.  Click **Deploy**.

## 4. Deploy Driver App (`apps/driver`)
1.  Go to Dashboard -> **"Add New..."** -> **"Project"** (Import the same repo again).
2.  **Configure Project:**
    - **Project Name:** `cart-r-driver`.
    - **Root Directory:** Click "Edit" and select `apps/driver`.
    - **Framework Preset:** Select **Other**.
    - **Build and Output Settings:**
        - **Build Command:** Toggle VALID override and enter: `npm run build`
        - **Output Directory:** Toggle VALID override and enter: `dist`
    - **Environment Variables:** Copy variables from `apps/driver/.env` to Vercel.
3.  Click **Deploy**.

## 5. Share with Client
Once deployed, Vercel will provide 3 distinct URLs (e.g., `cart-r-admin.vercel.app`, `cart-r-customer.vercel.app`).
- **Admin:** Accessible via Web.
- **Customer:** Accessible via Mobile Browser (PWA) or Desktop.
- **Driver:** Accessible via Mobile Browser (PWA).

**Note:** For the Mobile Apps (Customer/Driver), features like **Maps** and **Location** require:
1.  Valid Google Maps API Key in Environment Variables.
2.  Hosting on **HTTPS** (Vercel does this automatically).
