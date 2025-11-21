-- Fix daily_stock table to allow nullable auth_user_id and route_id
-- Run this SQL in your Supabase SQL Editor

-- Make auth_user_id and route_id nullable
ALTER TABLE daily_stock 
  ALTER COLUMN auth_user_id DROP NOT NULL,
  ALTER COLUMN route_id DROP NOT NULL;

-- Add a check constraint to ensure at least one is provided
ALTER TABLE daily_stock 
  ADD CONSTRAINT daily_stock_driver_or_route_required 
  CHECK (auth_user_id IS NOT NULL OR route_id IS NOT NULL);

-- Verification
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_stock' 
AND column_name IN ('auth_user_id', 'route_id');
