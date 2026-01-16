import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// Type definitions matching the database schema
export type Product = {
    id: string;
    name: string;
    price: number;
    pcs_price?: number | null;
    box_price?: number | null;
    pcs_per_box?: number | null;
    description?: string | null;
    status?: string | null;
    updated_at?: string;
    created_at?: string;
};

export type Route = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type StockItem = {
    productId: string;
    unit: 'box' | 'pcs';
    quantity: number
};

export type DailyStock = {
    id?: string;
    route_id: string;
    date: string; // YYYY-MM-DD
    stock: StockItem[];
    created_at?: string;
};

export type Sale = {
    id: string;
    route_id: string;
    date: string; // YYYY-MM-DD
    shop_name?: string;
    items?: any[];
    products_sold: any;
    total_amount?: number;
    created_at?: string;
    invoice_no?: string;
};

export type WarehouseStock = {
    boxes: number;
    id: string;
    product_id: string;
    product_name: string;
    box_price: number;
    pcs_price: number;
    pcs_per_box: number;
    pcs: number;
    created_at?: string;
    updated_at?: string;
};

export type Notification = {
    id: number;
    created_at: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    category: string;
    unread: boolean;
    user_id?: string | null;
};

export const getNotifications = async (): Promise<Notification[]> => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notifications:', error);
        throw new Error('Failed to fetch notifications');
    }
    return data || [];
};

export const markNotificationAsRead = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .update({ unread: false })
        .eq('id', id);

    if (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .update({ unread: false })
        .eq('unread', true);

    if (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};

export const deleteNotification = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
};

export type WarehouseMovement = {
    id: string;
    product_id: string;
    movement_type: 'IN' | 'ASSIGN' | 'RETURN' | 'ADJUST';
    boxes: number;
    pcs: number;
    note?: string | null;
    created_at: string;
};

// User Profile
export interface UserProfile {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    role?: string | null;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, email, role')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        console.error('Error fetching user profile:', error);
        throw new Error('Failed to load profile');
    }
    if (!data) return null;
    return {
        id: data.id,
        name: data.name || null,
        phone: data.phone || null,
        email: data.email || null,
        role: data.role || null,
    };
};

export const updateUserProfile = async (userId: string, payload: { name?: string | null; phone?: string | null }): Promise<UserProfile> => {
    const { data, error } = await supabase
        .from('users')
        .update({ name: payload.name ?? null, phone: payload.phone ?? null })
        .eq('id', userId)
        .select('id, name, phone, email, role')
        .maybeSingle();
    if (error) {
        console.error('Error updating user profile:', error);
        throw new Error('Failed to save profile');
    }
    return {
        id: data.id,
        name: data.name || null,
        phone: data.phone || null,
        email: data.email || null,
        role: data.role || null,
    };
};

export type AssignedStockRow = {
    product_id: string;
    product_name: string;
    qty_assigned: number;
    qty_remaining: number;
};

export type LowStockItem = {
    product_id: string;
    name: string;
    boxes: number;
    pcs: number;
    pcs_per_box: number;
    total_pcs: number;
    threshold: number;
};

// Assign Stock types
export interface DriverOption {
    id: string;
    name: string;
    phone: string | null;
}

export interface RouteOption {
    id: string;
    name: string;
}

export interface TruckOption {
    id: string;
    name: string;
    license_plate: string | null;
}

export interface DailyStockItem {
    productId: string;
    boxQty: number;
    pcsQty: number;
}

export type DailyStockPayload = DailyStockItem[];

export type AssignableProductRow = WarehouseStock;

// Assignment log types
export interface AssignmentLogEntry {
    id: string;
    date: string;
    auth_user_id: string | null;
    route_id: string | null;
    truck_id: string | null;
    driver_name?: string | null;
    route_name?: string | null;
    truck_name?: string | null;
    stock: DailyStockPayload;
    created_at?: string;
    updated_at?: string;
    total_boxes: number;
    total_pcs: number;
    initial_boxes?: number;
    initial_pcs?: number;
    route_status?: 'not_started' | 'started' | 'route is ended';
}


/**
 * Check if a route has been started by a driver for a specific date
 * A route is considered started if there's a daily_stock record with auth_user_id NOT NULL
 * (meaning a driver has claimed the stock/route)
 * AND the route has active stock (not returned/ended)
 */
export const isRouteStarted = async (
    routeId: string,
    date: string
): Promise<boolean> => {
    const { data } = await supabase
        .from('daily_stock')
        .select('auth_user_id, stock')
        .eq('route_id', routeId)
        .eq('date', date)
        .maybeSingle();

    if (!data) return false;

    // Check if stock is effectively empty (route ended/returned)
    // If total items are 0, we consider the route ended/available for new assignment
    const stock = Array.isArray(data.stock) ? data.stock : [];
    const totalItems = stock.reduce((sum: number, item: any) => sum + (item.boxQty || 0) + (item.pcsQty || 0), 0);

    if (totalItems === 0) return false;

    return !!data.auth_user_id;
};

// Products
export const getProducts = async (): Promise<Product[]> => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching products:', error);
        throw error;
    }

    return data || [];
};

/**
 * Get product by ID
 */
export const getProductById = async (productId: string): Promise<Product | null> => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching product:', error);
        throw error;
    }

    return data;
};

export const upsertProduct = async (
    p: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<Product> => {
    const now = new Date().toISOString();
    const productData = {
        ...p,
        status: 'active',
        updated_at: now,
        ...(p.id ? {} : { created_at: now }),
    };

    const { data, error } = await supabase
        .from('products')
        .upsert(productData)
        .select()
        .single();

    if (error) {
        console.error('Error upserting product:', error);
        throw error;
    }

    return data;
};

export const softDeleteProduct = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('products')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error soft deleting product:', error);
        throw error;
    }
};

// ============================================================================
// Routes Management
// ============================================================================

/**
 * Get all routes (for admin) - includes both active and inactive
 */
export const getAllRoutes = async (): Promise<Route[]> => {
    const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching routes:', error);
        throw new Error('Failed to load routes. Please try again.');
    }

    return data || [];
};

/**
 * Legacy function - kept for backward compatibility
 * Use getAllRoutes() for admin or getActiveRoutes() for driver portal
 */
export const getRoutes = async (): Promise<Route[]> => {
    return getAllRoutes();
};

/**
 * Create a new route with validation
 */
export const createRoute = async (input: {
    name: string;
    description?: string;
}): Promise<Route> => {
    // Validate name
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
        throw new Error('Route name is required');
    }

    const now = new Date().toISOString();
    const routeData = {
        name: trimmedName,
        description: input.description?.trim() || null,
        is_active: true,
        created_at: now,
        updated_at: now,
    };

    const { data, error } = await supabase
        .from('routes')
        .insert(routeData)
        .select()
        .single();

    if (error) {
        console.error('Error creating route:', error);
        // Check for unique constraint violation
        if (error.code === '23505') {
            throw new Error('A route with this name already exists. Please choose a different name.');
        }
        throw new Error('Failed to create route. Please try again.');
    }

    return data;
};

/**
 * Update an existing route
 */
export const updateRoute = async (
    id: string,
    input: {
        name?: string;
        description?: string | null;
        is_active?: boolean;
    }
): Promise<Route> => {
    // Build update object with only provided fields
    const updateData: any = {
        updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
        const trimmedName = input.name.trim();
        if (!trimmedName) {
            throw new Error('Route name cannot be empty');
        }
        updateData.name = trimmedName;
    }

    if (input.description !== undefined) {
        updateData.description = input.description?.trim() || null;
    }

    if (input.is_active !== undefined) {
        updateData.is_active = input.is_active;
    }

    const { data, error } = await supabase
        .from('routes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating route:', error);
        // Check for unique constraint violation
        if (error.code === '23505') {
            throw new Error('A route with this name already exists. Please choose a different name.');
        }
        throw new Error('Failed to update route. Please try again.');
    }

    return data;
};

/**
 * Legacy function - kept for backward compatibility
 * Use createRoute() instead
 */
export const addRoute = async (
    name: string,
    description?: string
): Promise<Route> => {
    return createRoute({ name, description });
};

/**
 * Delete a route (hard delete)
 */
export const deleteRoute = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting route:', error);
        throw new Error('Failed to delete route. Please try again.');
    }
};

/**
 * Legacy function - kept for backward compatibility
 * Use deleteRoute instead
 */
export const deactivateRoute = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('routes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error deactivating route:', error);
        throw new Error('Failed to deactivate route. Please try again.');
    }
};

/**
 * Search routes by name (case-insensitive)
 * Returns only active routes
 */
export const searchRoutesByName = async (query: string): Promise<RouteOption[]> => {
    if (!query.trim()) {
        return getActiveRoutes();
    }

    const { data, error } = await supabase
        .from('routes')
        .select('id, name')
        .eq('is_active', true)
        .ilike('name', `%${query.trim()}%`)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error searching routes:', error);
        throw new Error('Failed to search routes. Please try again.');
    }

    return data || [];
};

// Daily Stock
export const getDailyStock = async (
    routeId: string,
    date: string
): Promise<DailyStock | null> => {
    const { data, error } = await supabase
        .from('daily_stock')
        .select('*')
        .eq('route_id', routeId)
        .eq('date', date)
        .maybeSingle();

    if (error) {
        console.error('Error fetching daily stock:', error);
        throw error;
    }

    return data;
};

export const setDailyStock = async (
    routeId: string,
    date: string,
    stock: StockItem[]
): Promise<void> => {
    // Check if record exists
    const existing = await getDailyStock(routeId, date);

    if (existing) {
        // Update existing record
        const { error } = await supabase
            .from('daily_stock')
            .update({ stock })
            .eq('route_id', routeId)
            .eq('date', date);

        if (error) {
            console.error('Error updating daily stock:', error);
            throw error;
        }
    } else {
        // Insert new record
        const { error } = await supabase
            .from('daily_stock')
            .insert({
                route_id: routeId,
                date,
                stock,
                created_at: new Date().toISOString(),
            });

        if (error) {
            console.error('Error inserting daily stock:', error);
            throw error;
        }
    }
};

/**
 * Get daily stock for driver portal (without authentication)
 * Returns stock data for a specific route, truck, and date combination
 */
export const getDailyStockForRouteTruckDate = async (
    routeId: string,
    truckId: string,
    date: string
): Promise<DailyStockPayload | null> => {
    const { data, error } = await supabase
        .from('daily_stock')
        .select('stock')
        .eq('route_id', routeId)
        .eq('truck_id', truckId)
        .eq('date', date)
        .is('auth_user_id', null)
        .maybeSingle();

    if (error) {
        console.error('Error fetching daily stock:', error);
        throw new Error('Failed to fetch daily stock. Please try again.');
    }

    if (!data) {
        return null;
    }

    // Parse the stock jsonb field
    return Array.isArray(data.stock) ? data.stock : [];
};

/**
 * Save daily stock for driver portal (without authentication)
 * Creates or updates daily stock for a specific route, truck, and date combination
 */
export const saveDailyStock = async (
    routeId: string,
    truckId: string,
    date: string,
    items: DailyStockPayload
): Promise<void> => {
    // Validate inputs
    if (!routeId || !truckId || !date) {
        throw new Error('Route, truck, and date are required');
    }

    // Validate and filter items
    const validItems = items
        .filter(item => {
            // Ensure quantities are valid numbers >= 0
            const boxQty = Math.max(0, Number(item.boxQty) || 0);
            const pcsQty = Math.max(0, Number(item.pcsQty) || 0);
            return boxQty > 0 || pcsQty > 0;
        })
        .map(item => ({
            productId: item.productId,
            boxQty: Math.max(0, Number(item.boxQty) || 0),
            pcsQty: Math.max(0, Number(item.pcsQty) || 0),
        }));

    // Check if record exists first (since upsert with NULL auth_user_id can be tricky)
    // Returns null if no record exists, or an array (possibly empty) if record exists
    const existing = await getDailyStockForRouteTruckDate(routeId, truckId, date);

    // Prepare data for insert/update
    const dailyStockData = {
        route_id: routeId,
        truck_id: truckId,
        date,
        stock: validItems,
        auth_user_id: null, // No authentication
    };

    let error;
    // Explicitly check for null to determine if record exists
    // existing can be null (no record), [] (empty stock), or [{...}] (with items)
    if (existing !== null) {
        // Update existing record (even if stock array is empty)
        const { error: updateError } = await supabase
            .from('daily_stock')
            .update({ stock: validItems })
            .eq('route_id', routeId)
            .eq('truck_id', truckId)
            .eq('date', date)
            .is('auth_user_id', null);
        error = updateError;
    } else {
        // Insert new record
        const { error: insertError } = await supabase
            .from('daily_stock')
            .insert(dailyStockData);
        error = insertError;
    }

    if (error) {
        console.error('Error saving daily stock:', error);
        throw new Error('Failed to save daily stock. Please try again.');
    }
};

