-- Fix RLS policy for daily_stock to allow drivers to see route-level assignments
-- Run this SQL in your Supabase SQL Editor

-- Drop the restrictive policy
DROP POLICY IF EXISTS "drivers can view their daily stock" ON daily_stock;

-- Create new inclusive policy
-- Allows drivers to see:
-- 1. Stock assigned specifically to them (auth_user_id = auth.uid())
-- 2. Stock assigned to a route generally (auth_user_id IS NULL)
CREATE POLICY "drivers can view their daily stock"
  ON daily_stock FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid() 
    OR 
    auth_user_id IS NULL
  );
