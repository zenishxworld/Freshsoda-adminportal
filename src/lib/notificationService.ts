import { supabase } from '@/integrations/supabase/client';

export type NotificationType = 'info' | 'warning' | 'success' | 'error';
export type NotificationCategory = 
  | 'stock' 
  | 'sales' 
  | 'assignment' 
  | 'return' 
  | 'warehouse' 
  | 'driver' 
  | 'product' 
  | 'route'
  | 'system';

interface CreateNotificationParams {
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  userId?: string | null;
}

/**
 * Create a notification in the database
 */
export const createNotification = async (params: CreateNotificationParams): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        title: params.title,
        message: params.message,
        type: params.type,
        category: params.category,
        user_id: params.userId || null,
        unread: true,
      }]);

    if (error) {
      console.error('Error creating notification:', error);
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

/**
 * Low Stock Alert - triggers when warehouse stock is below threshold
 */
export const checkLowStockAndNotify = async (): Promise<void> => {
  try {
    const { data: products, error } = await supabase
      .from('warehouse_stock')
      .select('*, products(name, pcs_per_box)');

    if (error || !products) return;

    for (const stock of products) {
      const totalPcs = (stock.boxes * (stock.products?.pcs_per_box || 1)) + stock.pcs;
      const lowStockThreshold = 50; // Define your threshold

      if (totalPcs < lowStockThreshold) {
        await createNotification({
          title: '⚠️ Low Stock Alert',
          message: `${stock.products?.name || 'Product'} is running low. Current stock: ${stock.boxes} BOX | ${stock.pcs} PCS`,
          type: 'warning',
          category: 'stock',
        });
      }
    }
  } catch (error) {
    console.error('Error checking low stock:', error);
  }
};

/**
 * Stock Assignment Notification - triggers when stock is assigned to a driver
 */
export const notifyStockAssignment = async (
  driverName: string,
  routeName: string,
  productName: string,
  boxes: number,
  pcs: number
): Promise<void> => {
  await createNotification({
    title: '📦 Stock Assigned',
    message: `${boxes} BOX | ${pcs} PCS of ${productName} assigned to ${driverName} for ${routeName}`,
    type: 'info',
    category: 'assignment',
  });
};

/**
 * High Return Alert - triggers when returns exceed a threshold
 */
export const checkHighReturnsAndNotify = async (
  driverName: string,
  routeName: string,
  returnedBoxes: number,
  returnedPcs: number,
  productName: string
): Promise<void> => {
  const highReturnThreshold = 20; // boxes
  
  if (returnedBoxes >= highReturnThreshold) {
    await createNotification({
      title: '🔄 High Return Alert',
      message: `${driverName} on ${routeName} returned ${returnedBoxes} BOX | ${returnedPcs} PCS of ${productName}`,
      type: 'warning',
      category: 'return',
    });
  }
};

/**
 * Daily Sales Milestone - triggers when daily sales exceed a target
 */
export const checkSalesMilestoneAndNotify = async (): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: dailySales, error } = await supabase
      .from('driver_sales')
      .select('amount')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (error || !dailySales) return;

    const totalSales = dailySales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
    const salesTarget = 50000; // Define your daily target

    if (totalSales >= salesTarget) {
      await createNotification({
        title: '🎉 Sales Milestone Achieved!',
        message: `Daily sales target reached! Total sales: ₹${totalSales.toFixed(2)}`,
        type: 'success',
        category: 'sales',
      });
    }
  } catch (error) {
    console.error('Error checking sales milestone:', error);
  }
};

/**
 * Driver Route Assignment - triggers when a driver is assigned to a route
 */
export const notifyDriverRouteAssignment = async (
  driverName: string,
  routeName: string,
  date: string
): Promise<void> => {
  await createNotification({
    title: '🚚 Route Assigned',
    message: `${driverName} has been assigned to ${routeName} for ${date}`,
    type: 'info',
    category: 'driver',
  });
};

/**
 * Stock Return Notification - triggers when stock is returned to warehouse
 */
export const notifyStockReturn = async (
  driverName: string,
  productName: string,
  boxes: number,
  pcs: number
): Promise<void> => {
  await createNotification({
    title: '↩️ Stock Returned',
    message: `${driverName} returned ${boxes} BOX | ${pcs} PCS of ${productName} to warehouse`,
    type: 'info',
    category: 'return',
  });
};

/**
 * Warehouse Stock In - triggers when new stock arrives at warehouse
 */
