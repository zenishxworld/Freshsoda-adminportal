-- Warehouse Stock Management Database Setup
-- Run this SQL in your Supabase SQL Editor

-- 1. Create warehouse_stock table
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  boxes integer NOT NULL DEFAULT 0,
  pcs integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(product_id)
);

-- 2. Create update_timestamp function (if not exists)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger for warehouse_stock
DROP TRIGGER IF EXISTS warehouse_stock_timestamp ON warehouse_stock;
CREATE TRIGGER warehouse_stock_timestamp
BEFORE UPDATE ON warehouse_stock
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 4. Enable RLS
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist
DROP POLICY IF EXISTS "admins can read warehouse stock" ON warehouse_stock;
DROP POLICY IF EXISTS "admins can update warehouse stock" ON warehouse_stock;
DROP POLICY IF EXISTS "admins can insert warehouse stock" ON warehouse_stock;
DROP POLICY IF EXISTS "admins can delete warehouse stock" ON warehouse_stock;
DROP POLICY IF EXISTS "anon can read warehouse stock" ON warehouse_stock;
DROP POLICY IF EXISTS "anon can update warehouse stock" ON warehouse_stock;
DROP POLICY IF EXISTS "anon can insert warehouse stock" ON warehouse_stock;

-- 6. Create RLS policies for admin access
CREATE POLICY "admins can read warehouse stock"
  ON warehouse_stock FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can update warehouse stock"
  ON warehouse_stock FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can insert warehouse stock"
  ON warehouse_stock FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can delete warehouse stock"
  ON warehouse_stock FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "anon can read warehouse stock"
  ON warehouse_stock FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can update warehouse stock"
  ON warehouse_stock FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can insert warehouse stock"
  ON warehouse_stock FOR INSERT
  TO anon
  WITH CHECK (true);

-- 7. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product_id ON warehouse_stock(product_id);

-- 8. Insert initial warehouse stock for existing products (optional)
-- This will create a warehouse_stock entry for each product with 0 stock
INSERT INTO warehouse_stock (product_id, boxes, pcs)
SELECT id, 0, 0 FROM products
ON CONFLICT (product_id) DO NOTHING;

-- 9. Create warehouse_movements table for audit trail
CREATE TABLE IF NOT EXISTS warehouse_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL
    CHECK (movement_type IN ('IN', 'ASSIGN', 'RETURN', 'ADJUST')),
  boxes integer NOT NULL DEFAULT 0,
  pcs integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone DEFAULT now()
);

-- 10. Enable RLS for warehouse_movements
ALTER TABLE warehouse_movements ENABLE ROW LEVEL SECURITY;

-- 11. Drop existing policies if they exist
DROP POLICY IF EXISTS "admins can read warehouse movements" ON warehouse_movements;
DROP POLICY IF EXISTS "admins can insert warehouse movements" ON warehouse_movements;
DROP POLICY IF EXISTS "anon can read warehouse movements" ON warehouse_movements;
DROP POLICY IF EXISTS "anon can insert warehouse movements" ON warehouse_movements;

-- 12. Create RLS policies for warehouse_movements
CREATE POLICY "admins can read warehouse movements"
  ON warehouse_movements FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can insert warehouse movements"
  ON warehouse_movements FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "anon can read warehouse movements"
  ON warehouse_movements FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert warehouse movements"
  ON warehouse_movements FOR INSERT
  TO anon
  WITH CHECK (true);

-- 13. Create indexes for warehouse_movements
CREATE INDEX IF NOT EXISTS idx_warehouse_movements_product_id 
  ON warehouse_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_movements_created_at 
  ON warehouse_movements(created_at DESC);

-- Verification queries
-- SELECT * FROM warehouse_stock;
-- SELECT p.name, ws.boxes, ws.pcs FROM warehouse_stock ws JOIN products p ON ws.product_id = p.id;
-- SELECT * FROM warehouse_movements ORDER BY created_at DESC LIMIT 10;
