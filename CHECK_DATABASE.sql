-- Check current driver beneficiary status
SELECT 
  id,
  beneficiary_id,
  beneficiary_status,
  bank_details,
  created_at,
  updated_at
FROM drivers
WHERE id = '4ef55e99-a375-4e99-aa11-363f66112e43' -- Replace with actual driver ID
OR beneficiary_id LIKE 'CARTR_DRV_%'
ORDER BY updated_at DESC;

-- Reset beneficiary status to force re-creation
-- Run this to clear the status and try again
UPDATE drivers
SET 
  beneficiary_status = 'not_created',
  beneficiary_id = NULL
WHERE beneficiary_id = 'CARTR_DRV_4ef55e99';
