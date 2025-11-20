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
