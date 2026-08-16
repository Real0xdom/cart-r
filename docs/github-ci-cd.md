# GitHub CI/CD Setup

This repo includes a GitHub Actions workflow for building the customer mobile app with EAS preview builds.

## Workflows

- `customer-preview-build.yml`
  - Runs a preview Android EAS build for `apps/customer` on pull requests to `main` and pushes to `main` when customer-app files change.
  - Supports manual runs for `preview` or `production` profiles on `android`, `ios`, or `all` platforms.

## Required GitHub Secrets

Add these in GitHub under `Settings -> Secrets and variables -> Actions`.

- `EXPO_TOKEN`
  - Required so GitHub Actions can authenticate with Expo and trigger EAS builds.

## Recommended Secrets For Customer Builds

For working customer preview or production builds, add the app config values used by `apps/customer` as repository or environment secrets:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_DIRECTIONS_API_KEY`
- `EXPO_PUBLIC_OLA_MAPS_API_KEY`
- `EXPO_PUBLIC_CASHFREE_APP_ID`
- `CASHFREE_ENVIRONMENT`

The workflow also expects a repository-root `google-services.json` and copies it into `apps/customer` before triggering the build.

## Suggested Release Flow

1. Open a pull request.
2. Let `Customer Preview Build` trigger a preview Android build for `apps/customer`.
3. Merge to `main`.
4. Let `Customer Preview Build` trigger another preview Android build from `main`.
5. Use `Run workflow` on `Customer Preview Build` when you want a manual `production` or `ios` build.

## Next Step For Broader CI/CD

If you also want full repo CI/CD from GitHub:

- add a separate validation workflow for `apps/admin`, `apps/customer`, and `apps/driver`
- connect `apps/admin` to Vercel and add a deploy workflow or rely on Vercel's Git integration
- add EAS `submit` steps for App Store / Play Store once store credentials are configured
