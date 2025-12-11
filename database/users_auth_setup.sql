-- ============================================================================
-- Authentication System - Users Table Migration
-- This script updates the EXISTING users table to support authentication
-- Run this SQL in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Check current users table structure
-- ============================================================================
-- Run this first to see what columns exist:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND table_schema = 'public';

-- ============================================================================
-- 2. Add auth_user_id column if it doesn't exist
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 3. Add missing columns if they don't exist
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================================
-- 4. Add role constraint (will fail if role column has invalid values)
-- ============================================================================
-- First, update any existing rows to have valid roles
UPDATE users SET role = 'driver' WHERE role IS NULL OR role NOT IN ('admin', 'driver');

-- Add constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'driver'));
    END IF;
END $$;

-- Make role NOT NULL after setting defaults
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- ============================================================================
-- 5. Create update_timestamp function (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Create trigger for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS users_timestamp ON users;
CREATE TRIGGER users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 7. Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- 8. Enable RLS (if not already enabled)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. Drop existing policies if they exist
-- ============================================================================
DROP POLICY IF EXISTS "users can read own record" ON users;
DROP POLICY IF EXISTS "admins can read all users" ON users;
DROP POLICY IF EXISTS "admins can insert users" ON users;
DROP POLICY IF EXISTS "admins can update users" ON users;
DROP POLICY IF EXISTS "admins can delete users" ON users;
DROP POLICY IF EXISTS "users can update own profile" ON users;

-- ============================================================================
-- 10. Create RLS policies
-- ============================================================================

-- Allow authenticated users to read their own user record (CRITICAL for AuthContext)
CREATE POLICY "users can read own record"
  ON users FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Allow admins to read all users
CREATE POLICY "admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  ));

-- Allow admins to insert users
CREATE POLICY "admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  ));

-- Allow admins to update users
CREATE POLICY "admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  ));

-- Allow admins to delete users
CREATE POLICY "admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  ));

-- Allow users to update their own profile (name, phone only - not role)
CREATE POLICY "users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid() AND
    role = (SELECT role FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'users';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users' AND schemaname = 'public';

-- View all users
-- SELECT id, auth_user_id, name, role, phone, is_active, created_at FROM users;
