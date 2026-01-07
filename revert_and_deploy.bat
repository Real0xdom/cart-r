@echo off
echo Reverting status for renamed migrations...

call npx supabase migration repair --status reverted 009
call npx supabase migration repair --status reverted 011
call npx supabase migration repair --status reverted 010

echo Status reverted. Running deployment...
call deploy_all.bat
