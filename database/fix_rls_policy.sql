
-- It is not implemented yet








-- Fix RLS Policy for daily_stock to allow drivers to see and claim unassigned stock
-- Run this in your Supabase SQL Editor

-- 1. Allow drivers to VIEW unassigned stock (so they can see it before claiming)
DROP POLICY IF EXISTS "drivers can view their daily stock" ON daily_stock;

CREATE POLICY "drivers can view their daily stock"
  ON daily_stock FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid() 
    OR 
    auth_user_id IS NULL
  );

-- 2. Allow drivers to UPDATE (claim) unassigned stock
-- They need to be able to update rows where auth_user_id is NULL
DROP POLICY IF EXISTS "drivers can claim daily stock" ON daily_stock;

CREATE POLICY "drivers can claim daily stock"
  ON daily_stock FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid() 
    OR 
    auth_user_id IS NULL
  )
  WITH CHECK (
    auth_user_id = auth.uid()
  );