// Sales
export const startRouteForDriver = async (
    driverId: string,
    routeId: string,
    date: string
): Promise<void> => {
    // 1. Check if already started/claimed by this driver
    const { data: existing } = await supabase
        .from('daily_stock')
        .select('id')
        .eq('route_id', routeId)
        .eq('date', date)
        .eq('auth_user_id', driverId)
        .maybeSingle();

    if (existing) {
        // Already started.
        return;
    }

    // 2. Find the Admin's assigned stock (auth_user_id IS NULL)
    const { data: adminStock, error: fetchError } = await supabase
        .from('daily_stock')
        .select('*')
        .eq('route_id', routeId)
        .eq('date', date)
        .is('auth_user_id', null)
        .maybeSingle();

    if (fetchError) {
        console.error('Error checking assigned stock:', fetchError);
        throw new Error('Failed to check assigned stock');
    }

    if (!adminStock) {
        // No stock assigned by admin.
        // Create an empty record so route is marked as started
        const { error: insertError } = await supabase
            .from('daily_stock')
            .insert({
                route_id: routeId,
                date: date,
                auth_user_id: driverId,
                stock: [],
                truck_id: null
            });

        if (insertError) {
            console.error('Error starting route (empty):', insertError);
            throw new Error('Failed to start route');
        }
        return;
    }

    // 3. Claim the stock: Update the record to set auth_user_id = driverId
    const { error: updateError } = await supabase
        .from('daily_stock')
        .update({
            auth_user_id: driverId
        })
        .eq('id', adminStock.id);

    if (updateError) {
        console.error('Error claiming stock:', updateError);
        throw new Error('Failed to claim stock');
    }
};

export const getSalesFor = async (
    date: string,
    routeId?: string
): Promise<Sale[]> => {
    let query = supabase
        .from('sales')
        .select('*')
        .eq('date', date);

    if (routeId) {
        query = query.eq('route_id', routeId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching sales:', error);
        throw error;
    }

    return data || [];
};

export interface ProductMinimal {
    id: string;
    name: string;
    pcs_per_box: number;
    box_price?: number | null;
    pcs_price?: number | null;
    price?: number | null;
}

export const getProductsMap = async (): Promise<Record<string, ProductMinimal>> => {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, pcs_per_box, box_price, pcs_price, price');
    if (error) {
        console.error('Error fetching products map:', error);
        throw new Error('Failed to fetch products.');
    }
    const map: Record<string, ProductMinimal> = {};
    (data || []).forEach((p: any) => {
        map[p.id] = {
            id: p.id,
            name: p.name,
            pcs_per_box: p.pcs_per_box ?? 24,
            box_price: p.box_price ?? p.price ?? null,
            pcs_price: p.pcs_price ?? null,
            price: p.price ?? null,
        };
    });
    return map;
};

export const getRoutesMap = async (): Promise<Record<string, string>> => {
    const { data, error } = await supabase.from('routes').select('id, name');
    if (error) {
        console.error('Error fetching routes:', error);
        throw new Error('Failed to fetch routes.');
    }
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.id] = r.name; });
    return map;
};

export const getDriversMap = async (): Promise<Record<string, string>> => {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('role', 'driver');
    if (error) {
        console.error('Error fetching drivers:', error);
        throw new Error('Failed to fetch drivers.');
    }
    const map: Record<string, string> = {};
    (data || []).forEach((u: any) => { map[u.id] = u.name || ''; });
    return map;
};

export const getDailyStockBetween = async (
    dateFrom: string,
    dateTo: string
): Promise<Array<{
    id: string;
    date: string;
    route_id: string | null;
    auth_user_id: string | null;
    stock: DailyStockPayload;
    created_at?: string;
}>> => {
    const { data, error } = await supabase
        .from('daily_stock')
        .select('id, date, stock, route_id, auth_user_id, created_at')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true })
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching daily stock:', error);
        throw new Error('Failed to fetch assigned stock.');
    }
    return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        route_id: row.route_id ?? null,
        auth_user_id: row.auth_user_id ?? null,
        stock: Array.isArray(row.stock) ? row.stock : [],
        created_at: row.created_at,
    }));
};

export const getSalesBetween = async (
    dateFrom: string,
    dateTo: string
): Promise<Sale[]> => {
    const { data, error } = await supabase
        .from('sales')
        .select('*')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching sales:', error);
        throw new Error('Failed to fetch sales.');
    }
    return data || [];
};

export const getAssignmentsForDate = async (date: string): Promise<AssignmentLogEntry[]> => {
    // 1. Fetch Daily Stock (Remaining)
    let { data, error } = await supabase
        .from('daily_stock')
        .select(`
            id,
            date,
            stock,
            initial_stock,
            created_at,
            updated_at,
            auth_user_id,
            route_id,
            truck_id,
            users(name),
            routes(name),
            trucks(name)
        `)
        .eq('date', date)
        .order('created_at', { ascending: false });

    // Fallback if joined query fails
    if (error) {
        console.warn("AssignmentLog: Error fetching joined stock, retrying with fallback.", error);
        const fallback = await supabase
            .from('daily_stock')
            .select('id, date, stock, initial_stock, created_at, updated_at, auth_user_id, route_id, truck_id')
            .eq('date', date)
            .order('created_at', { ascending: false });
        if (fallback.error) {
            console.error("AssignmentLog: Fallback failed.", fallback.error);
            throw new Error('Failed to fetch assignment log.');
        }
        data = fallback.data?.map((row: any) => ({
            ...row,
            users: row.users ? [row.users] : [],
            routes: row.routes ? [row.routes] : [],
            trucks: row.trucks ? [row.trucks] : [],
        })) ?? [];
    }

    if (!data || data.length === 0) return [];

    // Fetch sales data for fallback calculation (if initial_stock is not set)
    const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('route_id, products_sold, items')
        .eq('date', date);

    if (salesError) {
        console.error("AssignmentLog: Error fetching sales for fallback calc.", salesError);
    }

    const routeIds = Array.from(new Set((data || []).map((r: any) => r.route_id).filter(Boolean)));
    const userIds = Array.from(new Set((data || []).map((r: any) => r.auth_user_id).filter(Boolean)));
    const truckIds = Array.from(new Set((data || []).map((r: any) => r.truck_id).filter(Boolean)));

    let routeMap: Record<string, string> = {};
    let userMap: Record<string, string> = {};
    let truckMap: Record<string, string> = {};

    if (routeIds.length > 0) {
        const rr = await supabase.from('routes').select('id, name').in('id', routeIds);
        if (!rr.error && rr.data) {
            rr.data.forEach((x: any) => { routeMap[x.id] = x.name; });
        }
    }
    if (userIds.length > 0) {
        const ur = await supabase.from('users').select('id, name').in('id', userIds);
        if (!ur.error && ur.data) {
            ur.data.forEach((x: any) => { userMap[x.id] = x.name; });
        }
    }
    if (truckIds.length > 0) {
        const tr = await supabase.from('trucks').select('id, name').in('id', truckIds);
        if (!tr.error && tr.data) {
            tr.data.forEach((x: any) => { truckMap[x.id] = x.name; });
        }
    }

    // Helper to normalize sale products
    const normalizeSaleProducts = (ps: unknown): any[] => {
        if (!ps) return [];
        if (Array.isArray(ps)) return ps;
        if (typeof ps === "string") {
            try {
                const parsed = JSON.parse(ps);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && Array.isArray(parsed.items)) return parsed.items;
            } catch (e) { return []; }
        }
        if (typeof ps === "object" && ps !== null) {
            const obj = ps as { items?: unknown };
            if (Array.isArray(obj.items)) return obj.items;
        }
        return [];
    };

    const entries = (data || []).map((row: any) => {
        const stock: DailyStockPayload = Array.isArray(row.stock) ? row.stock : [];
        const initialStock: DailyStockPayload = Array.isArray(row.initial_stock) ? row.initial_stock : [];

        // Calculate Remaining Totals (Simple Sum)
        const remainingSimple = stock.reduce((acc: any, item: any) => ({
            boxes: acc.boxes + (item.boxQty || 0),
            pcs: acc.pcs + (item.pcsQty || 0)
        }), { boxes: 0, pcs: 0 });

        // Calculate Initial Totals
        // Priority 1: Use initial_stock field if it has data
        // Priority 2: Calculate from remaining + sold (fallback for old records)
        let initialSimple = initialStock.reduce((acc: any, item: any) => ({
            boxes: acc.boxes + (item.boxQty || 0),
            pcs: acc.pcs + (item.pcsQty || 0)
        }), { boxes: 0, pcs: 0 });

        // If initial_stock is empty, calculate from remaining + sold
        if (initialSimple.boxes === 0 && initialSimple.pcs === 0 && salesData && row.route_id) {
            let soldBoxes = 0;
            let soldPcs = 0;
            
            const routeSales = salesData.filter((s: any) => s.route_id === row.route_id);
            routeSales.forEach((sale: any) => {
                const rawItems = sale.products_sold || sale.items;
                const items = normalizeSaleProducts(rawItems);
                items.forEach((item: any) => {
                    soldBoxes += (item.boxQty || item.boxes || 0);
                    soldPcs += (item.pcsQty || item.pcs || 0);
                });
            });
            
            initialSimple = {
                boxes: remainingSimple.boxes + soldBoxes,
                pcs: remainingSimple.pcs + soldPcs
            };
        }

        return {
            id: row.id,
            date: row.date,
            auth_user_id: row.auth_user_id ?? null,
            route_id: row.route_id ?? null,
            truck_id: row.truck_id ?? null,
            driver_name: row.auth_user_id ? userMap[row.auth_user_id] || null : null,
            route_name: row.route_id ? routeMap[row.route_id] || null : null,
            truck_name: row.truck_id ? truckMap[row.truck_id] || null : null,
            stock,
            created_at: row.created_at,
            updated_at: row.updated_at,
            total_boxes: remainingSimple.boxes,
            total_pcs: remainingSimple.pcs,
            initial_boxes: initialSimple.boxes, // From initial_stock field or calculated
            initial_pcs: initialSimple.pcs,
            route_status: (remainingSimple.boxes === 0 && remainingSimple.pcs === 0) ? 'route is ended' : ((row.truck_id || row.auth_user_id) ? 'started' : 'not_started'),
        } as AssignmentLogEntry;
    });

    return entries;
};

export const subscribeAssignmentsForDate = (
    date: string,
    onChange: () => void
) => {
    const channel = supabase
        .channel(`daily_stock_changes_${date}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'daily_stock',
            filter: `date=eq.${date}`,
        }, () => {
            try { onChange(); } catch { }
        })
        .subscribe();

    return channel;
};

export const appendSale = async (
    sale: Omit<Sale, 'id' | 'created_at'>
): Promise<Sale> => {
    const saleData = {
        ...sale,
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('sales')
        .insert(saleData)
        .select()
        .single();

    if (error) {
        console.error('Error appending sale:', error);
        throw error;
    }

    return data;
};

// Warehouse Stock Management

/**
 * Get all warehouse stock with product details
 */
export const getWarehouseStock = async (): Promise<WarehouseStock[]> => {
    const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`
            id,
            product_id,
            boxes,
            pcs,
            created_at,
            updated_at,
            products (
                name,
                box_price,
                pcs_price,
                pcs_per_box,
                price
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching warehouse stock:', error);
        throw error;
    }

    // Transform the data to match WarehouseStock type
    return (data || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown Product',
        box_price: item.products?.box_price || item.products?.price || 0,
        pcs_price: item.products?.pcs_price || 0,
        pcs_per_box: item.products?.pcs_per_box || 24,
        boxes: item.boxes || 0,
        pcs: item.pcs || 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
    }));
};

