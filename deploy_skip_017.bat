@echo off
echo Skipping 017 (Manual Deploy Required) and Pushing 018...

call npx supabase migration repair --status applied 017
call npx supabase db push

echo Deploying Edge Functions...
call npx supabase functions deploy assign-driver calculate-fare cancel-payment-order cashfree-checkout checkout-page create-payment-order payment-webhook process-notifications send-notification send-sms verify-payment --no-verify-jwt
