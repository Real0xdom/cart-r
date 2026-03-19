-- SQL to sync phone numbers from auth.users to public.users
-- Run this in Supabase SQL Editor

-- First, let's see which users have NULL phone
SELECT u.id, u.name, u.email, u.phone, au.phone as auth_phone
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.phone IS NULL AND au.phone IS NOT NULL;

-- Now sync the phone numbers
UPDATE public.users u
SET phone = au.phone
FROM auth.users au
WHERE u.id = au.id
AND u.phone IS NULL
AND au.phone IS NOT NULL;

-- Verify the sync worked
SELECT id, name, email, phone FROM public.users WHERE phone IS NOT NULL;
