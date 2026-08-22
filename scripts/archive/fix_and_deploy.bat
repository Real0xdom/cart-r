@echo off
echo Renaming conflicting migrations...

move supabase\migrations\009_sms_delivery_otp.sql supabase\migrations\0091_sms_delivery_otp.sql
move supabase\migrations\010a_add_tempo_enum.sql supabase\migrations\0101_add_tempo_enum.sql
move supabase\migrations\010b_booking_flow.sql supabase\migrations\0102_booking_flow.sql
move supabase\migrations\011_check_phone_exists.sql supabase\migrations\0111_check_phone_exists.sql

echo Renaming complete. Running deployment...
call deploy_all.bat
