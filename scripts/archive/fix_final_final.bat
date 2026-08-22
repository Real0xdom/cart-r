@echo off
echo Final Synchronization Repair...

echo 1. Removing old orphaned versions from history...
call npx supabase migration repair --status reverted 009
call npx supabase migration repair --status reverted 010
call npx supabase migration repair --status reverted 011

echo 2. Marking renamed versions as applied (to skip execution)...
call npx supabase migration repair --status applied 0092
call npx supabase migration repair --status applied 0103
call npx supabase migration repair --status applied 0112

echo 3. Deploying...
call deploy_all.bat