export const getLowStockProducts = async (): Promise<LowStockItem[]> => {
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, pcs_per_box, status')
        .eq('status', 'active')
        .order('name', { ascending: true });

    if (productsError) {
        console.error('Error fetching products:', productsError);
        throw new Error(productsError.message || 'Failed to fetch products');
    }

    const { data: stockRows, error: stockError } = await supabase
        .from('warehouse_stock')
        .select('product_id, boxes, pcs');

    if (stockError) {
        console.error('Error fetching warehouse stock:', stockError);
        throw new Error(stockError.message || 'Failed to fetch warehouse stock');
    }

    const stockMap = new Map<string, { boxes: number; pcs: number }>();
    (stockRows || []).forEach((r: { product_id: string; boxes: number; pcs: number }) => {
        stockMap.set(String(r.product_id), { boxes: Number(r.boxes) || 0, pcs: Number(r.pcs) || 0 });
    });

    const low: LowStockItem[] = (products || []).map((p) => {
        const prod = p as Product;
        const pcsPerBox = Number(prod.pcs_per_box ?? 24);
        const s = stockMap.get(String(prod.id)) || { boxes: 0, pcs: 0 };
        const total_pcs = s.boxes * pcsPerBox + s.pcs;
        const threshold = pcsPerBox * 2;
        return {
            product_id: String(prod.id),
            name: String(prod.name || 'Unknown Product'),
            boxes: s.boxes,
            pcs: s.pcs,
            pcs_per_box: pcsPerBox,
            total_pcs,
            threshold,
        };
    }).filter((it) => it.total_pcs < it.threshold)
        .sort((a, b) => a.total_pcs - b.total_pcs);

    return low;
};

/**
 * Add stock to warehouse (increment)
 */
export const addWarehouseStock = async (
    productId: string,
    boxes: number,
    pcs: number,
    note?: string
): Promise<void> => {
    if (boxes < 0 || pcs < 0) {
        throw new Error('Cannot add negative stock');
    }

    // Check if warehouse stock entry exists
    const { data: existing, error: fetchError } = await supabase
        .from('warehouse_stock')
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();

    if (fetchError) {
        console.error('Error checking warehouse stock:', fetchError);
        throw new Error('Failed to check warehouse stock. Please try again.');
    }

    if (existing) {
        // Update existing entry
        const { error } = await supabase
            .from('warehouse_stock')
            .update({
                boxes: existing.boxes + boxes,
                pcs: existing.pcs + pcs,
            })
            .eq('product_id', productId);

        if (error) {
            console.error('Error adding warehouse stock:', error);
            throw new Error('Failed to add stock. Please try again.');
        }
    } else {
        // Create new entry
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('warehouse_stock')
            .insert({
                product_id: productId,
                boxes,
                pcs,
                created_at: now,
                updated_at: now,
            });

        if (error) {
            console.error('Error creating warehouse stock:', error);
            throw new Error(error.message || 'Failed to create warehouse stock entry. Please try again.');
        }
    }

    // Log the movement
    const { error: movementError } = await supabase
        .from('warehouse_movements')
        .insert({
            product_id: productId,
            movement_type: 'IN',
            boxes,
            pcs,
            note: note || null,
        });

    if (movementError) {
        console.error('Error logging warehouse movement:', movementError);
        // Don't throw here - stock was updated successfully
    }
};

/**
 * Remove stock from warehouse (decrement) - used when assigning to drivers
 */
export const removeWarehouseStock = async (
    productId: string,
    boxes: number,
    pcs: number
): Promise<void> => {
    if (boxes < 0 || pcs < 0) {
        throw new Error('Cannot remove negative stock');
    }

    // Get current warehouse stock
    const { data: existing, error: fetchError } = await supabase
        .from('warehouse_stock')
        .select('*')
        .eq('product_id', productId)
        .single();

    if (fetchError || !existing) {
        throw new Error('Product not found in warehouse stock');
    }

    const newBoxes = existing.boxes - boxes;
    const newPcs = existing.pcs - pcs;

    // Check for negative stock
    if (newBoxes < 0 || newPcs < 0) {
        throw new Error('Insufficient warehouse stock');
    }

    // Update warehouse stock
    const { error } = await supabase
        .from('warehouse_stock')
        .update({
            boxes: newBoxes,
            pcs: newPcs,
        })
        .eq('product_id', productId);

    if (error) {
        console.error('Error removing warehouse stock:', error);
        throw error;
    }
};

/**
 * Set exact warehouse stock amount (override)
 */
export const setWarehouseStock = async (
    productId: string,
    boxes: number,
    pcs: number,
    note?: string
): Promise<void> => {
    if (boxes < 0 || pcs < 0) {
        throw new Error('Stock cannot be negative');
    }

    // Check if warehouse stock entry exists
    const { data: existing, error: fetchError } = await supabase
        .from('warehouse_stock')
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();

    if (fetchError) {
        console.error('Error checking warehouse stock:', fetchError);
        throw new Error('Failed to check warehouse stock. Please try again.');
    }

    // Calculate the difference for logging
    const boxesDiff = existing ? boxes - existing.boxes : boxes;
    const pcsDiff = existing ? pcs - existing.pcs : pcs;

    if (existing) {
        // Update existing entry
        const { error } = await supabase
            .from('warehouse_stock')
            .update({
                boxes,
                pcs,
            })
            .eq('product_id', productId);

        if (error) {
            console.error('Error setting warehouse stock:', error);
            throw new Error('Failed to update stock. Please try again.');
        }
    } else {
        // Create new entry
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('warehouse_stock')
            .insert({
                product_id: productId,
                boxes,
                pcs,
                created_at: now,
                updated_at: now,
            });

        if (error) {
            console.error('Error creating warehouse stock:', error);
            throw new Error(error.message || 'Failed to create warehouse stock entry. Please try again.');
        }
    }

    // Log the movement (record the difference)
    const { error: movementError } = await supabase
        .from('warehouse_movements')
        .insert({
            product_id: productId,
            movement_type: 'ADJUST',
            boxes: boxesDiff,
            pcs: pcsDiff,
            note: note || null,
        });

    if (movementError) {
        console.error('Error logging warehouse movement:', movementError);
        // Don't throw here - stock was updated successfully
    }
};

/**
 * Get products that are not yet in warehouse stock
 */
export const getProductsNotInWarehouse = async (): Promise<Product[]> => {
    // Get all products
    const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true });

    if (productsError) {
        console.error('Error fetching products:', productsError);
        throw productsError;
    }

    // Get all product IDs that are in warehouse stock
    const { data: warehouseStock, error: warehouseError } = await supabase
        .from('warehouse_stock')
        .select('product_id');

    if (warehouseError) {
        console.error('Error fetching warehouse stock:', warehouseError);
        throw warehouseError;
    }

    const warehouseProductIds = new Set(
        (warehouseStock || []).map((item: any) => item.product_id)
    );

    // Filter out products that are already in warehouse
    return (allProducts || []).filter(
        (product) => !warehouseProductIds.has(product.id)
    );
};

/**
 * Get warehouse movement history
 */
export const getWarehouseMovements = async (
    productId?: string,
    limit: number = 50
): Promise<WarehouseMovement[]> => {
    let query = supabase
        .from('warehouse_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (productId) {
        query = query.eq('product_id', productId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching warehouse movements:', error);
        throw new Error('Failed to fetch warehouse movements. Please try again.');
    }

    return data || [];
};

/**
 * Get stock for a specific product
 */
export const getProductStock = async (productId: string): Promise<WarehouseStock | null> => {
    const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`
            id,
            product_id,
            boxes,
            pcs,
            created_at,
            updated_at,
            products (
                name,
                box_price,
                pcs_price,
                pcs_per_box,
                price
            )
        `)
        .eq('product_id', productId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching product stock:', error);
        throw error;
    }

    if (!data) return null;

    // Access products property correctly
    const product = data.products as any;

    return {
        id: data.id,
        product_id: data.product_id,
        product_name: product?.name || 'Unknown Product',
        box_price: product?.box_price || product?.price || 0,
        pcs_price: product?.pcs_price || 0,
        pcs_per_box: product?.pcs_per_box || 24,
        boxes: data.boxes || 0,
        pcs: data.pcs || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
    };
};

// ============================================================================
// Assign Stock Functions
// ============================================================================

/**
 * Get all active drivers
 */
export const getDrivers = async (): Promise<DriverOption[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, phone')
        .eq('role', 'driver')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching drivers:', error);
        throw new Error('Failed to fetch drivers. Please try again.');
    }

    return data || [];
};

/**
 * Get all active routes (renamed to avoid conflict with existing getRoutes)
 */
export const getActiveRoutes = async (): Promise<RouteOption[]> => {
    const { data, error } = await supabase
        .from('routes')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching routes:', error);
        throw new Error('Failed to fetch routes. Please try again.');
    }

    return data || [];
};

/**
 * Get all active trucks
 */
export const getTrucks = async (): Promise<TruckOption[]> => {
    const { data, error } = await supabase
        .from('trucks')
        .select('id, name, license_plate')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching trucks:', error);
        throw new Error('Failed to fetch trucks. Please try again.');
    }

    return data || [];
};

/**
 * Get assignable products (active products with warehouse stock)
 */
