# Authentication System Setup Instructions

## Step 1: Run Database Migration SQL

> [!IMPORTANT]
> This migration script updates your **existing** users table to add authentication support.

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `database/users_auth_setup.sql`
4. Copy the entire SQL content
5. Paste it into the Supabase SQL Editor
6. Click **Run** to execute the SQL

This will:
- Add `auth_user_id` column to existing users table
- Add missing columns (name, role, phone, is_active, timestamps)
- Set up RLS policies
- Create indexes for performance
- Enable row-level security

## Step 2: Create Sample Users in Supabase Auth

### Create Admin User

1. Go to **Authentication** > **Users** in Supabase Dashboard
2. Click **Add User** > **Create new user**
3. Enter:
   - **Email**: `admin@freshsoda.com`
   - **Password**: `admin123`
   - **Auto Confirm User**: ✅ (check this box)
4. Click **Create user**
5. **Copy the user ID** from the users list (you'll need this)

### Create Driver User

1. Click **Add User** > **Create new user** again
2. Enter:
   - **Email**: `driver@freshsoda.com`
   - **Password**: `driver123`
   - **Auto Confirm User**: ✅ (check this box)
3. Click **Create user**
4. **Copy the user ID** from the users list (you'll need this)

## Step 3: Insert Users into Public Users Table

1. Go back to **SQL Editor**
2. Run the following SQL (replace the IDs with the actual IDs from step 2):

```sql
-- Insert admin user
INSERT INTO users (auth_user_id, name, role, phone, is_active) VALUES
  ('PASTE_ADMIN_USER_ID_HERE', 'Admin User', 'admin', '+91-1234567890', true);

-- Insert driver user
INSERT INTO users (auth_user_id, name, role, phone, is_active) VALUES
  ('PASTE_DRIVER_USER_ID_HERE', 'Driver User', 'driver', '+91-9876543210', true);
```

3. Click **Run**

## Step 4: Verify Setup

Run this query in SQL Editor to verify:

```sql
SELECT 
  u.id,
  u.auth_user_id,
  u.name,
  u.role,
  u.is_active,
  au.email
FROM users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id;
```

You should see both users with their emails.

## Step 5: Test Authentication

1. **Start the development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Test Admin Login**:
   - Navigate to `http://localhost:5173/login`
   - Login with `admin@freshsoda.com` / `admin123`
   - Should redirect to `/admin` (Admin Dashboard)
   - Verify you can access admin pages
   - Try accessing `/driver/shop-billing` - should redirect back to `/admin`

3. **Test Driver Login**:
   - Logout
   - Login with `driver@freshsoda.com` / `driver123`
   - Should redirect to `/driver/dashboard`
   - Verify you can access driver pages
   - Try accessing `/admin/warehouse` - should redirect back to `/driver/dashboard`

4. **Test Unauthenticated Access**:
   - Logout
   - Try accessing `/admin` directly - should redirect to `/login`
   - Try accessing `/driver/dashboard` directly - should redirect to `/login`

## Troubleshooting

### Issue: "Failed to fetch user role"

**Solution**: Check RLS policies are enabled and users table has correct data.

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Check users table
SELECT * FROM users;
```

### Issue: "User not found in database"

**Solution**: Make sure you inserted the user into the `users` table with the correct `auth_user_id`.

### Issue: Infinite redirect loop

**Solution**: Clear browser cache and localStorage:
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Issue: "Your account has been deactivated"

**Solution**: Set `is_active = true` for the user:

```sql
UPDATE users SET is_active = true WHERE auth_user_id = 'USER_ID_HERE';
```

## Next Steps

After successful setup and testing:

1. ✅ Authentication is fully functional
2. ✅ Role-based access control is working
3. ✅ Protected routes are enforced
4. ✅ Loading states prevent page flashing

You can now:
- Create additional admin/driver users as needed
- Customize the login page design
- Add password reset functionality
- Implement user management page for admins