export const notifyWarehouseStockIn = async (
  productName: string,
  boxes: number,
  pcs: number
): Promise<void> => {
  await createNotification({
    title: '📥 Stock Received',
    message: `${boxes} BOX | ${pcs} PCS of ${productName} added to warehouse`,
    type: 'success',
    category: 'warehouse',
  });
};

/**
 * New Product Added
 */
export const notifyNewProduct = async (
  productName: string,
  price: number
): Promise<void> => {
  await createNotification({
    title: '✨ New Product Added',
    message: `${productName} added to inventory at ₹${price.toFixed(2)} per unit`,
    type: 'success',
    category: 'product',
  });
};

/**
 * Product Out of Stock
 */
export const notifyProductOutOfStock = async (
  productName: string
): Promise<void> => {
  await createNotification({
    title: '🚫 Product Out of Stock',
    message: `${productName} is currently out of stock. Please restock immediately.`,
    type: 'error',
    category: 'stock',
  });
};

/**
 * New Sales Entry - triggers when a new sale is recorded
 */
export const notifySaleCompleted = async (
  driverName: string,
  shopName: string,
  amount: number
): Promise<void> => {
  await createNotification({
    title: '💰 Sale Completed',
    message: `${driverName} completed a sale of ₹${amount.toFixed(2)} at ${shopName}`,
    type: 'success',
    category: 'sales',
  });
};

/**
 * Discount Applied Alert - triggers when high discounts are given
 */
export const notifyHighDiscount = async (
  productName: string,
  discount: number,
  shopName: string
): Promise<void> => {
  const highDiscountThreshold = 100; // rupees
  
  if (discount >= highDiscountThreshold) {
    await createNotification({
      title: '💸 High Discount Applied',
      message: `Discount of ₹${discount.toFixed(2)} applied on ${productName} at ${shopName}`,
      type: 'warning',
      category: 'sales',
    });
  }
};

/**
 * Daily Stock Check - scheduled task to check overall stock levels
 */
export const performDailyStockCheck = async (): Promise<void> => {
  try {
    const { data: warehouseStock, error } = await supabase
      .from('warehouse_stock')
      .select('*, products(name, pcs_per_box)');

    if (error || !warehouseStock) return;

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const stock of warehouseStock) {
      const totalPcs = (stock.boxes * (stock.products?.pcs_per_box || 1)) + stock.pcs;
      
      if (totalPcs === 0) {
        outOfStockCount++;
        await notifyProductOutOfStock(stock.products?.name || 'Unknown Product');
      } else if (totalPcs < 50) {
        lowStockCount++;
      }
    }

    if (lowStockCount > 0 || outOfStockCount > 0) {
      await createNotification({
        title: '📊 Daily Stock Report',
        message: `${outOfStockCount} product(s) out of stock, ${lowStockCount} product(s) running low`,
        type: outOfStockCount > 0 ? 'error' : 'warning',
        category: 'stock',
      });
    }
  } catch (error) {
    console.error('Error performing daily stock check:', error);
  }
};

/**
 * Route Completion Notification
 */
export const notifyRouteCompletion = async (
  driverName: string,
  routeName: string,
  totalSales: number,
  shopsVisited: number
): Promise<void> => {
  await createNotification({
    title: '✅ Route Completed',
    message: `${driverName} completed ${routeName}. Visited ${shopsVisited} shops, Total sales: ₹${totalSales.toFixed(2)}`,
    type: 'success',
    category: 'route',
  });
};

/**
 * Initialize periodic checks (call this on app startup)
 */
export const initializeNotificationChecks = (): void => {
  // Check low stock every hour
  setInterval(() => {
    checkLowStockAndNotify();
  }, 60 * 60 * 1000); // 1 hour

  // Check sales milestone every 30 minutes
  setInterval(() => {
    checkSalesMilestoneAndNotify();
  }, 30 * 60 * 1000); // 30 minutes

  // Perform daily stock check at midnight (adjust timing as needed)
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // tomorrow
    0, 0, 0 // midnight
  );
  const msToMidnight = night.getTime() - now.getTime();

  setTimeout(() => {
    performDailyStockCheck();
    // Then repeat every 24 hours
    setInterval(() => {
      performDailyStockCheck();
    }, 24 * 60 * 60 * 1000);
  }, msToMidnight);

  // Initial checks
  checkLowStockAndNotify();
  checkSalesMilestoneAndNotify();
};
