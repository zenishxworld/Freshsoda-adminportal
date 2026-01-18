# Notification System Documentation

## Overview
The notification system is fully integrated and automatically generates notifications based on business events **without requiring any manual SQL queries or database changes**. The system monitors various activities and creates relevant notifications in real-time.

## How It Works

### 1. **Automatic Monitoring**
The notification service runs in the background and automatically:
- Checks warehouse stock levels every hour
- Monitors daily sales milestones every 30 minutes  
- Performs comprehensive stock checks daily at midnight
- Responds to user actions in real-time

### 2. **Notification Types**
All notifications are categorized by:
- **Type**: `info`, `warning`, `success`, `error`
- **Category**: `stock`, `sales`, `assignment`, `return`, `warehouse`, `driver`, `product`, `route`, `system`

## When Notifications Are Triggered

### ⚠️ **Low Stock Alerts** (Warning)
**Condition:** When warehouse stock falls below 50 pieces (boxes × pcs_per_box + pcs)
**Frequency:** Checked every hour
**Example:** "Coca Cola 500ml is running low. Current stock: 3 BOX | 12 PCS"

### 🚫 **Out of Stock Alerts** (Error)
**Condition:** When warehouse stock reaches zero
**Frequency:** Daily at midnight (comprehensive check)
**Example:** "Pepsi 2L is currently out of stock. Please restock immediately."

### 📦 **Stock Assignment Notifications** (Info)
**Condition:** When stock is assigned to a driver/route
**Trigger:** Immediately when admin assigns stock via Assign Stock page
**Example:** "5 BOX | 20 PCS of Sprite assigned to Route Assignment for Route 1"

### 🔄 **High Return Alerts** (Warning)
**Condition:** When returns exceed 20 boxes
**Trigger:** When returns are processed
**Example:** "Driver John on Route 1 returned 25 BOX | 10 PCS of Fanta"

### 💰 **Sale Completed** (Success)
**Condition:** When a sale is recorded
**Trigger:** After driver completes a shop billing
**Example:** "Driver John completed a sale of ₹2,450.00 at ABC Store"

### 💸 **High Discount Alert** (Warning)
**Condition:** When discount exceeds ₹100
**Trigger:** During sale with discount
**Example:** "Discount of ₹150.00 applied on Coca Cola at XYZ Shop"

### 🎉 **Sales Milestone** (Success)
**Condition:** When daily sales exceed ₹50,000
**Frequency:** Checked every 30 minutes
**Example:** "Daily sales target reached! Total sales: ₹52,345.50"

### 🚚 **Route Assignment** (Info)
**Condition:** When driver is assigned to a route
**Trigger:** During route assignment
**Example:** "Driver John has been assigned to Route 1 for 2026-01-18"

### ✅ **Route Completion** (Success)
**Condition:** When driver completes their route
**Trigger:** After route is ended
**Example:** "Driver John completed Route 1. Visited 15 shops, Total sales: ₹12,450.00"

### 📥 **Warehouse Stock In** (Success)
**Condition:** When new stock arrives at warehouse
**Trigger:** When warehouse stock is increased
**Example:** "50 BOX | 0 PCS of Coca Cola added to warehouse"

### ↩️ **Stock Return** (Info)
**Condition:** When stock is returned to warehouse
**Trigger:** After returns are processed
**Example:** "Driver John returned 5 BOX | 12 PCS of Sprite to warehouse"

### ✨ **New Product Added** (Success)
**Condition:** When a new product is created
**Trigger:** After product creation
**Example:** "Mountain Dew 1.5L added to inventory at ₹45.00 per unit"

### 📊 **Daily Stock Report** (Warning/Error)
**Condition:** Summary of low/out-of-stock products
**Frequency:** Daily at midnight
**Example:** "2 product(s) out of stock, 5 product(s) running low"

## Configuration

### Thresholds (Customizable)
You can modify these in [notificationService.ts](src/lib/notificationService.ts):

```typescript
// Low stock threshold
const lowStockThreshold = 50; // pieces

// High return threshold  
const highReturnThreshold = 20; // boxes

// Daily sales target
const salesTarget = 50000; // rupees

// High discount threshold
const highDiscountThreshold = 100; // rupees
```

### Check Intervals
Automatic monitoring intervals:
- **Stock checks**: Every 1 hour
- **Sales milestone checks**: Every 30 minutes
- **Daily comprehensive check**: Once per day at midnight

