-- Migration: Add shop_id to sales table
-- Purpose: Link sales to shops table for better data integrity
-- Date: 2025-12-16

BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON public.sales(shop_id);

COMMIT;
