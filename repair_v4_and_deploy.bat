@echo off
echo Force-Repairing History (Skipping all conflicting versions)...

call npx supabase migration repair --status applied 009
call npx supabase migration repair --status applied 0091
call npx supabase migration repair --status applied 010
call npx supabase migration repair --status applied 0101
call npx supabase migration repair --status applied 0102
call npx supabase migration repair --status applied 011
call npx supabase migration repair --status applied 0111

echo Migration History Forced. Running deployment of 017/018 and Functions...
call deploy_all.bat
