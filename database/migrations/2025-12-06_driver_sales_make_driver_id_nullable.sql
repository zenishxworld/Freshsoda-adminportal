BEGIN;

ALTER TABLE public.driver_sales
  ALTER COLUMN driver_id DROP NOT NULL;

ALTER TABLE public.driver_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_insert_from_rpc" ON public.driver_sales;
CREATE POLICY "allow_insert_from_rpc"
  ON public.driver_sales
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

COMMIT;
