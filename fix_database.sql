-- 1. Fix Missing Columns (Safe to run multiple times)
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id),
ADD COLUMN IF NOT EXISTS village TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Fix Row Level Security (RLS) Policies

-- Ensure RLS is enabled
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- We will drop policies by name explicitly to clean up.
-- If these fail, it means they don't exist, which is fine.
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON shops;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON shops;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON shops;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON shops;

-- Create policies with standard names. 
-- If you get "already exists", it means you have a policy with this EXACT name.
-- In that case, we can try to create with a _v2 suffix to be sure.

-- READ (SELECT) - This is the critical one for the Sync feature
CREATE POLICY "Enable read access for authenticated users_v2"
ON shops FOR SELECT
TO authenticated
USING (true);

-- INSERT
-- If an insert policy already exists, this might fail, but that's okay as long as one exists.
-- We use a new name to ensure we add OUR permissive policy.
CREATE POLICY "Enable insert for authenticated users_v2"
ON shops FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE
CREATE POLICY "Enable update for authenticated users_v2"
ON shops FOR UPDATE
TO authenticated
USING (true);
