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
    products_sold: any;
    total_amount?: number;
    created_at?: string;
    invoice_no?: string;
};

export type WarehouseStock = {
    id: string;
    product_id: string;
    product_name: string;
    box_price: number;
    pcs_price: number;
    pcs_per_box: number;
    boxes: number;
    pcs: number;
    created_at?: string;
    updated_at?: string;
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
    route_status?: 'not_started' | 'started';
}


/**
 * Check if a route has been started by a driver for a specific date
 * A route is considered started if there's a daily_stock record with truck_id NOT NULL
 */
export const isRouteStarted = async (
    routeId: string,
    date: string
): Promise<boolean> => {
    const { data } = await supabase
        .from('daily_stock')
        .select('truck_id')
        .eq('route_id', routeId)
        .eq('date', date)
        .not('truck_id', 'is', null)
        .maybeSingle();

    return data !== null;
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

// Assignments Log
export const getAssignmentsForDate = async (date: string): Promise<AssignmentLogEntry[]> => {
    let { data, error } = await supabase
        .from('daily_stock')
        .select(`
            id,
            date,
            stock,
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

    if (error) {
        const fallback = await supabase
            .from('daily_stock')
            .select('id, date, stock, created_at, updated_at, auth_user_id, route_id, truck_id')
            .eq('date', date)
            .order('created_at', { ascending: false });
        if (fallback.error) {
            throw new Error('Failed to fetch assignment log. Please try again.');
        }
        data = fallback.data?.map((row: any) => ({
            ...row,
            users: row.users ? [row.users] : [],
            routes: row.routes ? [row.routes] : [],
            trucks: row.trucks ? [row.trucks] : [],
        })) ?? [];

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

        const entries = (data || []).map((row: any) => {
            const stock: DailyStockPayload = Array.isArray(row.stock) ? row.stock : [];
            const totals = stock.reduce(
                (acc: { boxes: number; pcs: number }, item: DailyStockItem) => {
                    acc.boxes += item.boxQty || 0;
                    acc.pcs += item.pcsQty || 0;
                    return acc;
                },
                { boxes: 0, pcs: 0 }
            );

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
                total_boxes: totals.boxes,
                total_pcs: totals.pcs,
                route_status: row.truck_id ? 'started' : 'not_started',
            } as AssignmentLogEntry;
        });

        return entries;
    }

    const entries = (data || []).map((row: any) => {
        const stock: DailyStockPayload = Array.isArray(row.stock) ? row.stock : [];
        const totals = stock.reduce(
            (acc: { boxes: number; pcs: number }, item: DailyStockItem) => {
                acc.boxes += item.boxQty || 0;
                acc.pcs += item.pcsQty || 0;
                return acc;
            },
            { boxes: 0, pcs: 0 }
        );

        return {
            id: row.id,
            date: row.date,
            auth_user_id: row.auth_user_id ?? null,
            route_id: row.route_id ?? null,
            truck_id: row.truck_id ?? null,
            driver_name: row.users?.name ?? null,
            route_name: row.routes?.name ?? null,
            truck_name: row.trucks?.name ?? null,
            stock,
            created_at: row.created_at,
            updated_at: row.updated_at,
            total_boxes: totals.boxes,
            total_pcs: totals.pcs,
            route_status: row.truck_id ? 'started' : 'not_started',
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
    let query = supabase.from('daily_stock').select('stock').eq('date', date);

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
    }

    // Step 3: Validate stock availability and calculate deltas
    // CRITICAL FIX: Fetch fresh warehouse data for delta calculations
    // The cached warehouseMap has stale pcs_per_box values
    const deltaMap = new Map<string, { deltaBox: number; deltaPcs: number; deltaTotalPcs: number; pcsPerBox: number }>();

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

    // Step 4: Upsert daily_stock
    const dailyStockData = {
        auth_user_id: driverId,
        route_id: routeId,
        truck_id: truckId,
        date,
        stock: validItems,
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
    const buildQuery = (includeVillage: boolean) => {
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
        if (routeId && routeId.trim()) {
            q = q.eq('route_id', routeId.trim());
        }
        return q;
    };

    // First attempt including 'village' column
    let { data, error } = await buildQuery(true);
    // Fallback if column doesn't exist
    if (error && (error.code === '42703' || /column\s+shops\.village\s+does\s+not\s+exist/i.test(error.message || ''))) {
        const res = await buildQuery(false);
        const { data: data2, error: err2 } = await res;
        if (err2) {
            console.error('Error fetching shops (fallback):', err2);
            throw new Error('Failed to fetch shops. Please try again.');
        }
        return data2 || [];
    }
    if (error) {
        console.error('Error fetching shops:', error);
        throw new Error('Failed to fetch shops. Please try again.');
    }
    return data || [];
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

    const { data, error } = await supabase
        .from('shops')
        .insert(payload)
        .select()
        .single();
    if (error && (error.code === '42703' || /column\s+shops\.village\s+does\s+not\s+exist/i.test(error.message || ''))) {
        const { village, ...withoutVillage } = payload as Record<string, unknown>;
        const { data: data2, error: err2 } = await supabase
            .from('shops')
            .insert(withoutVillage)
            .select()
            .single();
        if (err2) {
            console.error('Error creating shop (fallback):', err2);
            throw new Error('Failed to create shop. Please try again.');
        }
        return data2 as Shop;
    }
    if (error) {
        console.error('Error creating shop:', error);
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

    const { data, error } = await supabase
        .from('shops')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error && (error.code === '42703' || /column\s+shops\.village\s+does\s+not\s+exist/i.test(error.message || ''))) {
        // Retry without village field
        const { village, ...withoutVillage } = payload as Record<string, unknown>;
        const { data: data2, error: err2 } = await supabase
            .from('shops')
            .update(withoutVillage)
            .eq('id', id)
            .select()
            .single();
        if (err2) {
            console.error('Error updating shop (fallback):', err2);
            throw new Error('Failed to update shop. Please try again.');
        }
        return data2 as Shop;
    }
    if (error) {
        console.error('Error updating shop:', error);
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
    routeId?: string
): Promise<string> => {
    const trimmedName = name.trim();
    const trimmedPhone = phone?.trim();

    // 1. Check by PHONE first (Primary Unique Identifier)
    if (trimmedPhone) {
        const { data: existingByPhone, error: phoneError } = await supabase
            .from('shops')
            .select('id')
            .eq('phone', trimmedPhone)
            .limit(1);

        if (!phoneError && existingByPhone && existingByPhone.length > 0) {
            return existingByPhone[0].id;
        }
    }

    // 2. Fallback: If no phone provided, check by NAME
    if (!trimmedPhone) {
        const { data: existingByName, error: nameError } = await supabase
            .from('shops')
            .select('id')
            .ilike('name', trimmedName)
            .limit(1);

        if (!nameError && existingByName && existingByName.length > 0) {
            return existingByName[0].id;
        }
    }

    // 3. Create new shop
    // We bypass createShop helper to ensure we follow the logic above and avoid double-checks
    const now = new Date().toISOString();
    const payload = {
        name: trimmedName,
        phone: trimmedPhone || null,
        village: address?.trim() || null, // Map address to village
        address: address?.trim() || null,
        route_id: routeId || null,
        created_at: now,
        updated_at: now,
    };

    const { data, error } = await supabase
        .from('shops')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        // Handle potential column missing error for 'village' as seen in createShop
        if (error.code === '42703' || /column\s+shops\.village\s+does\s+not\s+exist/i.test(error.message || '')) {
            const { village, ...withoutVillage } = payload;
            const { data: data2, error: err2 } = await supabase
                .from('shops')
                .insert(withoutVillage)
                .select('id')
                .single();
            if (err2) throw new Error('Failed to create shop (fallback)');
            return data2!.id;
        }
        console.error('Error creating shop in ensureShopExists:', error);
        throw new Error('Failed to create shop');
    }

    return data!.id;
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
    // products_sold can be array or object { items, shop_address, shop_phone }
    let shopPhone: string | undefined;
    let shopAddress: string | undefined;

    if (salePayload.products_sold && !Array.isArray(salePayload.products_sold)) {
        shopPhone = salePayload.products_sold.shop_phone;
        shopAddress = salePayload.products_sold.shop_address;
    }

    // Ensure shop exists and get ID
    let shopId: string | null = null;
    try {
        shopId = await ensureShopExists(
            salePayload.shop_name,
            shopPhone,
            shopAddress,
            salePayload.route_id
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

    if (salePayload.products_sold && !Array.isArray(salePayload.products_sold)) {
        shopPhone = salePayload.products_sold.shop_phone;
        shopAddress = salePayload.products_sold.shop_address;
    }

    // Ensure shop exists and get ID
    let shopId: string | null = null;
    try {
        shopId = await ensureShopExists(
            salePayload.shop_name,
            shopPhone,
            shopAddress,
            salePayload.route_id
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
    // CRITICAL FIX: When driverId is null (driver portal), query daily_stock directly
    // to get admin-assigned stock (where auth_user_id IS NULL)
    let stockData: DailyStockPayload | null = null;

    if (driverId === null) {
        // Driver portal: query admin-assigned stock (auth_user_id IS NULL)
        const { data, error } = await supabase
            .from('daily_stock')
            .select('stock')
            .eq('route_id', routeId)
            .eq('date', date)
            .is('auth_user_id', null)
            .maybeSingle();

        if (error) {
            console.error('Error fetching admin-assigned stock:', error);
            return [];
        }

        stockData = data?.stock as DailyStockPayload || null;
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

    if (!stockData || stockData.length === 0) return [];

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