export const getAssignableProducts = async (): Promise<AssignableProductRow[]> => {
    const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`
            id,
            product_id,
            boxes,
            pcs,
            created_at,
            updated_at,
            products (
                name,
                box_price,
                pcs_price,
                pcs_per_box,
                price,
                status
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching assignable products:', error);
        throw new Error('Failed to fetch assignable products. Please try again.');
    }

    // Transform and filter to active products with available stock only
    return (data || [])
        .filter((item: any) => {
            // Only include active products
            if (item.products?.status !== 'active') {
                return false;
            }
            // Only include products with stock available (boxes > 0 OR pcs > 0)
            return item.boxes > 0 || item.pcs > 0;
        })
        .map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.products?.name || 'Unknown Product',
            box_price: item.products?.box_price || item.products?.price || 0,
            pcs_price: item.products?.pcs_price || 0,
            pcs_per_box: item.products?.pcs_per_box || 24,
            boxes: item.boxes || 0,
            pcs: item.pcs || 0,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }));
};

/**
 * Get existing daily stock for a driver/route/truck/date combination
 * At least one of driverId or routeId must be provided
 */
export const getDailyStockForDriverRouteDate = async (
    driverId: string | null,
    routeId: string | null,
    truckId: string | null,
    date: string
): Promise<DailyStockPayload | null> => {
    let query = supabase
        .from('daily_stock')
        .select('stock')
        .eq('date', date);

    // Apply driver filter if provided
    if (driverId) {
        query = query.eq('auth_user_id', driverId);
    } else {
        query = query.is('auth_user_id', null);
    }

    // Apply route filter if provided
    if (routeId) {
        query = query.eq('route_id', routeId);
    } else {
        query = query.is('route_id', null);
    }

    // Apply truck filter
    if (truckId) {
        query = query.eq('truck_id', truckId);
    } else {
        query = query.is('truck_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        console.error('Error fetching daily stock:', error);
        throw new Error('Failed to fetch existing stock. Please try again.');
    }

    if (!data) {
        return null;
    }

    // Parse the stock jsonb field
    return data.stock as DailyStockPayload;
};

/**
 * Save assigned stock - creates/updates daily_stock and reduces warehouse stock
 * At least one of driverId or routeId must be provided
 */
export const saveAssignedStock = async (
    driverId: string | null,
    routeId: string | null,
    truckId: string | null,
    date: string,
    items: DailyStockPayload
): Promise<void> => {
    // Validate that at least driver or route is provided
    if (!driverId && !routeId) {
        throw new Error('Please select at least a driver or route');
    }

    // Step 1: Validate and filter items
    const validItems = items.filter(item => {
        if (item.boxQty < 0 || item.pcsQty < 0) {
            throw new Error('Cannot assign negative quantities');
        }
        // Keep items with at least some quantity
        return item.boxQty > 0 || item.pcsQty > 0;
    });

    if (validItems.length === 0) {
        throw new Error('Please assign at least some stock');
    }

    // Step 1.5: Check if route has been started (if routeId is provided)
    if (routeId) {
        const routeStarted = await isRouteStarted(routeId, date);
        if (routeStarted) {
            throw new Error("Route is already started you can't assign stock now");
        }
    }

    // Step 2: Fetch warehouse stock for all involved products
    const productIds = validItems.map(item => item.productId);
    const { data: warehouseData, error: warehouseError } = await supabase
        .from('warehouse_stock')
        .select(`
            product_id,
            boxes,
            pcs,
            products (
                name,
                pcs_per_box
            )
        `)
        .in('product_id', productIds);

    if (warehouseError) {
        console.error('Error fetching warehouse stock:', warehouseError);
        throw new Error('Failed to verify warehouse stock. Please try again.');
    }

    // Create a map for quick lookup
    const warehouseMap = new Map(
        (warehouseData || []).map((item: any) => [
            item.product_id,
            {
                boxes: item.boxes,
                pcs: item.pcs,
                pcs_per_box: item.products?.pcs_per_box || 24,
                product_name: item.products?.name || 'Unknown Product',
            },
        ])
    );

    // Step 2.5: Fetch existing daily_stock to calculate delta
    let existingItems: DailyStockPayload = [];
    let existingInitialItems: DailyStockPayload = []; // To track initial stock
    let query = supabase.from('daily_stock').select('stock, initial_stock').eq('date', date);

    if (routeId) query = query.eq('route_id', routeId);

    if (driverId) {
        query = query.eq('auth_user_id', driverId);
    } else {
        query = query.is('auth_user_id', null);
    }

    if (truckId) {
        query = query.eq('truck_id', truckId);
    } else {
        query = query.is('truck_id', null);
    }

    const { data: existingStockData, error: existingStockError } = await query.maybeSingle();

    if (!existingStockError && existingStockData) {
        existingItems = existingStockData.stock as DailyStockPayload;
        // If initial_stock exists, use it. Otherwise default to current stock (for back compat)
        existingInitialItems = (existingStockData.initial_stock as DailyStockPayload) || existingItems;
    }

    // Step 3: Validate stock availability and calculate deltas
    // CRITICAL FIX: Fetch fresh warehouse data for delta calculations
    // The cached warehouseMap has stale pcs_per_box values
    const deltaMap = new Map<string, { deltaBox: number; deltaPcs: number; deltaTotalPcs: number; pcsPerBox: number }>();

    // Map to hold the NEW initial stock values
    const newInitialMap = new Map<string, DailyStockItem>();

    // Pre-populate with existing initial items
    existingInitialItems.forEach(item => {
        newInitialMap.set(item.productId, { ...item });
    });

    for (const item of validItems) {
        // Fetch FRESH warehouse stock for accurate pcs_per_box
        const { data: freshWarehouse, error: fetchError } = await supabase
            .from('warehouse_stock')
            .select(`
                product_id,
                boxes,
                pcs,
                products (
                    name,
                    pcs_per_box
                )
            `)
            .eq('product_id', item.productId)
            .single();

        if (fetchError || !freshWarehouse) {
            throw new Error(`Product not found in warehouse`);
        }

        const pcsPerBox = (freshWarehouse.products as any)?.pcs_per_box || 24;
        const productName = (freshWarehouse.products as any)?.name || 'Unknown Product';

        // Find existing quantity
        const existingItem = existingItems.find(e => e.productId === item.productId);
        const oldBox = existingItem ? (existingItem.boxQty || 0) : 0;
        const oldPcs = existingItem ? (existingItem.pcsQty || 0) : 0;

        // Calculate totals using FRESH pcs_per_box
        const oldTotalPcs = oldBox * pcsPerBox + oldPcs;
        const newTotalPcs = item.boxQty * pcsPerBox + item.pcsQty;
        const deltaTotalPcs = newTotalPcs - oldTotalPcs;

        // Store delta with pcsPerBox for later use
        const deltaBox = item.boxQty - oldBox;
        const deltaPcs = item.pcsQty - oldPcs;

        deltaMap.set(item.productId, { deltaBox, deltaPcs, deltaTotalPcs, pcsPerBox });

        // Update Initial Stock Map
        // Logic: New Initial = Old Initial (or 0) + Delta (if delta > 0)
        // If delta is negative (correction), we theoretically should reduce initial? 
        // User requirement: "Initially Assigned" reflects the total assigned. 
        // We simply apply the delta to initial stock. 
        // Example: Initial=1000. Sold=100. Remaining=900. Admin adds 100 (Target=1000). Delta=100. New Initial=1100.
        // Example: Initial=1000. Admin corrects to 800 (Target=800). Delta=-200. New Initial=800.
        // This seems correct for "Admin actions".

        const currentInitial = newInitialMap.get(item.productId) || { productId: item.productId, boxQty: 0, pcsQty: 0 };
        const oldInitialTotalPcs = (currentInitial.boxQty || 0) * pcsPerBox + (currentInitial.pcsQty || 0);
        const newInitialTotalPcsCalc = Math.max(0, oldInitialTotalPcs + deltaTotalPcs); // Prevent negative

        newInitialMap.set(item.productId, {
            productId: item.productId,
            boxQty: Math.floor(newInitialTotalPcsCalc / pcsPerBox),
            pcsQty: newInitialTotalPcsCalc % pcsPerBox
        });

        // Only check availability if we are INCREASING stock (delta > 0)
        if (deltaTotalPcs > 0) {
            const availableTotalPcs = freshWarehouse.boxes * pcsPerBox + freshWarehouse.pcs;

            if (deltaTotalPcs > availableTotalPcs) {
                throw new Error(
                    `Not enough warehouse stock for ${productName}. ` +
                    `Available: ${freshWarehouse.boxes} boxes + ${freshWarehouse.pcs} pcs. ` +
                    `Additional required: ${Math.floor(deltaTotalPcs / pcsPerBox)} boxes + ${deltaTotalPcs % pcsPerBox} pcs.`
                );
            }
        }
    }

    // Convert newInitialMap to array
    const newInitialItems = Array.from(newInitialMap.values());

    // Step 4: Upsert daily_stock
    const dailyStockData = {
        auth_user_id: driverId,
        route_id: routeId,
        truck_id: truckId,
        date,
        stock: validItems,
        initial_stock: newInitialItems, // Save the calculated initial stock
    };

    const { error: dailyStockError } = await supabase
        .from('daily_stock')
        .upsert(dailyStockData, {
            onConflict: 'auth_user_id,route_id,truck_id,date',
        });

    if (dailyStockError) {
        console.error('Error saving daily stock:', dailyStockError);
        throw new Error('Failed to save stock assignment. Please try again.');
    }

    // Step 5: Update warehouse stock based on DELTA
    for (const item of validItems) {
        const delta = deltaMap.get(item.productId);

        if (!delta || delta.deltaTotalPcs === 0) continue;

        // Fetch FRESH warehouse stock for the update
        // We need current values since they may have changed since delta calculation
        const { data: freshWarehouse, error: fetchError } = await supabase
            .from('warehouse_stock')
            .select('product_id, boxes, pcs')
            .eq('product_id', item.productId)
            .single();

        if (fetchError || !freshWarehouse) {
            throw new Error(`Failed to fetch warehouse stock for product`);
        }

        // Use pcsPerBox from delta calculation for consistency
        const pcsPerBox = delta.pcsPerBox;

        // Calculate new warehouse stock using FRESH current values
        const currentWarehouseTotalPcs = freshWarehouse.boxes * pcsPerBox + freshWarehouse.pcs;
        const newWarehouseTotalPcs = currentWarehouseTotalPcs - delta.deltaTotalPcs;

        // Convert back to boxes and pcs
        const newBoxes = Math.floor(newWarehouseTotalPcs / pcsPerBox);
        const newPcs = newWarehouseTotalPcs % pcsPerBox;

        // Update warehouse stock
        const { error: updateError } = await supabase
            .from('warehouse_stock')
            .update({
                boxes: newBoxes,
                pcs: newPcs,
            })
            .eq('product_id', item.productId);

        if (updateError) {
            console.error('Error updating warehouse stock:', updateError);
            throw new Error(`Failed to update warehouse stock`);
        }

        // Step 6: Log the movement (Delta only)
        // Only log if there is a change
        if (delta.deltaTotalPcs !== 0) {
            const { error: movementError } = await supabase
                .from('warehouse_movements')
                .insert({
                    product_id: item.productId,
                    movement_type: delta.deltaTotalPcs > 0 ? 'ASSIGN' : 'RETURN', // ASSIGN = Out, RETURN = In
                    boxes: Math.abs(delta.deltaBox), // Log absolute values
                    pcs: Math.abs(delta.deltaPcs),
                    note: `Stock update for route on ${date}: ${delta.deltaTotalPcs > 0 ? 'Assigned' : 'Returned'} (Delta)`,
                });

            if (movementError) {
                console.error('Error logging warehouse movement:', movementError);
                // Don't throw here - stock was updated successfully
            }
        }
    }
};


// Shops
export interface Shop {
    id: string;
    name: string;
    phone: string | null;
    village: string | null;
    address: string | null;
    route_id: string | null;
    created_at: string;
    updated_at: string;
}

export const getAllShops = async (
    search?: string,
    village?: string,
    routeId?: string
): Promise<Shop[]> => {
    const buildQuery = (includeVillage: boolean, includeRouteId: boolean) => {
        let q = supabase
            .from('shops')
            .select('*')
            .order('created_at', { ascending: false });
        if (search && search.trim()) {
            const s = search.trim();
            q = q.or(
                includeVillage
                    ? `name.ilike.%${s}%,phone.ilike.%${s}%,village.ilike.%${s}%`
                    : `name.ilike.%${s}%,phone.ilike.%${s}%`
            );
        }
        if (includeVillage && village && village.trim()) {
            q = q.ilike('village', `%${village.trim()}%`);
        }
        if (includeRouteId && routeId && routeId.trim()) {
            q = q.eq('route_id', routeId.trim());
        }
        return q;
    };

    // Try combinations of columns
    let result = await buildQuery(true, true);
    if (result.error && /column.*village/i.test(result.error.message)) {
        console.warn('getAllShops: "village" column missing, falling back.');
        result = await buildQuery(false, true);
    }
    if (result.error && /column.*route_id/i.test(result.error.message)) {
        console.warn('getAllShops: "route_id" column missing, falling back.');
        result = await buildQuery(true, false);
    }
    // Final fallback: both missing
    if (result.error && (/column.*village/i.test(result.error.message) || /column.*route_id/i.test(result.error.message))) {
        console.warn('getAllShops: "village" or "route_id" missing, falling back to basic query.');
        result = await buildQuery(false, false);
    }

    if (result.error) {
        console.error('Error fetching shops:', result.error);
        throw new Error('Failed to fetch shops. Please try again.');
    }
    return result.data || [];
};

export const createShop = async (shopData: {
    name: string;
    phone?: string;
    village?: string;
    address?: string;
    route_id?: string;
}): Promise<Shop> => {
    const name = shopData.name?.trim();
    if (!name) throw new Error('Shop name is required');

    const { data: existing, error: existingErr } = await supabase
        .from('shops')
        .select('*')
        .ilike('name', name)
        .limit(1);
    if (!existingErr && existing && existing.length > 0) {
        return existing[0] as Shop;
    }

    // Check if phone exists (Primary Unique Identifier)
    if (shopData.phone?.trim()) {
        const { data: existingPhone, error: phoneErr } = await supabase
            .from('shops')
            .select('*')
            .eq('phone', shopData.phone.trim())
            .limit(1);
        if (!phoneErr && existingPhone && existingPhone.length > 0) {
            throw new Error('Shop with this phone number already exists');
        }
    }

    const now = new Date().toISOString();
    const payload = {
        name,
        phone: shopData.phone?.trim() || null,
        village: shopData.village?.trim() || null,
        address: shopData.address?.trim() || null,
        route_id: shopData.route_id?.trim() || null,
        created_at: now,
        updated_at: now,
    };

    console.log('createShop: Attempting to insert:', payload);
    const { data, error } = await supabase
        .from('shops')
        .insert(payload)
        .select()
        .single();

    // Expanded check for missing column errors
    const isColumnError = error && (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /column.*(village|route_id)/i.test(error.message || '') ||
        /Could not find the.*column/i.test(error.message || '')
    );

    if (isColumnError) {
        console.warn('createShop: Missing column detected, retrying with fallbacks. Error:', error);

        // STAGE 2: Try without Route/Village, but WITH Timestamps
        const { village, route_id, ...fallbackPayload2 } = payload as any;
        console.log('createShop: Fallback Stage 2:', fallbackPayload2);

        const { data: data2, error: error2 } = await supabase
            .from('shops')
            .insert(fallbackPayload2)
            .select()
            .single();

        if (!error2 && data2) return data2 as Shop;

        // Check for timestamp errors
        const isTimestampError = error2 && (
            error2.code === '42703' ||
            error2.code === 'PGRST204' ||
            /column/i.test(error2.message || '')
        );

        if (isTimestampError) {
            // STAGE 3: Try without UpdatedAt
            const { updated_at, ...fallbackPayload3 } = fallbackPayload2;
            console.log('createShop: Fallback Stage 3:', fallbackPayload3);
            const { data: data3, error: error3 } = await supabase
                .from('shops')
                .insert(fallbackPayload3)
                .select()
                .single();

            if (!error3 && data3) return data3 as Shop;

            // STAGE 4: Minimal
            const { created_at, ...minimalPayload } = fallbackPayload3;
            console.log('createShop: Fallback Stage 4:', minimalPayload);
            const { data: data4, error: error4 } = await supabase
                .from('shops')
                .insert(minimalPayload)
                .select()
                .single();

            if (!error4 && data4) return data4 as Shop;

            if (error4) {
                console.error('createShop: All fallbacks failed:', error4);
                throw new Error('Failed to create shop. Please try again.');
            }
        } else if (error2) {
            console.error('createShop: Fallback failed:', error2);
            throw new Error('Failed to create shop. Please try again.');
        }
    }
    if (error) {
        console.error('createShop: Error creating shop:', error);
        throw new Error('Failed to create shop. Please try again.');
    }
    return data as Shop;
};

export const updateShop = async (
    id: string,
    updateData: {
        name?: string;
        phone?: string | null;
        village?: string | null;
        address?: string | null;
        route_id?: string | null;
    }
): Promise<Shop> => {
    const now = new Date().toISOString();
    const payload: any = { updated_at: now };
    if (typeof updateData.name === 'string') payload.name = updateData.name.trim();
    if (typeof updateData.phone !== 'undefined') payload.phone = updateData.phone ? String(updateData.phone).trim() : null;
    if (typeof updateData.village !== 'undefined') payload.village = updateData.village ? String(updateData.village).trim() : null;
    if (typeof updateData.address !== 'undefined') payload.address = updateData.address ? String(updateData.address).trim() : null;
    if (typeof updateData.route_id !== 'undefined') payload.route_id = updateData.route_id ? String(updateData.route_id).trim() : null;

    // Check if phone exists (Primary Unique Identifier)
    if (payload.phone) {
        const { data: existingPhone, error: phoneErr } = await supabase
            .from('shops')
            .select('id')
            .eq('phone', payload.phone)
            .neq('id', id)
            .limit(1);
        if (!phoneErr && existingPhone && existingPhone.length > 0) {
            throw new Error('Shop with this phone number already exists');
        }
    }

    console.log('updateShop: Attempting update:', payload);
    const { data, error } = await supabase
        .from('shops')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    // Expanded check for missing column errors
    const isColumnError = error && (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /column.*(village|route_id)/i.test(error.message || '') ||
        /Could not find the.*column/i.test(error.message || '')
    );

    if (isColumnError) {
        console.warn('updateShop: Missing column detected, retrying with fallbacks. Error:', error);

        // STAGE 2: Try without Route/Village, but WITH Timestamps
        const { village, route_id, ...fallbackPayload2 } = payload as any;
        console.log('updateShop: Fallback Stage 2:', fallbackPayload2);

        const { data: data2, error: error2 } = await supabase
            .from('shops')
            .update(fallbackPayload2)
            .eq('id', id)
            .select()
            .single();
        if (!error2 && data2) return data2 as Shop;

        // Check for timestamp errors
        const isTimestampError = error2 && (
            error2.code === '42703' ||
            error2.code === 'PGRST204' ||
            /column/i.test(error2.message || '')
        );

        if (isTimestampError) {
            // STAGE 3: Try without UpdatedAt
            const { updated_at, ...fallbackPayload3 } = fallbackPayload2;
            console.log('updateShop: Fallback Stage 3:', fallbackPayload3);
            const { data: data3, error: error3 } = await supabase
                .from('shops')
                .update(fallbackPayload3)
                .eq('id', id)
                .select()
                .single();

            if (!error3 && data3) return data3 as Shop;

            // STAGE 4: Minimal
            const { created_at, ...minimalPayload } = fallbackPayload3;
            console.log('updateShop: Fallback Stage 4:', minimalPayload);
            const { data: data4, error: error4 } = await supabase
                .from('shops')
                .update(minimalPayload)
                .eq('id', id)
                .select()
                .single();

            if (!error4 && data4) return data4 as Shop;

            if (error4) {
                console.error('updateShop: All fallbacks failed:', error4);
                throw new Error('Failed to update shop. Please try again.');
            }
        } else if (error2) {
            console.error('updateShop: Fallback failed:', error2);
            throw new Error('Failed to update shop. Please try again.');
        }
    }
    if (error) {
        console.error('updateShop: Error updating shop:', error);
        throw new Error('Failed to update shop. Please try again.');
    }
    return data as Shop;
};

export const getShopSuggestions = async (query: string): Promise<Shop[]> => {
    const q = query?.trim();
    if (!q) return [];
    const { data, error } = await supabase
        .from('shops')
        .select('*')
        .ilike('name', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) {
        console.error('Error fetching shop suggestions:', error);
        return [];
    }
    return data || [];
};

export const getShopSuggestionsByVillage = async (query: string): Promise<Shop[]> => {
    const q = query?.trim();
    if (!q) return [];
    const { data, error } = await supabase
        .from('shops')
        .select('*')
        .ilike('village', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) {
        console.error('Error fetching village suggestions:', error);
        return [];
    }
    return data || [];
};

/**
 * Search shops from both sales table (shop_name) and shops table
 * Returns combined suggestions with shop info
 */
export const searchShops = async (query: string, village?: string): Promise<Array<{ name: string; phone?: string; village?: string }>> => {
    const q = query?.trim();
    if (!q || q.length < 2) return [];

    const results: Array<{ name: string; phone?: string; village?: string }> = [];
    const seenNames = new Set<string>();

    try {
        // Get shop names from sales table
        const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('shop_name')
            .ilike('shop_name', `%${q}%`)
            .limit(20);

        if (!salesError && salesData) {
            salesData.forEach((sale: any) => {
                const name = sale.shop_name?.trim();
                if (name && !seenNames.has(name.toLowerCase())) {
                    seenNames.add(name.toLowerCase());
                    results.push({ name });
                }
            });
        }

        // Get shops from shops table
        let shopsQuery = supabase
            .from('shops')
            .select('name, phone, village')
            .ilike('name', `%${q}%`)
            .limit(20);

        if (village && village.trim()) {
            shopsQuery = shopsQuery.ilike('village', `%${village.trim()}%`);
        }

        const { data: shopsData, error: shopsError } = await shopsQuery;

        if (!shopsError && shopsData) {
            shopsData.forEach((shop: any) => {
                const name = shop.name?.trim();
                if (name && !seenNames.has(name.toLowerCase())) {
                    seenNames.add(name.toLowerCase());
                    results.push({
                        name,
                        phone: shop.phone || undefined,
                        village: shop.village || undefined,
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error searching shops:', error);
    }

    return results.slice(0, 20);
};

/**
 * Insert shop if it doesn't exist, or return existing shop
 */
export const insertShopIfNotExists = async (name: string, phone?: string, village?: string): Promise<Shop | null> => {
    try {
        return await createShop({ name, phone, village });
    } catch (error) {
        console.error('Error inserting shop:', error);
        return null;
    }
};

export const ensureShopExists = async (
    name: string,
    phone?: string,
    address?: string,
    routeId?: string,
    village?: string
): Promise<string> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new Error('Shop name cannot be empty');
    }

    // Try to find an existing shop with the same name
    // We try to select id first, and handle other columns carefully
    let existingShop: any = null;
    try {
        const { data, error } = await supabase
            .from('shops')
            .select('id, phone, address')
            .eq('name', trimmedName)
            .maybeSingle();

        if (!error && data) {
            existingShop = data;
            // Try to get village separately in case it doesn't exist
            try {
                const { data: vData } = await supabase.from('shops').select('village').eq('id', data.id).single();
                if (vData) existingShop.village = vData.village;
            } catch (ve) { }
        }
    } catch (e) {
        console.error('Error checking for existing shop:', e);
    }

    if (existingShop) {
        // Shop exists, check if we need to update it with missing details
        const updates: any = {};
        if (phone && !existingShop.phone) updates.phone = phone;
        if (address && !existingShop.address) updates.address = address;

        // Only update village if we have it and it's missing
        if (village && !existingShop.village) {
            try {
                await supabase.from('shops').update({ village }).eq('id', existingShop.id);
            } catch (ve) {
                // If village column doesn't exist, this will fail silently
            }
        }

        if (Object.keys(updates).length > 0) {
            await supabase.from('shops').update(updates).eq('id', existingShop.id);
        }

        return existingShop.id;
    }

    // If shop does not exist, create it
    const now = new Date().toISOString();
    const payload: any = {
        name: trimmedName,
        phone: phone || null,
        address: address || null,
        route_id: routeId || null,
        created_at: now,
        updated_at: now,
    };

    // Try to include village
    const payloadWithVillage = { ...payload, village: village || null };

    try {
        console.log('ensureShopExists: Attempting to create shop with payload:', payloadWithVillage);
        const { data, error } = await supabase
            .from('shops')
            .insert(payloadWithVillage)
            .select('id')
            .single();

        if (!error && data) return data.id;

        console.error('ensureShopExists: Initial insert failed:', error);

        // Check for missing column errors (village or route_id)
        // Expanded check to catch any PGRST error or 42* code that mentions columns
        const isColumnError = error && (
            error.code === '42703' ||
            error.code === 'PGRST204' ||
            /column.*(village|route_id)/i.test(error.message || '') ||
            /Could not find the.*column/i.test(error.message || '')
        );

        if (isColumnError) {
            console.log('ensureShopExists: Detected missing column error, attempting fallback sequence');

            // STAGE 2: Try without Route/Village, but WITH Timestamps
            const fallbackPayload2 = {
                name: trimmedName,
                phone: phone || null,
                address: address || null,
                created_at: now,
                updated_at: now,
            };

            console.log('ensureShopExists: Fallback Stage 2 (No Route/Village, With Timestamps):', fallbackPayload2);
            const { data: data2, error: error2 } = await supabase
                .from('shops')
                .insert(fallbackPayload2)
                .select('id')
                .single();

            if (!error2 && data2) return data2.id;

            // Check if error2 is about updated_at or created_at
            // Broader check: if it's a schema/column error, try next stage
            const isTimestampError = error2 && (
                error2.code === '42703' ||
                error2.code === 'PGRST204' ||
                /column/i.test(error2.message || '')
            );

            if (isTimestampError) {
                console.log('ensureShopExists: Timestamp column missing, trying fallback Stage 3');

                // STAGE 3: Try without UpdatedAt, but WITH CreatedAt
                const fallbackPayload3 = {
                    name: trimmedName,
                    phone: phone || null,
                    address: address || null,
                    created_at: now,
                };
                console.log('ensureShopExists: Fallback Stage 3 (No UpdatedAt, With CreatedAt):', fallbackPayload3);
                const { data: data3, error: error3 } = await supabase
                    .from('shops')
                    .insert(fallbackPayload3)
                    .select('id')
                    .single();

                if (!error3 && data3) return data3.id;

                // If Stage 3 failed, check if it's because of created_at
                const isCreatedAtError = error3 && (
                    error3.code === '42703' ||
                    error3.code === 'PGRST204' ||
                    /column/i.test(error3.message || '')
                );

                if (isCreatedAtError || error3) {
                    // STAGE 4: Minimal (No Timestamps)
                    // If Stage 3 failed, try bare minimum
                    const minimalPayload = {
                        name: trimmedName,
                        phone: phone || null,
                        address: address || null,
                    };
                    console.log('ensureShopExists: Fallback Stage 4 (Minimal):', minimalPayload);
                    const { data: data4, error: error4 } = await supabase
                        .from('shops')
                        .insert(minimalPayload)
                        .select('id')
                        .single();

                    console.log('ensureShopExists: Stage 4 result:', { data4, error4 });

                    if (!error4 && data4) return data4.id;

                    if (error4) {
                        console.error('ensureShopExists: All fallbacks failed. Last error:', error4);
                        throw error4;
                    }
                }
            } else if (error2) {
                console.error('ensureShopExists: Fallback Stage 2 failed:', error2);
                throw error2;
            }
        } else if (error) {
            throw error;
        }
    } catch (e) {
        console.error('ensureShopExists: Unexpected error:', e);
        throw new Error('Failed to create shop');
    }

    throw new Error('Failed to create shop');
};

/**
 * Sync missing shops from sales history
 * Scans all sales and ensures a corresponding shop record exists
 */
export const syncMissingShops = async (): Promise<{ total: number; fixed: number }> => {
    console.log('Starting shop sync...');

    // Log current session for debugging RLS
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('syncMissingShops: Current user:', sessionData?.session?.user?.id || 'No user');
    console.log('syncMissingShops: Current role:', sessionData?.session?.user?.role || 'No role');

    const { data: sales, error } = await supabase
        .from('sales')
        .select('*')
        .is('shop_id', null); // Only check sales missing shop_id link

    if (error) {
        console.error('Error fetching sales for sync:', error);
        throw new Error('Failed to fetch sales history');
    }

    if (!sales || sales.length === 0) {
        console.log('No sales found without shop_id');
        return { total: 0, fixed: 0 };
    }

    console.log(`Found ${sales.length} sales without shop_id`);
    let fixedCount = 0;

    for (const sale of sales) {
        try {
            // Extract shop info
            const shopName = sale.shop_name;
            let shopPhone: string | undefined;
            let shopAddress: string | undefined;
            let village: string | undefined;

            if (sale.products_sold && !Array.isArray(sale.products_sold)) {
                shopPhone = sale.products_sold.shop_phone;
                shopAddress = sale.products_sold.shop_address;
                village = sale.products_sold.village;
            }

            if (!shopName) {
                console.log(`Sale ${sale.id} has no shop_name, skipping`);
                continue;
            }

            console.log(`Syncing shop: "${shopName}" for sale ${sale.id}`);

            // Create/Find shop
            // We pass route_id from the sale to ensure correct association
            const shopId = await ensureShopExists(
                shopName,
                shopPhone,
                shopAddress,
                sale.route_id,
                village
            );

            if (shopId) {
                console.log(`Linking sale ${sale.id} to shopId ${shopId}`);
                // Update sale with shop_id
                const { error: updateError } = await supabase
                    .from('sales')
                    .update({ shop_id: shopId })
                    .eq('id', sale.id);

                if (!updateError) {
                    fixedCount++;
                } else {
                    console.error(`Failed to update sale ${sale.id} with shopId ${shopId}:`, updateError);
                }
            }
        } catch (e) {
            console.error(`Failed to sync shop for sale ${sale.id}:`, e);
        }
    }

    console.log(`Sync complete. Fixed ${fixedCount} out of ${sales.length} sales.`);
    return { total: sales.length, fixed: fixedCount };
};

/**
 * Save sale with products_sold format: [{ productId, boxQty, pcsQty, totalAmount }]
 */
export const saveSale = async (salePayload: {
    route_id: string;
    truck_id: string | null;
    shop_name: string;
    date: string;
    products_sold: any;
    total_amount: number;
}): Promise<Sale> => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user?.id || null;

    // Extract shop details from products_sold if available
    // products_sold can be array or object { items, shop_address, shop_phone, village }
    let shopPhone: string | undefined;
    let shopAddress: string | undefined;
    let village: string | undefined;

    if (salePayload.products_sold && !Array.isArray(salePayload.products_sold)) {
        shopPhone = salePayload.products_sold.shop_phone;
        shopAddress = salePayload.products_sold.shop_address;
        village = salePayload.products_sold.village;
    }

    // Ensure shop exists and get ID
    let shopId: string | null = null;
    try {
        shopId = await ensureShopExists(
            salePayload.shop_name,
            shopPhone,
            shopAddress,
            salePayload.route_id,
            village
        );
    } catch (e) {
        console.error("Failed to ensure shop exists, proceeding without shop_id:", e);
    }

    const payload = {
        route_id: salePayload.route_id,
        truck_id: salePayload.truck_id,
        shop_name: salePayload.shop_name,
        date: salePayload.date,
        products_sold: salePayload.products_sold,
        total_amount: salePayload.total_amount,
        auth_user_id: uid,
        shop_id: shopId, // Link to shops table
    } as any;
    console.log(
        "saveSale insert payload:",
        JSON.stringify(payload, null, 2)
    );
    const { data, error } = await supabase
        .from('sales')
        .insert(payload)
        .select()
        .single();
    console.log("saveSale result:", { data, error });

    if (error) {
        console.error('Error saving sale:', error);
        throw new Error('Failed to save sale. Please try again.');
    }

    return data;
};

export const saveSaleWithInvoice = async (salePayload: {
    route_id: string;
    truck_id: string | null;
    shop_name: string;
    date: string;
    products_sold: any;
    total_amount: number;
    route_code: string;
}): Promise<Sale> => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user?.id || null;

    // Extract shop details from products_sold if available
    let shopPhone: string | undefined;
    let shopAddress: string | undefined;
    let village: string | undefined;

    if (salePayload.products_sold && !Array.isArray(salePayload.products_sold)) {
        shopPhone = salePayload.products_sold.shop_phone;
        shopAddress = salePayload.products_sold.shop_address;
        village = salePayload.products_sold.village;
    }

    // Ensure shop exists and get ID
    let shopId: string | null = null;
    try {
        shopId = await ensureShopExists(
            salePayload.shop_name,
            shopPhone,
            shopAddress,
            salePayload.route_id,
            village
        );
    } catch (e) {
        console.error("Failed to ensure shop exists, proceeding without shop_id:", e);
    }

    const yymmdd = (() => {
        const [y, m, d] = salePayload.date.split('-');
        return `${y.slice(-2)}${m}${d}`;
    })();
    const prefix = `FS-${salePayload.route_code}-${yymmdd}-`;
    let attempt = 0;
    while (attempt < 5) {
        attempt += 1;
        const { data: latestRows, error: latestErr } = await supabase
            .from('sales')
            .select('invoice_no')
            .ilike('invoice_no', `${prefix}%`)
            .order('invoice_no', { ascending: false })
            .limit(1);
        if (latestErr) {
            console.error('Error checking latest invoice:', latestErr);
            throw new Error('Failed to generate invoice number');
        }
        const latest = (latestRows || [])[0]?.invoice_no as string | undefined;
        const nextSeq = (() => {
            const last = latest ? latest.split('-').pop() || '' : '';
            const n = Number(last) || 0;
            const next = n + 1;
            return String(next).padStart(4, '0');
        })();
        const invoice_no = `${prefix}${nextSeq}`;
        const payload = {
            route_id: salePayload.route_id,
            truck_id: salePayload.truck_id,
            shop_name: salePayload.shop_name,
            date: salePayload.date,
            products_sold: salePayload.products_sold,
            total_amount: salePayload.total_amount,
            auth_user_id: uid,
            invoice_no,
            shop_id: shopId,
        } as any;
        const { data, error } = await supabase
            .from('sales')
            .insert(payload)
            .select()
            .single();
        if (error && error.code === '23505') {
            continue;
        }
        if (error) {
            console.error('Error saving sale with invoice:', error);
            throw new Error('Failed to save sale. Please try again.');
        }
        return data;
    }
    throw new Error('Failed to generate unique invoice after retries');
};

/**
 * Update daily stock after sale by deducting sold quantities
 */
export const updateDailyStockAfterSale = async (
    routeId: string,
    truckId: string,
    date: string,
    soldItems: Array<{ productId: string; boxQty: number; pcsQty: number }>,
    products: Product[]
): Promise<void> => {
    // Get current stock
    const currentStock = await getDailyStockForRouteTruckDate(routeId, truckId, date);

    if (!currentStock || currentStock.length === 0) {
        throw new Error('No stock found for this route/truck/date');
    }

    // Create product map for pcs_per_box lookup
    const productMap = new Map<string, number>();
    products.forEach(p => {
        productMap.set(p.id, p.pcs_per_box || 24);
    });

    // Create a map of current stock
    const stockMap = new Map<string, DailyStockItem>();
    currentStock.forEach(item => {
        stockMap.set(item.productId, { ...item });
    });

    // Deduct sold items
    soldItems.forEach(sold => {
        const current = stockMap.get(sold.productId);
        if (current) {
            // Get pcs_per_box for this product
            const pcsPerBox = productMap.get(sold.productId) || 24;

            // Convert to total PCS, deduct, then convert back
            const currentTotalPcs = (current.boxQty * pcsPerBox) + current.pcsQty;
            const soldTotalPcs = (sold.boxQty * pcsPerBox) + sold.pcsQty;
            const remainingTotalPcs = Math.max(0, currentTotalPcs - soldTotalPcs);

            stockMap.set(sold.productId, {
                productId: sold.productId,
                boxQty: Math.floor(remainingTotalPcs / pcsPerBox),
                pcsQty: remainingTotalPcs % pcsPerBox,
            });
        }
    });

    // Convert map back to array
    const updatedStock: DailyStockPayload = Array.from(stockMap.values());

    // Save updated stock
    await saveDailyStock(routeId, truckId, date, updatedStock);
};

/**
 * Update daily stock for a specific driver (or truck if driver not present)
 */
export const updateDriverStockAfterSale = async (
    driverId: string | null,
    routeId: string,
    truckId: string | null,
    date: string,
    soldItems: Array<{ productId: string; boxQty: number; pcsQty: number }>,
    products: Product[]
): Promise<void> => {
    console.log("updateDriverStockAfterSale", { driverId, routeId, truckId, date });

    // 1. Find the stock record
    let query = supabase
        .from('daily_stock')
        .select('*')
        .eq('route_id', routeId)
        .eq('date', date);

    if (driverId) {
        query = query.eq('auth_user_id', driverId);
    } else if (truckId) {
        query = query.eq('truck_id', truckId).is('auth_user_id', null);
    } else {
        throw new Error("Cannot identify stock record: missing driverId and truckId");
    }

    const { data: stockRows, error: fetchError } = await query;

    if (fetchError) {
        console.error("Error fetching stock for update:", fetchError);
        throw new Error("Failed to fetch stock for update");
    }

    if (!stockRows || stockRows.length === 0) {
        // Fallback: If we have driverId but no driver-specific row found, 
        // maybe the stock is still unassigned (auth_user_id IS NULL)?
        // But the driver should have claimed it. 
        // If we are here, it means we can't find the row.
        // Let's try to find ANY row for this route/date if we have truckId?
        if (driverId && truckId) {
            console.log("No driver-specific stock found, checking for unassigned stock with truckId...");
            const { data: unassignedRows } = await supabase
                .from('daily_stock')
                .select('*')
                .eq('route_id', routeId)
                .eq('date', date)
                .eq('truck_id', truckId)
                .is('auth_user_id', null);

            if (unassignedRows && unassignedRows.length > 0) {
                // We found unassigned stock. We should probably update THIS row.
                // Note: Ideally we should also claim it (set auth_user_id), but for now just update stock.
                // We will proceed with this row.
                stockRows?.push(unassignedRows[0]);
            } else {
                console.error("No stock record found for update (checked driver and unassigned)", { driverId, routeId, truckId, date });
                throw new Error("No stock record found to update");
            }
        } else {
            console.error("No stock record found for update", { driverId, routeId, truckId, date });
            throw new Error("No stock record found to update");
        }
    }

    // Assuming we update the first matching row (should be unique per driver/route/date)
    // If we pushed a fallback row, stockRows now has length 1.
    if (!stockRows || stockRows.length === 0) { // Double check
        throw new Error("No stock record found to update");
    }

    const stockRow = stockRows[0];
    const currentStock = Array.isArray(stockRow.stock) ? stockRow.stock : [];

    // 2. Calculate new stock
    // Create product map for pcs_per_box lookup
    const productMap = new Map<string, number>();
    products.forEach(p => {
        productMap.set(p.id, p.pcs_per_box || 24);
    });

    // Create a map of current stock
    const stockMap = new Map<string, DailyStockItem>();
    currentStock.forEach((item: any) => {
        stockMap.set(item.productId, { ...item });
    });

    // Deduct sold items
    soldItems.forEach(sold => {
        const current = stockMap.get(sold.productId);
        if (current) {
            const pcsPerBox = productMap.get(sold.productId) || 24;
            const currentTotalPcs = (current.boxQty * pcsPerBox) + current.pcsQty;
            const soldTotalPcs = (sold.boxQty * pcsPerBox) + sold.pcsQty;
            const remainingTotalPcs = Math.max(0, currentTotalPcs - soldTotalPcs);

            stockMap.set(sold.productId, {
                productId: sold.productId,
                boxQty: Math.floor(remainingTotalPcs / pcsPerBox),
                pcsQty: remainingTotalPcs % pcsPerBox,
            });
        }
    });

    const updatedStock = Array.from(stockMap.values());

    // 3. Update the record
    const { error: updateError } = await supabase
        .from('daily_stock')
        .update({ stock: updatedStock })
        .eq('id', stockRow.id);

    if (updateError) {
        console.error("Error updating stock record:", updateError);
        throw new Error("Failed to update stock record");
    }
};

/**
 * Get driver's active route for today (from localStorage or default)
 */
export const getDriverRoute = async (): Promise<{ routeId: string; truckId: string; date: string } | null> => {
    const routeId = localStorage.getItem('currentRoute') || localStorage.getItem('fs_last_route');
    const truckId = localStorage.getItem('currentTruck') || localStorage.getItem('fs_last_truck');
    const date = localStorage.getItem('currentDate') || localStorage.getItem('fs_last_date') || format(new Date(), "yyyy-MM-dd");

    if (!routeId || !truckId) {
        return null;
    }

    return { routeId, truckId, date };
};

/**
 * Get daily stock for route and date (simplified version)
 */
export const getDailyStockForBilling = async (
    routeId: string,
    truckId: string,
    date: string
): Promise<Array<{ product: Product; stock: DailyStockItem }>> => {
    const stockData = await getDailyStockForRouteTruckDate(routeId, truckId, date);
    if (!stockData || stockData.length === 0) {
        return [];
    }

    // Get all products
    const products = await getProducts();
    const productMap = new Map(products.map(p => [p.id, p]));

    // Combine products with stock
    return stockData
        .filter(item => (item.boxQty || 0) > 0 || (item.pcsQty || 0) > 0)
        .map(item => {
            const product = productMap.get(item.productId);
            if (!product) return null;
            return { product, stock: item };
        })
        .filter((item): item is { product: Product; stock: DailyStockItem } => item !== null);
};

/**
 * Search products from today's assigned stock
 */
export const searchProductsInStock = async (
    routeId: string,
    truckId: string,
    date: string,
    query: string
): Promise<Array<{ product: Product; stock: DailyStockItem }>> => {
    const allStock = await getDailyStockForBilling(routeId, truckId, date);
    if (!query.trim()) {
        return allStock;
    }

    const q = query.toLowerCase();
    return allStock.filter(({ product }) =>
        product.name.toLowerCase().includes(q)
    );
};

export const getAssignedStockForBilling = async (
    driverId: string | null,
    routeId: string,
    date: string
): Promise<Array<{ product: Product; stock: DailyStockItem }>> => {
    console.log(`DEBUG: getAssignedStockForBilling called with driverId=${driverId}, routeId=${routeId}, date=${date}`);
    // Get stock for the route regardless of whether it's been started or not
    // When driverId is null (driver portal), we query for route-based stock
    // This should work both before route start (truck_id NULL) and after (truck_id NOT NULL)
    let stockData: DailyStockPayload | null = null;

    if (driverId === null) {
        // Driver portal: query stock for route
        // We filter by route_id and date. 
        // We do NOT filter by auth_user_id IS NULL because we want to see the stock
        // even after the driver has claimed it (when auth_user_id becomes the driver's ID).
        const { data, error } = await supabase
            .from('daily_stock')
            .select('stock, truck_id, auth_user_id')
            .eq('route_id', routeId)
            .eq('date', date);

        if (error) {
            console.error('Error fetching assigned stock:', error);
            return [];
        }

        console.log(`DEBUG: getAssignedStockForBilling found ${data?.length || 0} rows`);
        if (data && data.length > 0) {
            console.log('DEBUG: rows:', data);
            // Aggregate stock from all rows (e.g. different trucks or null truck)
            // If multiple rows exist, we merge their stock items
            const allItems: DailyStockItem[] = [];
            data.forEach(row => {
                if (Array.isArray(row.stock)) {
                    allItems.push(...(row.stock as DailyStockItem[]));
                }
            });

            // Consolidate items by productId
            const mergedMap = new Map<string, DailyStockItem>();
            allItems.forEach(item => {
                const existing = mergedMap.get(item.productId);
                if (existing) {
                    existing.boxQty += (item.boxQty || 0);
                    existing.pcsQty += (item.pcsQty || 0);
                } else {
                    mergedMap.set(item.productId, { ...item });
                }
            });

            stockData = Array.from(mergedMap.values());
        } else {
            stockData = [];
        }
    } else {
        // Admin portal: query driver-specific stock
        const { data, error } = await supabase
            .from('daily_stock')
            .select('stock')
            .eq('route_id', routeId)
            .eq('date', date)
            .eq('auth_user_id', driverId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching driver-assigned stock:', error);
            return [];
        }

        stockData = data?.stock as DailyStockPayload || null;
    }

    if (!stockData || stockData.length === 0) {
        console.log('DEBUG: No stock data found or empty');
        return [];
    }

    const products = await getProducts();
    const pmap = new Map(products.map(p => [p.id, p]));

    return stockData.map(item => {
        const p = pmap.get(item.productId);
        if (!p) return null as any;
        return {
            product: p,
            stock: {
                productId: item.productId,
                boxQty: item.boxQty || 0,
                pcsQty: item.pcsQty || 0
            }
        };
    }).filter(Boolean);
};

export const searchAssignedProductsInStock = async (
    driverId: string | null,
    routeId: string,
    date: string,
    query: string
): Promise<Array<{ product: Product; stock: DailyStockItem }>> => {
    const all = await getAssignedStockForBilling(driverId, routeId, date);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(({ product }) => product.name.toLowerCase().includes(q));
};


/**
 * Save bill to bills table
 */
export interface BillItem {
    productId: string;
    productName: string;
    boxQty: number;
    pcsQty: number;
    rate: number;
    amount: number;
}

export interface Bill {
    id: string;
    auth_user_id: string | null;
    shop_id: string;
    route_id: string;
    date: string;
    items: BillItem[];
    total_amount: number;
    created_at: string;
}

export const saveBill = async (
    shopId: string,
    routeId: string,
    items: BillItem[],
    totalAmount: number,
    date: string
): Promise<Bill> => {
    // Check if bills table exists, if not use sales table as fallback
    try {
        const { data, error } = await supabase
            .from('bills')
            .insert({
                auth_user_id: null, // No authentication
                shop_id: shopId,
                route_id: routeId,
                date,
                items,
                total_amount: totalAmount,
            })
            .select()
            .single();

        if (error) {
            // If bills table doesn't exist, fallback to sales table
            const isMissingTable =
                error.code === '42P01' ||
                error.code === 'PGRST205' ||
                /Could not find the table 'public\.bills'/i.test(error.message || '');
            if (isMissingTable) {
                // Table doesn't exist, use sales table
                const shop = await supabase
                    .from('shops')
                    .select('name')
                    .eq('id', shopId)
                    .single();

                const shopName = shop.data?.name || 'Unknown Shop';

                await saveSale({
                    route_id: routeId,
                    truck_id: '', // Will be set from localStorage
                    shop_name: shopName,
                    date,
                    products_sold: items.map(item => ({
                        productId: item.productId,
                        boxQty: item.boxQty,
                        pcsQty: item.pcsQty,
                        totalAmount: item.amount,
                    })),
                    total_amount: totalAmount,
                });

                // Return a mock bill object
                return {
                    id: '',
                    auth_user_id: null,
                    shop_id: shopId,
                    route_id: routeId,
                    date,
                    items,
                    total_amount: totalAmount,
                    created_at: new Date().toISOString(),
                };
            }
            throw error;
        }

        return data as Bill;
    } catch (error: any) {
        console.error('Error saving bill:', error);
        throw new Error('Failed to save bill. Please try again.');
    }
};

/**
 * Reduce daily stock after sale
 */
export const reduceDailyStock = async (
    routeId: string,
    truckId: string,
    date: string,
    items: Array<{ productId: string; boxQty: number; pcsQty: number }>,
    products: Product[]
): Promise<void> => {
    await updateDailyStockAfterSale(routeId, truckId, date, items, products);
};

/**
 * Save shop bill to shop_bills table
 */
export interface ShopBillItem {
    productId: string;
    productName: string;
    boxQty: number;
    pcsQty: number;
    pricePerBox: number;
    pricePerPcs: number;
    amount: number;
}

export interface ShopBill {
    id: string;
    route_id: string;
    truck_id: string;
    shop_name: string;
    shop_address?: string | null;
    shop_phone?: string | null;
    date: string;
    items: ShopBillItem[];
    total_amount: number;
    created_at: string;
}

export const saveShopBill = async (
    routeId: string,
    truckId: string,
    shopData: {
        name: string;
        address?: string;
        phone?: string;
    },
    billItems: ShopBillItem[],
    totalAmount: number,
    date: string
): Promise<ShopBill> => {
    // Check if shop_bills table exists, if not use bills or sales table as fallback
    try {
        const { data, error } = await supabase
            .from('shop_bills')
            .insert({
                route_id: routeId,
                truck_id: truckId,
                shop_name: shopData.name.trim(),
                shop_address: shopData.address?.trim() || null,
                shop_phone: shopData.phone?.trim() || null,
                date,
                items: billItems,
                total_amount: totalAmount,
                auth_user_id: null, // No authentication
            })
            .select()
            .single();

        if (error) {
            // If shop_bills table doesn't exist, try bills table
            const isMissingTable =
                error.code === '42P01' || // PostgreSQL undefined table
                error.code === 'PGRST205' || // PostgREST schema cache missing table
                /Could not find the table 'public\.shop_bills'/i.test(error.message || '');
            if (isMissingTable) {
                return await saveBill(
                    '', // shopId not needed for bills table
                    routeId,
                    billItems.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        boxQty: item.boxQty,
                        pcsQty: item.pcsQty,
                        rate: item.boxQty > 0 ? item.pricePerBox : item.pricePerPcs,
                        amount: item.amount,
                    })),
                    totalAmount,
                    date
                ) as any;
            }
            throw error;
        }

        return data as ShopBill;
    } catch (error: any) {
        console.error('Error saving shop bill:', error);
        // Fallback to bills table
        try {
            await saveBill(
                '',
                routeId,
                billItems.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    boxQty: item.boxQty,
                    pcsQty: item.pcsQty,
                    rate: item.boxQty > 0 ? item.pricePerBox : item.pricePerPcs,
                    amount: item.amount,
                })),
                totalAmount,
                date
            );
            // Return mock object
            return {
                id: '',
                route_id: routeId,
                truck_id: truckId,
                shop_name: shopData.name,
                shop_address: shopData.address || null,
                shop_phone: shopData.phone || null,
                date,
                items: billItems,
                total_amount: totalAmount,
                created_at: new Date().toISOString(),
            };
        } catch (fallbackError: any) {
            throw new Error('Failed to save bill. Please try again.');
        }
    }
};

// Expenses
export interface Expense {
    id: string;
    category: string;
    amount: number;
    date: string;
    note?: string | null;
    created_at: string;
    updated_at: string;
    auth_user_id: string;
}

export interface ExpenseMovement {
    id: string;
    expense_id: string;
    action: 'create' | 'update' | 'delete';
    changes: any;
    created_at: string;
    auth_user_id: string | null;
}

export const getExpenses = async (
    dateFrom?: string,
    dateTo?: string,
    search?: string,
    category?: string
): Promise<Expense[]> => {
    let query = supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (dateFrom && dateFrom.trim()) {
        query = query.gte('date', dateFrom.trim());
    }
    if (dateTo && dateTo.trim()) {
        query = query.lte('date', dateTo.trim());
    }
    if (category && category.trim()) {
        query = query.eq('category', category.trim());
    }
    if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`note.ilike.%${s}%,category.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching expenses:', error);
        throw new Error('Failed to fetch expenses. Please try again.');
    }
    return data || [];
};

