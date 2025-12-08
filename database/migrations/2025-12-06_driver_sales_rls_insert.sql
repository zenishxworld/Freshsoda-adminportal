-- Migration: RLS policy to allow inserts into driver_sales from RPC
-- Date: 2025-12-06

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.driver_sales ENABLE ROW LEVEL SECURITY;

-- Drop legacy/conflicting policies if present
DROP POLICY IF EXISTS "allow_insert_from_rpc" ON public.driver_sales;
DROP POLICY IF EXISTS "admins can insert driver sales" ON public.driver_sales;
DROP POLICY IF EXISTS "authenticated can insert driver sales" ON public.driver_sales;
DROP POLICY IF EXISTS "anon can insert driver sales" ON public.driver_sales;

-- Allow inserts from both authenticated users and anon (for RPC execution)
CREATE POLICY "allow_insert_from_rpc"
  ON public.driver_sales
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

COMMIT;

-- Verification:
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'driver_sales';
