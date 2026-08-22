# 🚀 Cart-R — Dev Start Guide

Quick reference for running all parts of the stack locally.

---

## 📦 Prerequisites

Make sure these are installed before starting:

- **Node.js** ≥ 20.19.0
- **npm** (comes with Node)
- **Expo CLI** — `npm install -g expo-cli` _(for mobile apps)_
- **Android Studio / Emulator** _(for running mobile apps on Android)_
- A physical device or emulator connected via ADB _(for driver/customer apps)_

---

## 1. 🖥️ Backend (Express + TypeScript)

> Runs on **http://localhost:3000** (local) / **http://10.236.49.165:3000** (LAN — used by mobile apps)

```bash
cd apps/backend
npm install         # first time only
npm run dev
```

**Environment** — ensure `apps/backend/.env` exists with:

| Variable | Description |
|---|---|
| `PORT` | Server port (default `3000`) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CASHFREE_APP_ID` | Cashfree app ID |
| `CASHFREE_SECRET_KEY` | Cashfree secret key |
| `CASHFREE_ENV` | `sandbox` or `production` |

> `npm run dev` uses **nodemon** + **tsx** — the server auto-restarts on file changes.

---

## 2. 🛡️ Admin App (Next.js)

> Runs on **http://localhost:3001** _(or whichever port Next.js picks)_

```bash
cd apps/admin
npm install         # first time only
npm run dev
```

**Environment** — ensure `apps/admin/.env.local` exists with your Supabase credentials.

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (Webpack mode) |
| `npm run dev:turbopack` | Start dev server (Turbopack — faster) |
| `npm run build` | Build for production |
| `npm start` | Serve production build |

---

## 3. 📱 Customer App (Expo / React Native)

> Runs on Android emulator or physical device via **Expo Dev Client**

```bash
cd apps/customer
npm install         # first time only

# Set your machine's LAN IP so the QR code points to the right address:
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.31.164"; npm start
```

Once running, use these keyboard shortcuts in the terminal:

| Key | Action |
|---|---|
| `a` | Open on Android emulator/device |
| `w` | Open in browser |
| `j` | Open JS debugger |
| `r` | Reload app |
| `m` | Toggle dev menu |
| `o` | Open project in editor |
| `?` | Show all commands |
| `Ctrl+C` | Stop server |

**Environment** — `apps/customer/.env` is pre-configured with:
```
EXPO_PUBLIC_BACKEND_URL=http://10.236.49.165:3000
```
> ⚠️ If your IP changes, update `EXPO_PUBLIC_BACKEND_URL` in `apps/customer/.env`.

| Script | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Run directly on Android emulator/device |
| `npm run web` | Run in browser (limited features) |

---

## 4. 🚗 Driver App (Expo / React Native)

> Runs on Android emulator or physical device via **Expo Dev Client**

```bash
cd apps/driver
npm install         # first time only

# Set your machine's LAN IP so the QR code points to the right address:
$env:REACT_NATIVE_PACKAGER_HOSTNAME="10.236.49.165"; npm start
```

Once running, use these keyboard shortcuts in the terminal:

| Key | Action |
|---|---|
| `a` | Open on Android emulator/device |
| `w` | Open in browser |
| `j` | Open JS debugger |
| `r` | Reload app |
| `m` | Toggle dev menu |
| `o` | Open project in editor |
| `?` | Show all commands |
| `Ctrl+C` | Stop server |

**Environment** — `apps/driver/.env` is pre-configured with:
```
EXPO_PUBLIC_BACKEND_URL=http://10.236.49.165:3000
```
> ⚠️ If your IP changes, update `EXPO_PUBLIC_BACKEND_URL` in `apps/driver/.env`.

| Script | Description |
|---|---|
| `npm start` | Start Expo dev server (with 4 GB memory) |
| `npm run android` | Clear cache + run on Android |
| `npm run build:clear` | Start with cleared Expo cache |
| `npm run web` | Run in browser (limited features) |

> ⚠️ The driver app uses `--max-old-space-size=4096` to avoid OOM crashes during bundling.

---

## 🗂️ Recommended Terminal Layout

Open **4 terminals** side by side:

```
Terminal 1          Terminal 2          Terminal 3          Terminal 4
─────────────       ─────────────       ─────────────       ─────────────
cd apps/backend     cd apps/admin       cd apps/customer    cd apps/driver
npm run dev         npm run dev         npm start           npm start
```

---

## 🔗 App URLs / Ports

| App | URL / Access |
|---|---|
| Backend API (browser) | http://localhost:3000 |
| Backend API (mobile) | http://10.236.49.165:3000 |
| Admin Panel | http://localhost:3001 _(Next.js, may vary)_ |
| Customer App | Expo dev server → Android/iOS |
| Driver App | Expo dev server → Android/iOS |

> 💡 Your dev machine IP is **10.236.49.165** — update `.env` files in both mobile apps if this changes.

---

## 🛠️ Troubleshooting

### Backend won't start
- Check that all env vars in `apps/backend/.env` are filled in
- Run `npm install` inside `apps/backend/`

### Admin page is blank / auth errors
- Verify `apps/admin/.env.local` has the correct Supabase URL and anon key
- Try `npm run dev:turbopack` for faster cold starts

### Phone says "failed to connect to X.X.X.X:8081" or wrong IP in QR code
- Expo is picking up the wrong network adapter (VPN, virtual interface, etc.)
- Stop the Expo server and restart with the IP forced:
  ```powershell
  # Customer
  $env:REACT_NATIVE_PACKAGER_HOSTNAME="10.236.49.165"; npm start
  # Driver
  $env:REACT_NATIVE_PACKAGER_HOSTNAME="10.236.49.165"; npm start
  ```
- If your IP changes, update the value above and in `EXPO_PUBLIC_BACKEND_URL` in both `.env` files

### Expo bundler crashes (OOM)
- The driver app already uses `--max-old-space-size=4096`; close other heavy applications
- Run `npm run build:clear` to start with a clean cache
