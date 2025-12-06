-- Migration: Allow NULL auth_user_id for sales inserts
-- Purpose: Driver Portal can insert sales without requiring authenticated user
-- Date: 2025-12-06

BEGIN;

ALTER TABLE public.sales
  ALTER COLUMN auth_user_id DROP NOT NULL;

COMMIT;

-- Verification (run after applying migration):
-- SELECT column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'auth_user_id';
