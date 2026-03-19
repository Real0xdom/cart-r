@echo off
echo Re-Repairing History (Marking duplicates as applied to skip them)...

call npx supabase migration repair --status applied 009
call npx supabase migration repair --status applied 010
call npx supabase migration repair --status applied 011

echo History patched. Running deployment...
call deploy_all.bat