export const addExpense = async (input: {
    category: string;
    amount: number;
    date?: string;
    note?: string;
}): Promise<Expense> => {
    const category = (input.category || '').trim();
    const amount = Number(input.amount);
    if (!category) throw new Error('Please select a valid category');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount cannot be negative');
    const date = (input.date || new Date().toISOString().split('T')[0]).trim();
    const now = new Date().toISOString();
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user?.id || null;
    const payload = {
        category,
        amount,
        date,
        note: input.note?.trim() || null,
        created_at: now,
        updated_at: now,
        auth_user_id: uid,
    } as any;

    const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select('*')
        .single();
    if (error && (error.code === '42703' || /column\s+.*\s+does\s+not\s+exist/i.test(error.message || ''))) {
        const { auth_user_id, created_at, updated_at, ...without } = payload as Record<string, unknown>;
        const { data: data2, error: err2 } = await supabase
            .from('expenses')
            .insert(without)
            .select('*')
            .single();
        if (err2) {
            console.error('Error adding expense (fallback):', err2);
            throw new Error('Failed to save expense, try again');
        }
        const exp2 = data2 as Expense;
        try {
            await supabase.from('expense_movements').insert({ expense_id: exp2.id, action: 'create', changes: payload, auth_user_id: uid });
        } catch (e) {
            console.error('Error logging expense movement:', e);
        }
        return exp2;
    }
    if (error) {
        console.error('Error adding expense:', error);
        throw new Error('Failed to save expense, try again');
    }
    const exp = data as Expense;
    try {
        await supabase.from('expense_movements').insert({ expense_id: exp.id, action: 'create', changes: payload, auth_user_id: uid });
    } catch (e) {
        console.error('Error logging expense movement:', e);
    }
    return exp;
};

