# GitHub CI/CD Setup

This repo can build the admin, customer, and driver apps with GitHub Actions.

## Workflows

- `apps-ci.yml`
  - Runs on pull requests, pushes to `main`, and manual dispatch.
  - Builds and validates:
    - `apps/admin`
    - `apps/customer`
    - `apps/driver`
- `mobile-eas-builds.yml`
  - Runs preview Android EAS builds for both mobile apps on pushes to `main`.
  - Also supports manual builds for `customer`, `driver`, or `both`, with `preview` or `production` profiles and `android`, `ios`, or `all` platforms.

## Required GitHub Secrets

Add these in GitHub under `Settings -> Secrets and variables -> Actions`.

- `EXPO_TOKEN`
  - Required for the EAS build workflow.

## Recommended Secrets For Real Deployments

The CI workflow uses placeholder values so lint/build can run without production secrets. For release-quality builds and admin deployment, add your real values as repository or environment secrets:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_DIRECTIONS_API_KEY`
- `EXPO_PUBLIC_OLA_MAPS_API_KEY`
- `EXPO_PUBLIC_CASHFREE_APP_ID`
- `CASHFREE_ENVIRONMENT`
- `EXPO_PUBLIC_GEOAPIFY_API_KEY`
- `EXPO_PUBLIC_SERVER_URL`

## Suggested Release Flow

1. Open a pull request.
2. Let `Apps CI` verify admin, customer, and driver builds.
3. Merge to `main`.
4. Let `Mobile EAS Builds` create preview Android builds automatically.
5. Use `Run workflow` on `Mobile EAS Builds` when you want a manual `production` or `ios` build.

## Next Step For Full CD

If you want full deployment from GitHub as well:

- connect `apps/admin` to Vercel and add a deploy workflow or rely on Vercel's Git integration
- add EAS `submit` steps for App Store / Play Store once store credentials are configured
