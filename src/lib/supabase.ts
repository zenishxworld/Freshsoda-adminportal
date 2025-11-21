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
    pcs: number
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
        throw fetchError;
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
            throw error;
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
            throw error;
        }
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
    pcs: number
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
        throw fetchError;
    }

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
            throw error;
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
            throw error;
        }
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