export const updateExpense = async (
    id: string,
    update: {
        category?: string;
        amount?: number;
        date?: string;
        note?: string | null;
    }
): Promise<Expense> => {
    const payload: any = { updated_at: new Date().toISOString() };
    if (typeof update.category === 'string') payload.category = update.category.trim();
    if (typeof update.amount !== 'undefined') payload.amount = Number(update.amount);
    if (typeof update.date === 'string') payload.date = update.date.trim();
    if (typeof update.note !== 'undefined') payload.note = update.note ? String(update.note).trim() : null;

    if (typeof payload.amount !== 'undefined') {
        const amt = Number(payload.amount);
        if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount cannot be negative');
    }
    if (typeof payload.category !== 'undefined') {
        if (!payload.category) throw new Error('Please select a valid category');
    }

    const { data, error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
    if (error) {
        console.error('Error updating expense:', error);
        throw new Error('Failed to save expense, try again');
    }
    const exp = data as Expense;
    try {
        const { data: session } = await supabase.auth.getSession();
        const uid = session?.session?.user?.id || null;
        await supabase.from('expense_movements').insert({ expense_id: id, action: 'update', changes: payload, auth_user_id: uid });
    } catch (e) {
        console.error('Error logging expense movement:', e);
    }
    return exp;
};

export const deleteExpense = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
    if (error) {
        console.error('Error deleting expense:', error);
        throw new Error('Failed to delete expense. Please try again.');
    }
    try {
        const { data: session } = await supabase.auth.getSession();
        const uid = session?.session?.user?.id || null;
        await supabase.from('expense_movements').insert({ expense_id: id, action: 'delete', changes: {}, auth_user_id: uid });
    } catch (e) {
        console.error('Error logging expense movement:', e);
    }
};

