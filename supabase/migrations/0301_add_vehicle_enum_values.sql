-- Migration: 030a_add_vehicle_enum_values.sql
-- Description: Add new enum values to vehicle_type
-- MUST BE RUN SEPARATELY before 030b
-- Date: 2026-02-13

-- IMPORTANT: This migration MUST be committed before running 030b
-- PostgreSQL requires enum values to be committed before they can be used

-- Add three_wheeler
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'three_wheeler' 
    AND enumtypid = 'vehicle_type'::regtype
  ) THEN
    ALTER TYPE vehicle_type ADD VALUE 'three_wheeler';
    RAISE NOTICE 'Added enum value: three_wheeler';
  ELSE
    RAISE NOTICE 'Enum value three_wheeler already exists';
  END IF;
END $$;

-- Add chota_hathi
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'chota_hathi' 
    AND enumtypid = 'vehicle_type'::regtype
  ) THEN
    ALTER TYPE vehicle_type ADD VALUE 'chota_hathi';
    RAISE NOTICE 'Added enum value: chota_hathi';
  ELSE
    RAISE NOTICE 'Enum value chota_hathi already exists';
  END IF;
END $$;

-- Add pickup
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pickup' 
    AND enumtypid = 'vehicle_type'::regtype
  ) THEN
    ALTER TYPE vehicle_type ADD VALUE 'pickup';
    RAISE NOTICE 'Added enum value: pickup';
  ELSE
    RAISE NOTICE 'Enum value pickup already exists';
  END IF;
END $$;

-- Verify all enum values exist
DO $$
DECLARE
  enum_values TEXT;
BEGIN
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
  INTO enum_values
  FROM pg_enum
  WHERE enumtypid = 'vehicle_type'::regtype;
  
  RAISE NOTICE 'Current vehicle_type enum values: %', enum_values;
END $$;
