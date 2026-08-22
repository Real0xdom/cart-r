# Vercel Admin Build Fix Plan

## Root Cause
Vercel runs `npm install` in root (carter-project workspace) → hoists `@supabase/ssr` from root deps. Next.js 16.1.1 Turbopack type resolution fails in `./lib/supabase/client.ts` despite `transpilePackages: ["@supabase/ssr"]`.

**Local**: `cd apps/admin && npm install` works (isolated node_modules).
**Vercel**: Hoisted root deps + npm/pnpm/yarn workspace mismatch.

## Plan
1. **Update apps/admin/package.json**: `"@supabase/ssr": "^0.5.1"` → `"@supabase/ssr": "0.5.1"` (exact match root)
2. **Regen lockfile**: `cd apps/admin && del package-lock.json && npm install`
3. **Commit/push**: Vercel rebuilds with matching deps.

## Files
- `apps/admin/package.json`
- `apps/admin/package-lock.json` (regen)

## Follow-up
`cd apps/admin && npm run build` (local verify)
`git add apps/admin/ && git commit -m "fix(vercel): pin @supabase/ssr to match root" && git push`

Approve to proceed?