export const getExpenseSummary = async (): Promise<{
    today_total: number;
    month_total: number;
    month_by_category: Array<{ category: string; total: number }>;
}> => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const firstDayStr = `${yyyy}-${mm}-01`;

    const monthly = await getExpenses(firstDayStr, todayStr);
    const todayTotal = monthly.filter(e => e.date === todayStr).reduce((sum, e) => sum + (e.amount || 0), 0);
    const monthTotal = monthly.reduce((sum, e) => sum + (e.amount || 0), 0);
    const byCatMap = new Map<string, number>();
    monthly.forEach(e => {
        const key = e.category || 'Misc';
        byCatMap.set(key, (byCatMap.get(key) || 0) + (e.amount || 0));
    });
    const breakdown = Array.from(byCatMap.entries()).map(([category, total]) => ({ category, total }));
    breakdown.sort((a, b) => b.total - a.total);
    return { today_total: todayTotal, month_total: monthTotal, month_by_category: breakdown };
};

export const assignStockRPC = async (
    driverId: string | null,
    routeId: string,
    date: string,
    items: Array<{ productId: string; boxQty?: number; pcsQty?: number; qty_pcs?: number }>
): Promise<void> => {
    const payload = items.map(it => ({
        productId: it.productId,
        boxQty: it.boxQty || 0,
        pcsQty: it.pcsQty || 0,
        qty_pcs: it.qty_pcs || undefined,
    }));
    const { error } = await supabase.rpc('fn_assign_stock', {
        p_driver_id: driverId,
        p_route_id: routeId,
        p_work_date: date,
        items: payload,
    });
    if (error) {
        throw new Error(error.message || 'Failed to assign stock');
    }
};

