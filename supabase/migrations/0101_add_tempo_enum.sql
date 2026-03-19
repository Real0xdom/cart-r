-- Migration: 010a_add_tempo_enum.sql
-- Purpose: Add 'tempo' to vehicle_type enum (must be separate transaction)
-- NOTE: This must run and commit before 010b can use the new enum value

-- Add 'tempo' to vehicle_type enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tempo' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vehicle_type')) THEN
        ALTER TYPE vehicle_type ADD VALUE 'tempo';
    END IF;
END$$;
