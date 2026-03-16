# Vercel Admin Build Fix - @supabase/ssr Types Missing

**Approved Plan Implementation**

## Status: 
- Package.json already pinned to \"@supabase/ssr\": \"0.5.1\" ✓
- TODO created ✓

## Remaining Steps:
- [ ] 1. Regen lockfile: `cd apps/admin &amp;&amp; del package-lock.json &amp;&amp; npm install`
- [ ] 2. Local test build: `cd apps/admin &amp;&amp; npm run build`
- [ ] 3. Git commit/push: `git add apps/admin/ &amp;&amp; git commit -m \"fix(vercel-admin): regen lockfile for @supabase/ssr 0.5.1\" &amp;&amp; git push origin main`

**Root Cause Reminder:** npm workspace hoisting + Vercel npm install version mismatch despite transpilePackages.

**Expected:** Fresh lockfile ensures Vercel installs exact 0.5.1 types.

