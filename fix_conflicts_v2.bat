@echo off
echo Renaming conflicting migrations to unique IDs...

move supabase\migrations\009_driver_verification_history.sql supabase\migrations\0092_driver_verification_history.sql
move supabase\migrations\010_defer_otp_generation.sql supabase\migrations\0103_defer_otp_generation.sql
move supabase\migrations\011_auto_sms_queue_processing.sql supabase\migrations\0112_auto_sms_queue_processing.sql

echo Renaming complete.
call repair_v5_final.bat
