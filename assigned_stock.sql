BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.assigned_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid,
  route_id uuid NOT NULL,
  date date NOT NULL,
  product_id uuid NOT NULL,
  qty_assigned integer NOT NULL,
  qty_remaining integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assigned_stock_unique ON public.assigned_stock (driver_id, route_id, date, product_id);

CREATE TABLE IF NOT EXISTS public.driver_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  route_id uuid NOT NULL,
  date date NOT NULL,
  product_id uuid NOT NULL,
  qty_sold integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.warehouse_stock ADD COLUMN IF NOT EXISTS current_qty integer;

UPDATE public.warehouse_stock ws
SET current_qty = COALESCE(ws.current_qty, 0)
FROM public.products p
WHERE ws.product_id = p.id
  AND ws.current_qty IS NULL
  AND p.pcs_per_box IS NOT NULL
  AND p.pcs_per_box > 0
  AND ws.boxes IS NOT NULL
  AND ws.pcs IS NOT NULL
  AND (ws.boxes <> 0 OR ws.pcs <> 0)
  AND ws.current_qty IS NULL;

CREATE OR REPLACE FUNCTION public.fn_assign_stock(p_driver_id uuid, p_route_id uuid, p_work_date date, items jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  it jsonb;
  pid uuid;
  box_qty int;
  pcs_qty int;
  pcs_per_box int;
  assign_pcs int;
  existing integer;
BEGIN
  FOR it IN SELECT jsonb_array_elements(items) LOOP
    pid := (it->>'productId')::uuid;
    box_qty := COALESCE((it->>'boxQty')::int, 0);
    pcs_qty := COALESCE((it->>'pcsQty')::int, 0);
    SELECT COALESCE(p.pcs_per_box, 24) INTO pcs_per_box FROM public.products p WHERE p.id = pid;
    assign_pcs := box_qty * pcs_per_box + pcs_qty;
    IF assign_pcs <= 0 THEN CONTINUE; END IF;

    IF EXISTS (SELECT 1 FROM public.warehouse_stock w WHERE w.product_id = pid) THEN
      UPDATE public.warehouse_stock w
      SET boxes = GREATEST(0, (w.boxes * 1)),
          pcs = GREATEST(0, (w.pcs * 1)),
          current_qty = GREATEST(0, COALESCE(w.current_qty, w.boxes * pcs_per_box + w.pcs) - assign_pcs)
      WHERE w.product_id = pid;
    END IF;

    SELECT qty_assigned INTO existing FROM public.assigned_stock a
      WHERE a.driver_id IS NOT DISTINCT FROM p_driver_id AND a.route_id = p_route_id AND a.date = p_work_date AND a.product_id = pid;

    IF existing IS NULL THEN
      INSERT INTO public.assigned_stock(driver_id, route_id, date, product_id, qty_assigned, qty_remaining)
      VALUES (p_driver_id, p_route_id, p_work_date, pid, assign_pcs, assign_pcs)
      ON CONFLICT (driver_id, route_id, date, product_id)
      DO UPDATE SET qty_assigned = EXCLUDED.qty_assigned, qty_remaining = EXCLUDED.qty_remaining, updated_at = now();
    ELSE
      UPDATE public.assigned_stock a
      SET qty_assigned = assign_pcs,
          qty_remaining = assign_pcs,
          updated_at = now()
      WHERE a.driver_id IS NOT DISTINCT FROM p_driver_id AND a.route_id = p_route_id AND a.date = p_work_date AND a.product_id = pid;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_driver_assigned_stock(driver_id uuid, route_id uuid, work_date date)
RETURNS TABLE(product_id uuid, product_name text, qty_assigned int, qty_remaining int)
LANGUAGE sql
AS $$
  SELECT a.product_id,
         p.name AS product_name,
         a.qty_assigned,
         a.qty_remaining
  FROM public.assigned_stock a
  JOIN public.products p ON p.id = a.product_id
  WHERE a.driver_id = $1 AND a.route_id = $2 AND a.date = $3
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_route_assigned_stock(route_id uuid, work_date date)
RETURNS TABLE(product_id uuid, product_name text, qty_assigned int, qty_remaining int)
LANGUAGE sql
AS $$
  SELECT a.product_id,
         p.name AS product_name,
         a.qty_assigned,
         a.qty_remaining
  FROM public.assigned_stock a
  JOIN public.products p ON p.id = a.product_id
  WHERE a.driver_id IS NULL AND a.route_id = $1 AND a.date = $2
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.fn_update_stock_after_sale(p_driver_id uuid, p_route_id uuid, p_work_date date, sale_items jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  it jsonb;
  pid uuid;
  qty_sold int;
  remaining int;
BEGIN
  FOR it IN SELECT jsonb_array_elements(sale_items) LOOP
    pid := (it->>'productId')::uuid;
    qty_sold := COALESCE((it->>'qty_pcs')::int, 0);
    IF qty_sold <= 0 THEN CONTINUE; END IF;

    SELECT qty_remaining INTO remaining FROM public.assigned_stock a
      WHERE a.driver_id IS NOT DISTINCT FROM p_driver_id AND a.route_id = p_route_id AND a.date = p_work_date AND a.product_id = pid
      FOR UPDATE;

    IF remaining IS NULL THEN
      RAISE EXCEPTION 'Assigned stock not found for product %', pid;
    END IF;
    IF qty_sold > remaining THEN
      RAISE EXCEPTION 'Sale qty exceeds remaining for product %', pid;
    END IF;

    UPDATE public.assigned_stock a
      SET qty_remaining = remaining - qty_sold,
          updated_at = now()
      WHERE a.driver_id IS NOT DISTINCT FROM p_driver_id AND a.route_id = p_route_id AND a.date = p_work_date AND a.product_id = pid;

    INSERT INTO public.driver_sales(driver_id, route_id, date, product_id, qty_sold)
      VALUES (p_driver_id, p_route_id, p_work_date, pid, qty_sold);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_end_route_return_stock(p_driver_id uuid, p_route_id uuid, p_work_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  pcs_per_box int;
BEGIN
  FOR rec IN
    SELECT a.product_id, a.qty_remaining AS qty
    FROM public.assigned_stock a
    WHERE a.driver_id IS NOT DISTINCT FROM p_driver_id AND a.route_id = p_route_id AND a.date = p_work_date AND a.qty_remaining > 0
  LOOP
    IF EXISTS (SELECT 1 FROM public.warehouse_stock w WHERE w.product_id = rec.product_id) THEN
      SELECT COALESCE(p.pcs_per_box, 24) INTO pcs_per_box FROM public.products p WHERE p.id = rec.product_id;
      UPDATE public.warehouse_stock w
      SET current_qty = COALESCE(w.current_qty, w.boxes * pcs_per_box + w.pcs) + rec.qty,
          updated_at = now()
      WHERE w.product_id = rec.product_id;
    END IF;
  END LOOP;

  UPDATE public.assigned_stock a
    SET qty_remaining = 0,
        updated_at = now()
    WHERE a.driver_id IS NOT DISTINCT FROM p_driver_id AND a.route_id = p_route_id AND a.date = p_work_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_update_stock_after_sale_route(p_route_id uuid, p_work_date date, sale_items jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  it jsonb;
  pid uuid;
  qty_sold int;
  remaining int;
BEGIN
  FOR it IN SELECT jsonb_array_elements(sale_items) LOOP
    pid := (it->>'productId')::uuid;
    qty_sold := COALESCE((it->>'qty_pcs')::int, 0);
    IF qty_sold <= 0 THEN CONTINUE; END IF;

    SELECT qty_remaining INTO remaining FROM public.assigned_stock a
      WHERE a.driver_id IS NULL AND a.route_id = p_route_id AND a.date = p_work_date AND a.product_id = pid
      FOR UPDATE;

    IF remaining IS NULL THEN
      RAISE EXCEPTION 'Assigned stock not found for product %', pid;
    END IF;
    IF qty_sold > remaining THEN
      RAISE EXCEPTION 'Sale qty exceeds remaining for product %', pid;
    END IF;

    UPDATE public.assigned_stock a
      SET qty_remaining = remaining - qty_sold,
          updated_at = now()
      WHERE a.driver_id IS NULL AND a.route_id = p_route_id AND a.date = p_work_date AND a.product_id = pid;

    INSERT INTO public.driver_sales(driver_id, route_id, date, product_id, qty_sold)
      VALUES (NULL, p_route_id, p_work_date, pid, qty_sold);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_end_route_return_stock_route(p_route_id uuid, p_work_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  pcs_per_box int;
BEGIN
  FOR rec IN
    SELECT a.product_id, a.qty_remaining AS qty
    FROM public.assigned_stock a
    WHERE a.driver_id IS NULL AND a.route_id = p_route_id AND a.date = p_work_date AND a.qty_remaining > 0
  LOOP
    IF EXISTS (SELECT 1 FROM public.warehouse_stock w WHERE w.product_id = rec.product_id) THEN
      SELECT COALESCE(p.pcs_per_box, 24) INTO pcs_per_box FROM public.products p WHERE p.id = rec.product_id;
      UPDATE public.warehouse_stock w
      SET current_qty = COALESCE(w.current_qty, w.boxes * pcs_per_box + w.pcs) + rec.qty,
          updated_at = now()
      WHERE w.product_id = rec.product_id;
    END IF;
  END LOOP;

  UPDATE public.assigned_stock a
    SET qty_remaining = 0,
        updated_at = now()
    WHERE a.driver_id IS NULL AND a.route_id = p_route_id AND a.date = p_work_date;
END;
$$;

COMMIT;
