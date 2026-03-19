@echo off
echo Repairing Migration History...

call npx supabase migration repair --status applied 001_initial_schema.sql
call npx supabase migration repair --status applied 002_fix_rls_policies.sql
call npx supabase migration repair --status applied 003_postgis_functions.sql
call npx supabase migration repair --status applied 004_security_rls_policies.sql
call npx supabase migration repair --status applied 005_booking_enhancements.sql
call npx supabase migration repair --status applied 006_notify_drivers_trigger.sql
call npx supabase migration repair --status applied 007_notification_webhook.sql
call npx supabase migration repair --status applied 008_delivery_otp_notification.sql
call npx supabase migration repair --status applied 009_driver_verification_history.sql
call npx supabase migration repair --status applied 009_sms_delivery_otp.sql
call npx supabase migration repair --status applied 010_defer_otp_generation.sql
call npx supabase migration repair --status applied 011_auto_sms_queue_processing.sql
call npx supabase migration repair --status applied 011_check_phone_exists.sql
call npx supabase migration repair --status applied 012_payment_confirmation.sql
call npx supabase migration repair --status applied 013_fix_rls_and_notifications.sql
call npx supabase migration repair --status applied 014_fix_accept_booking_rls.sql
call npx supabase migration repair --status applied 015_increase_booking_number_length.sql
call npx supabase migration repair --status applied 016_fix_booking_number_sequence.sql
call npx supabase migration repair --status applied 20251226_add_wallet.sql

echo History Repaired. Now running deployment again...
call deploy_all.bat
