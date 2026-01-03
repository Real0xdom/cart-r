# Cart-R Quick Reference Card

> **Quick commands and credentials for developers**

---

## 🏃 Quick Start Commands

### Customer App
```bash
cd apps/customer
npm install
npx expo start --dev-client
```

### Driver App
```bash
cd apps/driver
npm install
npx expo start --dev-client
```

### Admin Dashboard
```bash
cd apps/admin
npm install
npm run dev
```

---

## 📱 Build APK Commands

```bash
# Development APK (with hot reload)
cd apps/customer  # or apps/driver
eas build --platform android --profile development

# Preview APK (standalone, no dev server needed)
eas build --platform android --profile preview

# Production AAB (for Play Store)
eas build --platform android --profile production
```

---

## 🧪 Test Credentials

### Phone Numbers (Fixed OTP: 123456)
| Phone | OTP |
|-------|-----|
| +91 7744066077 | 123456 |
| +91 9356505599 | 123456 |
| +91 9876500001 | 123456 |
| +91 9876500002 | 123456 |
| +91 9876500011 | 123456 |
| +91 9876500012 | 123456 |

### Cashfree Sandbox Cards
| Card | Number | Expiry | CVV |
|------|--------|--------|-----|
| Visa | 4111111111111111 | Any future | Any 3-digit |
| Mastercard | 5555555555554444 | Any future | Any 3-digit |

---

## 🔧 Supabase Commands

```bash
# Login
supabase login

# Deploy function
supabase functions deploy <function-name>

# View logs
supabase functions logs <function-name> --tail
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Metro not connecting | `npx expo start --clear` |
| Native module error | `npx expo prebuild --clean` |
| Google Maps not showing | Check API key in `app.json` |
| Payment crashes | Use dev build APK, not Expo Go |

---

## 📁 Key File Locations

| File | Path |
|------|------|
| Environment Example | `.env.example` |
| Database Schema | `database schema.txt` |
| Customer App Config | `apps/customer/app.json` |
| Driver App Config | `apps/driver/app.json` |
| EAS Build Config | `apps/*/eas.json` |
| Supabase Functions | `supabase/functions/` |
| Migrations | `supabase/migrations/` |

---

## 🌐 Important URLs

| Service | URL |
|---------|-----|
| Supabase Dashboard | https://supabase.com/dashboard/project/epevjbiymsvwmmzybzib |
| Google Cloud Console | https://console.cloud.google.com/ |
| Cashfree Merchant | https://merchant.cashfree.com/ |
| Expo Dashboard | https://expo.dev/ |

---

## 📞 Tech Stack

| Component | Technology |
|-----------|------------|
| Mobile Apps | React Native 0.74.5 + Expo 51 |
| Admin Dashboard | Next.js 16.1 + React 19 |
| Backend | Supabase (PostgreSQL + Deno) |
| Maps | Google Maps API |
| Payments | Cashfree SDK |
| Styling | NativeWind (Tailwind for RN) |
| State | Zustand |
