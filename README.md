<p align="center">
  <img src="assets/images/logo.png" alt="CARTR Logo" width="120" height="120" />
</p>

<h1 align="center">🚗 CARTR</h1>

<p align="center">
  <strong>A Modern Ride-Hailing & Goods Delivery Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.74.5-blue?style=for-the-badge&logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-51.0-black?style=for-the-badge&logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
</p>

---

## 📖 Overview

**CARTR** is a full-stack ride-hailing and goods delivery application built with modern technologies. It features a customer-facing mobile app, a driver mobile app, and an admin web dashboard—all powered by a robust Supabase backend.

### ✨ Key Features

- 🚕 **Ride Booking** - Book rides with real-time fare calculation and vehicle selection
- 📦 **Goods Delivery** - Send packages with receiver details and delivery confirmation
- 💳 **Cashfree Payments** - Secure online payments with wallet top-up functionality
- 🗺️ **Live Tracking** - Real-time driver location tracking with Google Maps integration
- 📱 **Push Notifications** - Stay updated with ride status and alerts
- 👨‍💼 **Admin Dashboard** - Manage users, drivers, bookings, and view analytics
- ⭐ **Ratings & Reviews** - Two-way rating system for quality assurance
- 🆘 **Emergency Features** - SOS alerts and emergency contact management

---

## 🏗️ Project Structure

```
CARTR/
├── apps/
│   ├── customer/          # React Native customer mobile app (Expo)
│   ├── driver/            # React Native driver mobile app (Expo)
│   └── admin/             # Next.js admin web dashboard
├── supabase/
│   └── functions/         # Supabase Edge Functions
│       ├── assign-driver/
│       ├── calculate-fare/
│       ├── create-payment-order/
│       ├── verify-payment/
│       ├── payment-webhook/
│       ├── send-notification/
│       └── ...
├── packages/              # Shared packages (if any)
├── docs/                  # Documentation
└── assets/                # Shared assets
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React Native** | Cross-platform mobile development |
| **Expo SDK 51** | Development toolchain & native modules |
| **NativeWind** | Tailwind CSS for React Native |
| **React Navigation** | Navigation library |
| **Zustand** | State management |
| **React Native Maps** | Google Maps integration |

### Backend
| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service (Auth, Database, Edge Functions) |
| **PostgreSQL** | Primary database |
| **Deno** | Edge Functions runtime |
| **Cashfree SDK** | Payment gateway integration |

### Admin Dashboard
| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework for web |
| **Tailwind CSS 4** | Utility-first CSS |
| **Supabase Client** | Database & auth integration |

---

## 📱 Apps

### 🧑‍💼 Customer App
The customer-facing mobile app allows users to:
- Sign up/login with phone OTP authentication
- Book rides or schedule deliveries
- Select vehicle type with dynamic fare estimation
- Pay via wallet or Cashfree payment gateway
- Track driver location in real-time
- Rate drivers after ride completion
- Manage wallet balance and view transaction history

### 🚗 Driver App
The driver mobile app enables drivers to:
- Register and complete verification
- Go online/offline to receive ride requests
- Accept or reject incoming bookings
- Navigate to pickup and drop-off locations
- Collect payments (cash or confirmed online)
- Track earnings and completed trips
- Manage profile and vehicle information

### 🖥️ Admin Dashboard
The web-based admin panel provides:
- Overview dashboard with key metrics
- User management (customers & drivers)
- Driver verification and approval workflow
- Booking management and history
- Fare configuration settings
- Support ticket management
- Real-time analytics and reports

---

## 🗄️ Database Schema

The application uses a comprehensive PostgreSQL schema including:

| Table | Description |
|-------|-------------|
| `users` | Customer and admin profiles |
| `drivers` | Driver profiles with vehicle info |
| `bookings` | Ride and delivery bookings |
| `driver_locations` | Real-time driver GPS tracking |
| `wallet_transactions` | Payment and wallet history |
| `fare_config` | Dynamic fare configuration |
| `ratings` | Customer and driver ratings |
| `notifications` | Push notification records |
| `support_tickets` | Customer support tickets |
| `emergency_alerts` | SOS and emergency alerts |

---

## 📚 Documentation

For detailed setup instructions and guides, see:

| Document | Description |
|----------|-------------|
| [Developer Setup Guide](docs/DEVELOPER_SETUP_GUIDE.md) | Complete setup from scratch |
| [APK Testing Guide](docs/APK_TESTING_GUIDE.md) | How to test development APKs |
| [Quick Reference](docs/QUICK_REFERENCE.md) | Commands and credentials cheat sheet |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Expo CLI** (`npm install -g expo-cli`)
- **Supabase CLI** (for local development)
- **Android Studio** / **Xcode** (for native builds)

### Environment Variables

Create `.env` files in each app directory based on `.env.example`:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Cashfree
EXPO_PUBLIC_CASHFREE_APP_ID=your_cashfree_app_id
EXPO_PUBLIC_CASHFREE_ENV=SANDBOX  # or PRODUCTION
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Real0xdom/cart-r.git
   cd cart-r
   ```

2. **Install dependencies for each app**
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
   ```

3. **Start the development servers**
   ```bash
   # Customer App (Expo)
   cd apps/customer
   npx expo start --dev-client
   
   # Driver App (Expo)
   cd apps/driver
   npx expo start --dev-client
   
   # Admin Dashboard (Next.js)
   cd apps/admin
   npm run dev
   ```

### Building for Production

#### Mobile Apps (using EAS Build)
```bash
cd apps/customer  # or apps/driver
eas build --profile production --platform android
eas build --profile production --platform ios
```

#### Admin Dashboard
```bash
cd apps/admin
npm run build
npm run start
```

---

## 📡 Supabase Edge Functions

| Function | Description |
|----------|-------------|
| `assign-driver` | Assign available driver to a booking |
| `calculate-fare` | Calculate fare based on distance and vehicle type |
| `create-payment-order` | Create Cashfree payment order |
| `verify-payment` | Verify payment status with Cashfree |
| `payment-webhook` | Handle Cashfree payment webhooks |
| `send-notification` | Send push notifications via Expo |
| `process-notifications` | Process queued notifications |

Deploy edge functions:
```bash
supabase functions deploy <function-name>
```

---

## 🔒 Security

- **Row Level Security (RLS)** enabled on all tables
- **JWT-based authentication** via Supabase Auth
- **Phone OTP verification** for user authentication
- **Secure payment handling** through Cashfree SDK
- **Admin authentication** with credentials and session management

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

## 👤 Author

**Real0xdom**

---

<p align="center">
  Made with ❤️ using React Native, Expo, Next.js & Supabase
</p>
