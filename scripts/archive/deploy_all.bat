@echo off
echo ==========================================
echo      Cart-R Full System Deployment
echo ==========================================
echo.

echo 1. Pushing Database Changes (Migrations)...
call npx supabase db push --include-all
if %errorlevel% neq 0 (
    echo Database push failed!
    exit /b %errorlevel%
)

echo.
echo 2. Deploying Edge Functions...
echo    - assign-driver
echo    - calculate-fare
echo    - cancel-payment-order
echo    - cashfree-checkout
echo    - checkout-page
echo    - create-payment-order
echo    - payment-webhook
echo    - process-notifications
echo    - send-notification
echo    - send-sms
echo    - verify-payment

call npx supabase functions deploy assign-driver calculate-fare cancel-payment-order cashfree-checkout checkout-page create-payment-order payment-webhook process-notifications send-notification send-sms verify-payment --no-verify-jwt
if %errorlevel% neq 0 (
    echo Function deployment failed!
    exit /b %errorlevel%
)

echo.
echo ==========================================
echo      ALL DEPLOYMENTS SUCCESSFUL! 🚀
echo ==========================================
echo.
