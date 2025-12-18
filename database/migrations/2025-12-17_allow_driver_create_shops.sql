-- Enable insert access for drivers (authenticated users) on shops table
-- This fixes the 403 Forbidden error when a driver tries to bill a new shop

create policy "Enable insert for authenticated users"
on "public"."shops"
for insert
to authenticated
with check (true);

-- Also ensure they can select (read) shops they created or all shops
-- Assuming there is already a select policy, but if not:
-- create policy "Enable read access for all users"
-- on "public"."shops"
-- for select
-- using (true);
