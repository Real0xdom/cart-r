@echo off
echo Repairing Migration History (Using correct version IDs)...

call npx supabase migration repair --status applied 001
call npx supabase migration repair --status applied 002
call npx supabase migration repair --status applied 003
call npx supabase migration repair --status applied 004
call npx supabase migration repair --status applied 005
call npx supabase migration repair --status applied 006
call npx supabase migration repair --status applied 007
call npx supabase migration repair --status applied 008
call npx supabase migration repair --status applied 009
call npx supabase migration repair --status applied 010
call npx supabase migration repair --status applied 011
call npx supabase migration repair --status applied 012
call npx supabase migration repair --status applied 013
call npx supabase migration repair --status applied 014
call npx supabase migration repair --status applied 015
call npx supabase migration repair --status applied 016
call npx supabase migration repair --status applied 20251226

echo History Repaired. Now running deployment...
call deploy_all.bat