## Accessing Notifications

### 1. **Header Bell Icon**
- Shows unread notification count (red dot)
- Click to see latest 5 notifications
- Click "View all notifications" to go to full page

### 2. **Notifications Page** (`/admin/notifications`)
- View all notifications
- Filter by: All / Unread
- Mark individual notifications as read
- Mark all as read
- Delete individual notifications
- Auto-refreshes every 2 minutes

## Technical Implementation

### Files Modified/Created:

1. **[src/lib/notificationService.ts](src/lib/notificationService.ts)** - Core notification service
2. **[src/components/layout/Header.tsx](src/components/layout/Header.tsx)** - Real-time notifications in header
3. **[src/pages/tailadmin/NotificationsPage.tsx](src/pages/tailadmin/NotificationsPage.tsx)** - Full notifications page
4. **[src/pages/tailadmin/AssignStockPage.tsx](src/pages/tailadmin/AssignStockPage.tsx)** - Stock assignment integration
5. **[src/App.tsx](src/App.tsx)** - Initialize monitoring on app startup

### Database Table
The notifications use the existing `notifications` table defined in [supabase_notifications.sql](supabase_notifications.sql):

```sql
- id (bigint, primary key)
- created_at (timestamp)
- title (text)
- message (text)
- type (text: 'info', 'warning', 'success', 'error')
- category (text)
- unread (boolean)
- user_id (uuid, nullable)
```

## Extending the System

### Adding New Notification Types

To add a new notification trigger:

1. **Create a notification function** in `notificationService.ts`:
```typescript
export const notifyCustomEvent = async (
  param1: string,
  param2: number
): Promise<void> => {
  await createNotification({
    title: '🎯 Custom Event',
    message: `Event details: ${param1} - ${param2}`,
    type: 'info',
    category: 'custom',
  });
};
```

2. **Call it from your component**:
```typescript
import { notifyCustomEvent } from '@/lib/notificationService';

// In your function
await notifyCustomEvent('value1', 123);
```

### Adding Realtime Updates

To make notifications update in real-time without page refresh:

```typescript
// In your component
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    }, (payload) => {
      // Handle new notification
      console.log('New notification:', payload);
      loadNotifications(); // Refresh list
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## User Permissions

Current RLS policies allow:
- ✅ All users can read notifications
- ✅ All users can update notifications (mark as read)
- ✅ All users can insert notifications
- ✅ All users can delete notifications

You can restrict this by modifying the policies in [supabase_notifications.sql](supabase_notifications.sql).

## Troubleshooting

### Notifications Not Showing?
1. Check browser console for errors
2. Verify the `notifications` table exists in Supabase
3. Check RLS policies are enabled and correct
4. Verify notification service is initialized in App.tsx

### Automatic Checks Not Running?
1. Ensure `initializeNotificationChecks()` is called in App.tsx
2. Keep browser tab active (intervals may pause in background tabs)
3. Check browser console for any initialization errors

### Performance Concerns?
- Notification checks are optimized to run at reasonable intervals
- Only latest 5 notifications load in header dropdown
- Full page has pagination support
- Consider adding database indexes on `created_at` and `unread` columns for large datasets

## Best Practices

1. **Don't overuse notifications** - Only notify for important events
2. **Use appropriate types** - Match severity to notification type
3. **Keep messages concise** - Users should understand at a glance
4. **Use emojis sparingly** - Only in titles for quick visual identification
5. **Test thresholds** - Adjust based on actual business needs
6. **Monitor performance** - Check notification table size periodically

## Future Enhancements

Potential improvements:
- 📧 Email notifications for critical alerts
- 🔔 Push notifications via service workers
- 👥 User-specific notifications (using user_id field)
- 📱 SMS notifications for high-priority events
- 🎨 Notification preferences per user
- 📈 Notification analytics dashboard
- 🔕 Notification snooze/mute functionality
- 🔄 Batch notification actions

## Summary

✅ **Fully automated** - No manual intervention needed
✅ **Real-time monitoring** - Continuous background checks
✅ **Event-driven** - Responds to user actions immediately  
✅ **Zero database setup** - Uses existing table structure
✅ **Easily extensible** - Add new notification types easily
✅ **User-friendly** - Clean UI with filtering and actions
