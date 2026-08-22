@echo off
echo ==========================================
echo      Cart-R Automatic Deployment
echo ==========================================
echo.
echo 1. Logging into Supabase (A browser window will open)...
call npx supabase login
if %errorlevel% neq 0 (
    echo Login failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Pushing Database Changes...
call npx supabase db push
if %errorlevel% neq 0 (
    echo Database push failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 3. Deploying Edge Function (Push Notification Logic)...
call npx supabase functions deploy send-sms --no-verify-jwt
if %errorlevel% neq 0 (
    echo Function deploy failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ==========================================
echo      DEPLOYMENT SUCCESSFUL! 🚀
echo ==========================================
echo.
pause
