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
    description?: string | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
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


// Products
export const getProducts = async (): Promise<Product[]> => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
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

// Routes
export const getRoutes = async (): Promise<Route[]> => {
    const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching routes:', error);
        throw error;
    }

    return data || [];
};

export const addRoute = async (
    name: string,
    description?: string
): Promise<Route> => {
    const now = new Date().toISOString();
    const routeData = {
        name,
        description: description || null,
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
        console.error('Error adding route:', error);
        throw error;
    }

    return data;
};

export const deactivateRoute = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('routes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error deactivating route:', error);
        throw error;
    }
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
        const { error } = await supabase
            .from('warehouse_stock')
            .insert({
                product_id: productId,
                boxes,
                pcs,
            });

        if (error) {
            console.error('Error creating warehouse stock:', error);
            throw new Error('Failed to create warehouse stock entry. Please try again.');
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
        const { error } = await supabase
            .from('warehouse_stock')
            .insert({
                product_id: productId,
                boxes,
                pcs,
            });

        if (error) {
            console.error('Error creating warehouse stock:', error);
            throw new Error('Failed to create warehouse stock entry. Please try again.');
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
 */
export const getDailyStockForDriverRouteDate = async (
    driverId: string,
    routeId: string,
    truckId: string | null,
    date: string
): Promise<DailyStockPayload | null> => {
    let query = supabase
        .from('daily_stock')
        .select('stock')
        .eq('auth_user_id', driverId)
        .eq('route_id', routeId)
        .eq('date', date);

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
 */
export const saveAssignedStock = async (
    driverId: string,
    routeId: string,
    truckId: string | null,
    date: string,
    items: DailyStockPayload
): Promise<void> => {
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


