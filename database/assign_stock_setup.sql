-- Assign Stock Feature - Database Setup
-- Run this SQL in your Supabase SQL Editor

-- ============================================================================
-- 1. Create trucks table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  license_plate text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- 2. Add role and is_active columns to users table (if not exists)
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'driver';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- ============================================================================
-- 3. Create daily_stock table
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES trucks(id) ON DELETE SET NULL,
  date date NOT NULL,
  stock jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_stock_unique UNIQUE(auth_user_id, route_id, truck_id, date)
);

-- ============================================================================
-- 4. Create update_timestamp function (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Create triggers for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trucks_timestamp ON trucks;
CREATE TRIGGER trucks_timestamp
BEFORE UPDATE ON trucks
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS daily_stock_timestamp ON daily_stock;
CREATE TRIGGER daily_stock_timestamp
BEFORE UPDATE ON daily_stock
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 6. Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_trucks_is_active ON trucks(is_active);
CREATE INDEX IF NOT EXISTS idx_daily_stock_driver ON daily_stock(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stock_route ON daily_stock(route_id);
CREATE INDEX IF NOT EXISTS idx_daily_stock_date ON daily_stock(date);
CREATE INDEX IF NOT EXISTS idx_daily_stock_truck ON daily_stock(truck_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- 7. Enable RLS
-- ============================================================================
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stock ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. Drop existing policies if they exist
-- ============================================================================
DROP POLICY IF EXISTS "admins can read trucks" ON trucks;
DROP POLICY IF EXISTS "admins can insert trucks" ON trucks;
DROP POLICY IF EXISTS "admins can update trucks" ON trucks;
DROP POLICY IF EXISTS "admins can delete trucks" ON trucks;

DROP POLICY IF EXISTS "admins can read daily stock" ON daily_stock;
DROP POLICY IF EXISTS "admins can insert daily stock" ON daily_stock;
DROP POLICY IF EXISTS "admins can update daily stock" ON daily_stock;
DROP POLICY IF EXISTS "admins can delete daily stock" ON daily_stock;
DROP POLICY IF EXISTS "drivers can view their daily stock" ON daily_stock;

-- ============================================================================
-- 9. Create RLS policies for trucks
-- ============================================================================
CREATE POLICY "admins can read trucks"
  ON trucks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can insert trucks"
  ON trucks FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can update trucks"
  ON trucks FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can delete trucks"
  ON trucks FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- ============================================================================
-- 10. Create RLS policies for daily_stock
-- ============================================================================
CREATE POLICY "admins can read daily stock"
  ON daily_stock FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can insert daily stock"
  ON daily_stock FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can update daily stock"
  ON daily_stock FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "admins can delete daily stock"
  ON daily_stock FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "drivers can view their daily stock"
  ON daily_stock FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- ============================================================================
-- 11. Insert sample trucks (optional)
-- ============================================================================
INSERT INTO trucks (name, license_plate, is_active) VALUES
  ('Truck 1', 'MH-01-AB-1234', true),
  ('Truck 2', 'MH-01-CD-5678', true),
  ('Truck 3', 'MH-01-EF-9012', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification queries
-- ============================================================================
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('trucks', 'daily_stock');

-- Check trucks
-- SELECT * FROM trucks;

-- Check RLS policies
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename IN ('trucks', 'daily_stock');

-- Check daily_stock structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'daily_stock';