export const getDriverAssignedStock = async (
    driverId: string,
    routeId: string,
    date: string
): Promise<AssignedStockRow[]> => {
    const { data, error } = await supabase.rpc('fn_get_driver_assigned_stock', {
        driver_id: driverId,
        route_id: routeId,
        work_date: date,
    });
    if (error) {
        throw new Error(error.message || 'Failed to fetch assigned stock');
    }
    return (data || []) as AssignedStockRow[];
};

export const getRouteAssignedStock = async (
    routeId: string,
    date: string
): Promise<AssignedStockRow[]> => {
    const { data, error } = await supabase.rpc('fn_get_route_assigned_stock', {
        route_id: routeId,
        work_date: date,
    });
    if (error) {
        throw new Error(error.message || 'Failed to fetch assigned stock');
    }
    return (data || []) as AssignedStockRow[];
};

export const updateStockAfterSaleRPC = async (
    driverId: string,
    routeId: string,
    date: string,
    saleItems: Array<{ productId: string; qty_pcs: number }>
): Promise<unknown> => {
    const items = saleItems.map(it => ({ productId: it.productId, qty_pcs: it.qty_pcs }));
    const { data, error } = await supabase.rpc('fn_update_stock_after_sale', {
        p_driver_id: driverId,
        p_route_id: routeId,
        p_work_date: date,
        sale_items: items,
    });
    if (error) {
        throw new Error(error.message || 'Failed to update stock after sale');
    }
    return data as unknown;
};

export const updateStockAfterSaleRouteRPC = async (
    routeId: string,
    date: string,
    saleItems: Array<{ productId: string; qty_pcs: number }>
): Promise<unknown> => {
    const items = saleItems.map(it => ({ productId: it.productId, qty_pcs: it.qty_pcs }));
    console.log('RPC CALL fn_update_stock_after_sale_route', {
        p_route_id: routeId,
        p_work_date: date,
        sale_items: items,
    });
    const { data, error } = await supabase.rpc('fn_update_stock_after_sale_route', {
        p_route_id: routeId,
        p_work_date: date,
        sale_items: items,
    });
    if (error) {
        console.error('RPC ERROR fn_update_stock_after_sale_route', {
            message: error.message,
            details: error,
            p_route_id: routeId,
            p_work_date: date,
            sale_items: items,
        });
        throw new Error(error.message || 'Failed to update stock after sale');
    }
    return data as unknown;
};

export const endRouteReturnStockRPC = async (
    driverId: string,
    routeId: string,
    date: string
): Promise<void> => {
    const { error } = await supabase.rpc('fn_end_route_return_stock', {
        p_driver_id: driverId,
        p_route_id: routeId,
        p_work_date: date,
    });
    if (error) {
        throw new Error(error.message || 'Failed to return stock to warehouse');
    }
};

export const endRouteReturnStockRouteRPC = async (
    routeId: string,
    date: string
): Promise<void> => {
    const { error } = await supabase.rpc('fn_end_route_return_stock_route', {
        p_route_id: routeId,
        p_work_date: date,
    });
    if (error) {
        throw new Error(error.message || 'Failed to return stock to warehouse');
    }
};

export const clearDailyStock = async (
    driverId: string | null,
    routeId: string,
    date: string
): Promise<void> => {
    let query = supabase
        .from('daily_stock')
        .update({ stock: [] })
        .eq('route_id', routeId)
        .eq('date', date);

    if (driverId) {
        query = query.eq('auth_user_id', driverId);
    }

    const { error } = await query;
    if (error) {
        console.error('Error clearing daily stock:', error);
        throw new Error('Failed to update route status');
    }
};

export const subscribeAssignedStockForDate = (
    driverId: string,
    routeId: string,
    date: string,
    onChange: () => void
): import('@supabase/supabase-js').RealtimeChannel => {
    const channel = supabase.channel(`assigned_stock_${driverId}_${routeId}_${date}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'assigned_stock',
            filter: `driver_id=eq.${driverId}`,
        }, payload => {
            const row = (payload.new || payload.old) as any;
            if (!row) return;
            if (String(row.route_id) === String(routeId) && String(row.date).startsWith(date)) {
                onChange();
            }
        })
        .subscribe();
    return channel;
};

export const subscribeAssignedStockForRouteDate = (
    routeId: string,
    date: string,
    onChange: () => void
): import('@supabase/supabase-js').RealtimeChannel => {
    const channel = supabase.channel(`assigned_stock_route_${routeId}_${date}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'assigned_stock',
            filter: `route_id=eq.${routeId}`,
        }, payload => {
            const row = (payload.new || payload.old) as any;
            if (!row) return;
            if (String(row.date).startsWith(date)) {
                onChange();
            }
        })
        .subscribe();
    return channel;
};

export const getExpenseMovements = async (
    expenseId?: string,
    limit: number = 50
): Promise<ExpenseMovement[]> => {
    let query = supabase
        .from('expense_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (expenseId) {
        query = query.eq('expense_id', expenseId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching expense movements:', error);
        throw new Error('Failed to fetch expense movements. Please try again.');
    }
    return data || [];
};




