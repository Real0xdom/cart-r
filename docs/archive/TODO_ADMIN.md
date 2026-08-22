# Fix Vercel Admin - @supabase/ssr Version Mismatch
**Approved: Pin to 0.5.1 + regen lockfile**

✅ 1. Edit apps/admin/package.json (`"@supabase/ssr": "^0.5.1"` → `"0.5.1"`)
- [ ] 2. cd apps/admin && del package-lock.json && npm install
- [ ] 3. cd apps/admin && npm run build (verify)
- [ ] 4. git add apps/admin/package.json apps/admin/package-lock.json
- [ ] 5. git commit -m "fix(vercel-admin): pin @supabase/ssr to 0.5.1 exact"
- [ ] 6. git push
- [ ] 7. Vercel redeploy automatic

**Status:** Pinning version in package.json

