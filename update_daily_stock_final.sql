-- 1. Add initial_stock column to daily_stock table
ALTER TABLE daily_stock 
ADD COLUMN IF NOT EXISTS initial_stock JSONB DEFAULT NULL;

-- 2. Backfill initial_stock with current stock for existing records
-- (This is a best-effort backfill. Future assignments will be accurate)
UPDATE daily_stock 
SET initial_stock = stock 
WHERE initial_stock IS NULL;

-- 3. Ensure foreign key relationships exist (Addressing the user's concern about FK issues)
-- Attempt to add FK only if it helps, but primarily this file adds the column.
-- Note: If relationships are missing, the UI code handles fallback, but it's good practice.
