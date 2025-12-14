# Clear Stock Test Data

Removes only stock-related test data and audit logs. Leaves products, routes, trucks, users, and sales intact.

## Scope
- Deletes `daily_stock` entries (assigned stock logs)
- Resets `warehouse_stock` quantities to zero
- Deletes `warehouse_movements` (IN, ASSIGN, RETURN, ADJUST)
- Optionally clears `assigned_stock` table if present

## SQL (Run in Supabase SQL Editor)
```sql
BEGIN;

-- 1) Clear all assigned stock logs (driver/route/day assignments)
DELETE FROM public.daily_stock;

-- 2) Reset warehouse stock quantities to zero
UPDATE public.warehouse_stock
SET boxes = 0,
    pcs   = 0;

-- 3) Clear warehouse movements/audit trail (IN, ASSIGN, RETURN, ADJUST)
DELETE FROM public.warehouse_movements;

-- 4) Optional: If an 'assigned_stock' table exists (used by realtime), clear it too
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'assigned_stock'
  ) THEN
    EXECUTE 'DELETE FROM public.assigned_stock';
  END IF;
END $$;

COMMIT;
```

## Verify
```sql
-- Should be 0 rows
SELECT COUNT(*) AS daily_stock_rows FROM public.daily_stock;
SELECT COUNT(*) AS warehouse_movement_rows FROM public.warehouse_movements;

-- Should be all zeros
SELECT SUM(boxes) AS total_boxes, SUM(pcs) AS total_pcs FROM public.warehouse_stock;
```

## Notes
- Running from the frontend needs admin RLS privileges; prefer Supabase SQL Editor.
- This does not delete `products`, `routes`, `trucks`, or `shops`; only stock states and logs.
- If you also want to remove sample trucks inserted by setup, add:
  ```sql
  DELETE FROM public.trucks;
  ```