@echo off
echo Final Repair (Marking new local versions as applied to skip)...

call npx supabase migration repair --status applied 0092
call npx supabase migration repair --status applied 0103
call npx supabase migration repair --status applied 0112

echo Repair complete. Running Deployment...
call deploy_all.bat
