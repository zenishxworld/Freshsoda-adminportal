# Freshsoda Admin Portal – User & Role Setup

This guide explains how to create a new user in Supabase Auth, link them to the `public.users` table, and assign the correct role (`admin` or `driver`) so the app routes and permissions work.

## Prerequisites
- Supabase project created and configured
- Environment variables set in `.env.local`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## 1) Run the Database Migration
Run the migration to ensure the `users` table supports authentication and roles.

- Open Supabase Dashboard → SQL Editor
- Paste and run `database/users_auth_setup.sql`

This will:
- Ensure columns like `auth_user_id`, `role`, `is_active` exist
- Enforce `role IN ('admin','driver')`
- Enable RLS policies for secure access
- Create useful indexes

## 2) Create the Auth User
Create the user in Supabase Auth (this stores email/password).

- Supabase Dashboard → Authentication → Users → Add User
- Enter `email`, `password`, and check “Auto Confirm”
- Copy the `ID` (this is the `auth_user_id` you’ll link)

Optional SQL to look up the ID later:
```sql
SELECT id FROM auth.users WHERE email = 'user@example.com';
```

## 3) Link to `public.users` and Assign Role
Insert or update a row in `public.users` using the copied `auth_user_id` and set the role.

If `users.password_hash` exists, you have two options:

### Option A (Recommended): Make `password_hash` nullable
```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Insert (if row does not exist)
INSERT INTO users (auth_user_id, name, role, phone, is_active)
VALUES ('<PASTE_AUTH_USER_ID>', 'Admin User', 'admin', '+91-0000000000', true);

-- Or update (if row already exists)
UPDATE users
SET role = 'admin', is_active = true, name = COALESCE(name, 'Admin User')
WHERE auth_user_id = '<PASTE_AUTH_USER_ID>';
```

### Option B: Keep `password_hash` NOT NULL (use placeholder)
```sql
-- Insert
INSERT INTO users (auth_user_id, name, role, phone, is_active, password_hash)
VALUES ('<PASTE_AUTH_USER_ID>', 'Admin User', 'admin', '+91-0000000000', true, 'managed_by_supabase_auth');

-- Or update
UPDATE users
SET role = 'admin', is_active = true, name = COALESCE(name, 'Admin User'),
    password_hash = COALESCE(password_hash, 'managed_by_supabase_auth')
WHERE auth_user_id = '<PASTE_AUTH_USER_ID>';
```

## 4) Verify the Mapping
Confirm the `public.users` row is linked to the Auth user and has the correct role.

```sql
SELECT 
  u.id, u.auth_user_id, u.name, u.role, u.is_active, au.email
FROM users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id
WHERE au.email = 'user@example.com';
```

You should see `role = 'admin'` and `is_active = true`.

## 5) Test Login & Routing
- Open the app and go to `/login`
- Log in with the new user credentials
- The app fetches the role from `public.users` and:
  - Admins are redirected to `/admin`
  - Drivers are redirected to `/driver/dashboard`

## 6) Change Role Later
Update the role at any time:
```sql
UPDATE users SET role = 'admin'  WHERE auth_user_id = '<AUTH_USER_ID>';
UPDATE users SET role = 'driver' WHERE auth_user_id = '<AUTH_USER_ID>';
```

## 7) Deactivate / Reactivate Users
Control access with `is_active`:
```sql
UPDATE users SET is_active = false WHERE auth_user_id = '<AUTH_USER_ID>';
UPDATE users SET is_active = true  WHERE auth_user_id = '<AUTH_USER_ID>';
```

## Troubleshooting
- “Failed to fetch user role”
  - Verify RLS policies and that the `users` row exists:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'users';
  SELECT * FROM users;
  ```
- “User not found in database”
  - Ensure you inserted a `users` row with the correct `auth_user_id`
- Infinite redirect loop
  - Clear browser storage:
  ```js
  localStorage.clear();
  sessionStorage.clear();
  location.reload();
  ```
- “Your account has been deactivated”
  - Set `is_active = true` for that user.

## Notes
- Source of truth for role is `public.users.role`. The app caches role in Auth metadata for faster loads, but always relies on `public.users`.
- RLS policies allow only admins to insert/update/delete users. Use the Supabase Dashboard for creating Auth users unless you add a secure backend with the service role key.