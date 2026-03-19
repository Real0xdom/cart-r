# Cart-R Test Automation (Appium + Playwright + Allure)

This package provides a unified UI test automation setup for:
- Customer APK (Android) via Appium
- Driver APK (Android) via Appium
- Admin Web Console via Playwright

## Project structure

- `configs/` – env loader + shared config
- `mobile-tests/` – Appium/WebdriverIO tests for APKs
- `web-tests/` – Playwright tests for Admin Console
- `reports/` – Allure results + generated HTML report

## Prerequisites

### Local
- Node.js >= 18
- Java 17 (recommended for Android tooling)
- Android SDK + emulator (or a real device)
- Appium 2 (installed via devDependencies in this package)

## Setup

From repo root:

```powershell
cd test-automation
copy .env.example .env.staging
# Fill in values (APK paths, credentials)

npm install
```

## Running tests

### Admin web tests (Playwright)

```powershell
cd test-automation
$env:TARGET_ENV='staging'
# If ADMIN_START_LOCAL=1, Playwright will build+start the Next.js admin app automatically
npm run test:web:admin
npm run allure:generate
```

### Mobile tests (Appium)

Start an emulator/device and Appium:

```powershell
cd test-automation
# In one terminal
npx appium driver install uiautomator2
npx appium --port 4723

# In another terminal
$env:TARGET_ENV='staging'
npm run test:mobile:customer
npm run test:mobile:driver
npm run allure:generate
```

## Allure reports

- Results: `reports/allure-results/`
- HTML report: `reports/allure-report/`

Open report:

```powershell
npm run allure:open
```

## Important notes

- OTP flows: CI-safe OTP automation requires one of:
  - deterministic OTP in staging,
  - SMS inbox/API integration,
  - or test-only auth hooks.
  These sample specs assume OTP is supplied via env vars.

- Selectors: for stable mobile UI tests, add `testID` / accessibility ids to critical UI elements.
  The sample tests use placeholder selectors like `~auth.phoneInput`.\n\n## CI\n\nGitHub Actions workflow: ../.github/workflows/ui-automation.yml\n\nRequired secrets:\n- ADMIN_EMAIL, ADMIN_PASSWORD\n- CUSTOMER_PHONE, CUSTOMER_OTP\n- DRIVER_PHONE, DRIVER_OTP\n\nAPK handling:\n- Update the workflow step **Prepare APKs** to download/build APKs into rtifacts/customer.apk and rtifacts/driver.apk (repo root).\n