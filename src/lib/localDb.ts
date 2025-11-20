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

export type StockItem = { productId: string; unit: 'box' | 'pcs'; quantity: number };

export type DailyStock = {
  route_id: string;
  date: string; // YYYY-MM-DD
  stock: StockItem[];
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

const get = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
};

const set = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const uuid = (): string => {
  // Use crypto.randomUUID if available, else fallback
  try {
    if ('randomUUID' in crypto) return (crypto as any).randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Products
export const getProducts = (): Product[] => get<Product[]>('products', []);
export const setProducts = (products: Product[]) => set('products', products);
export const upsertProduct = (p: Omit<Product, 'id'> & { id?: string }): Product => {
  const all = getProducts();
  let id = p.id || uuid();
  const existingIdx = all.findIndex(x => x.id === id);
  const now = new Date().toISOString();
  const next: Product = { ...p, id, updated_at: now, created_at: all.find(x=>x.id===id)?.created_at || now } as Product;
  if (existingIdx >= 0) all[existingIdx] = next; else all.push(next);
  setProducts(all);
  return next;
};
export const softDeleteProduct = (id: string) => {
  const all = getProducts();
  const idx = all.findIndex(x => x.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], status: 'inactive', updated_at: new Date().toISOString() };
    setProducts(all);
  }
};

// Routes
export const getRoutes = (): Route[] => get<Route[]>('routes', []);
export const setRoutes = (routes: Route[]) => set('routes', routes);
export const addRoute = (name: string, description?: string): Route => {
  const all = getRoutes();
  const now = new Date().toISOString();
  const r: Route = { id: uuid(), name, description: description || null, is_active: true, created_at: now, updated_at: now };
  all.push(r);
  setRoutes(all);
  return r;
};
export const deactivateRoute = (id: string) => {
  const all = getRoutes();
  const idx = all.findIndex(r => r.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], is_active: false, updated_at: new Date().toISOString() };
    setRoutes(all);
  }
};

// Daily stock
const dsKey = (routeId: string, date: string) => `daily_stock:${routeId}:${date}`;
export const getDailyStock = (routeId: string, date: string): DailyStock | null => get<DailyStock | null>(dsKey(routeId, date), null);
export const setDailyStock = (routeId: string, date: string, stock: StockItem[]) => set(dsKey(routeId, date), { route_id: routeId, date, stock } satisfies DailyStock);

// Sales
export const getSalesFor = (date: string, routeId?: string): Sale[] => {
  const all = get<Sale[]>('sales', []);
  return all.filter(s => s.date === date && (!routeId || String(s.route_id) === String(routeId)));
};
export const appendSale = (sale: Omit<Sale, 'id' | 'created_at'>): Sale => {
  const all = get<Sale[]>('sales', []);
  const now = new Date().toISOString();
  const s: Sale = { id: uuid(), created_at: now, ...sale } as Sale;
  all.push(s);
  set('sales', all);
  return s;
};