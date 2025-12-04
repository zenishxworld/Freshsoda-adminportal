import { supabase } from '@/integrations/supabase/client';

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
}


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
            try { onChange(); } catch {}
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

    // Step 3: Validate stock availability
    for (const item of validItems) {
        const warehouse = warehouseMap.get(item.productId);
        if (!warehouse) {
            throw new Error(`Product not found in warehouse`);
        }

        // Convert to PCS for comparison
        const requestedTotalPcs = item.boxQty * warehouse.pcs_per_box + item.pcsQty;
        const availableTotalPcs = warehouse.boxes * warehouse.pcs_per_box + warehouse.pcs;

        if (requestedTotalPcs > availableTotalPcs) {
            throw new Error(
                `Not enough warehouse stock for ${warehouse.product_name}. ` +
                `Available: ${warehouse.boxes} boxes + ${warehouse.pcs} pcs. ` +
                `Requested: ${item.boxQty} boxes + ${item.pcsQty} pcs.`
            );
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

    // Step 5: Reduce warehouse stock for each product
    for (const item of validItems) {
        const warehouse = warehouseMap.get(item.productId)!;

        // Calculate new warehouse stock
        const totalWarehousePcs = warehouse.boxes * warehouse.pcs_per_box + warehouse.pcs;
        const assignedPcs = item.boxQty * warehouse.pcs_per_box + item.pcsQty;
        const remainingPcs = totalWarehousePcs - assignedPcs;

        // Convert back to boxes and pcs
        const newBoxes = Math.floor(remainingPcs / warehouse.pcs_per_box);
        const newPcs = remainingPcs % warehouse.pcs_per_box;

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
            throw new Error(`Failed to update warehouse stock for ${warehouse.product_name}`);
        }

        // Step 6: Log the movement
        const { error: movementError } = await supabase
            .from('warehouse_movements')
            .insert({
                product_id: item.productId,
                movement_type: 'ASSIGN',
                boxes: item.boxQty,
                pcs: item.pcsQty,
                note: `Assigned to driver for route on ${date}`,
            });

        if (movementError) {
            console.error('Error logging warehouse movement:', movementError);
            // Don't throw here - stock was updated successfully
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
    const payload = {
        category,
        amount,
        date,
        note: input.note?.trim() || null,
        created_at: now,
        updated_at: now,
    } as any;

    const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select('*')
        .single();
    if (error) {
        console.error('Error adding expense:', error);
        throw new Error('Failed to save expense, try again');
    }
    const exp = data as Expense;
    try {
        const { data: session } = await supabase.auth.getSession();
        const uid = session?.session?.user?.id || null;
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
