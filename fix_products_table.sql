-- Fix for products table to ensure box_price and pcs_price columns exist
BEGIN;

-- Drop and recreate the columns to ensure they're properly recognized
ALTER TABLE public.products DROP COLUMN IF EXISTS box_price;
ALTER TABLE public.products DROP COLUMN IF EXISTS pcs_price;

-- Add the columns back with explicit types
ALTER TABLE public.products ADD COLUMN box_price DECIMAL(10,2);
ALTER TABLE public.products ADD COLUMN pcs_price DECIMAL(10,2);

-- Update all products to have box_price equal to price if it's null
UPDATE public.products 
SET box_price = price 
WHERE box_price IS NULL;

-- Update all products to have pcs_price calculated from box_price if it's null
UPDATE public.products 
SET pcs_price = box_price / 24 
WHERE pcs_price IS NULL;

-- Verify the columns exist and have proper data
SELECT id, name, price, box_price, pcs_price FROM public.products LIMIT 10;

COMMIT;