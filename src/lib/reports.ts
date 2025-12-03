import { getDailyStockBetween, getSalesBetween, getProductsMap, getRoutesMap, getDriversMap, type DailyStockPayload, type Sale, type ProductMinimal } from './supabase';

export interface DateRange {
  from: string;
  to: string;
}

export interface DailySummaryRow {
  date: string;
  route_id: string | null;
  driver_id: string | null;
  route_name: string;
  driver_name: string;
  assigned_pcs: number;
  sold_pcs: number;
  returned_pcs: number;
  revenue: number;
}

export interface RouteSummaryRow {
  route_id: string;
  route_name: string;
  assigned_pcs: number;
  sold_pcs: number;
  returned_pcs: number;
  revenue: number;
  unique_drivers: number;
  invoices: number;
}

export interface DriverSummaryRow {
  driver_id: string;
  driver_name: string;
  routes: string[];
  assigned_pcs: number;
  sold_pcs: number;
  returned_pcs: number;
  revenue: number;
  bills: number;
}

export interface ProductSummaryRow {
  product_id: string;
  product_name: string;
  assigned_pcs: number;
  sold_pcs: number;
  returned_pcs: number;
  revenue: number;
  avg_unit_price: number;
}

export interface SalesReportRow {
  id: string;
  date: string;
  driver_id: string | null;
  driver_name: string;
  route_id: string | null;
  route_name: string;
  shop_name: string;
  total_sold_pcs: number;
  returned_pcs: number;
  amount: number;
  items: Array<{ product_id: string; product_name: string; boxQty: number; pcsQty: number; unitPrice: number; totalPCS: number; lineRevenue: number }>;
}

function toItemsArray(products_sold: unknown): Array<any> {
  if (Array.isArray(products_sold)) return products_sold as Array<any>;
  if (products_sold && typeof products_sold === 'object') {
    const maybe = (products_sold as any).items;
    if (Array.isArray(maybe)) return maybe as Array<any>;
  }
  return [];
}

function qtyToPCS(item: any, pm: ProductMinimal): { boxQty: number; pcsQty: number; totalPCS: number; unitPrice: number } {
  let boxQty = 0;
  let pcsQty = 0;
  let unitPrice = 0;
  if (typeof item.boxQty === 'number') boxQty = item.boxQty;
  if (typeof item.pcsQty === 'number') pcsQty = item.pcsQty;
  if (typeof item.unitPrice === 'number') unitPrice = item.unitPrice;
  if (typeof item.price === 'number' && unitPrice === 0) unitPrice = item.price;
  if (typeof item.quantity === 'number' && typeof item.unit === 'string') {
    if (item.unit === 'box') boxQty = item.quantity;
    if (item.unit === 'pcs') pcsQty = item.quantity;
  }
  const totalPCS = boxQty * (pm.pcs_per_box || 24) + pcsQty;
  return { boxQty, pcsQty, totalPCS, unitPrice };
}

function assignedPCSFromDailyStock(stock: DailyStockPayload, pmMap: Record<string, ProductMinimal>): number {
  return stock.reduce((sum, s) => {
    const pm = pmMap[s.productId];
    if (!pm) return sum;
    const pcs = s.boxQty * (pm.pcs_per_box || 24) + s.pcsQty;
    return sum + pcs;
  }, 0);
}

export async function buildDailySummary(range: DateRange): Promise<DailySummaryRow[]> {
  const [pmMap, routesMap, driversMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDriversMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to),
  ]);

  const salesByKey = new Map<string, { soldPCS: number; revenue: number }>();
  for (const s of salesRows) {
    const items = toItemsArray(s.products_sold);
    let totalPCS = 0;
    let totalRevenue = 0;
    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      totalPCS += q.totalPCS;
      totalRevenue += q.totalPCS * (q.unitPrice || 0);
    }
    const key = `${s.date}|${s.route_id || ''}|${(s as any).auth_user_id || ''}`;
    const prev = salesByKey.get(key) || { soldPCS: 0, revenue: 0 };
    salesByKey.set(key, { soldPCS: prev.soldPCS + totalPCS, revenue: prev.revenue + totalRevenue });
  }

  const rows: DailySummaryRow[] = assignedRows.map((a) => {
    const assignedPCS = assignedPCSFromDailyStock(a.stock, pmMap);
    const key = `${a.date}|${a.route_id || ''}|${a.auth_user_id || ''}`;
    const sold = salesByKey.get(key) || { soldPCS: 0, revenue: 0 };
    const returned = Math.max(0, assignedPCS - sold.soldPCS);
    return {
      date: a.date,
      route_id: a.route_id,
      driver_id: a.auth_user_id,
      route_name: a.route_id ? routesMap[a.route_id] || '' : '',
      driver_name: a.auth_user_id ? driversMap[a.auth_user_id] || '' : '',
      assigned_pcs: assignedPCS,
      sold_pcs: sold.soldPCS,
      returned_pcs: returned,
      revenue: sold.revenue,
    };
  });
  return rows;
}

export async function buildRouteSummary(range: DateRange): Promise<RouteSummaryRow[]> {
  const [pmMap, routesMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to),
  ]);

  const routeAgg = new Map<string, { assignedPCS: number; soldPCS: number; revenue: number; drivers: Set<string>; invoices: number }>();
  for (const a of assignedRows) {
    const key = a.route_id || '';
    const prev = routeAgg.get(key) || { assignedPCS: 0, soldPCS: 0, revenue: 0, drivers: new Set<string>(), invoices: 0 };
    prev.assignedPCS += assignedPCSFromDailyStock(a.stock, pmMap);
    if (a.auth_user_id) prev.drivers.add(a.auth_user_id);
    routeAgg.set(key, prev);
  }
  for (const s of salesRows) {
    const items = toItemsArray(s.products_sold);
    let totalPCS = 0;
    let totalRevenue = 0;
    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      totalPCS += q.totalPCS;
      totalRevenue += q.totalPCS * (q.unitPrice || 0);
    }
    const key = s.route_id || '';
    const prev = routeAgg.get(key) || { assignedPCS: 0, soldPCS: 0, revenue: 0, drivers: new Set<string>(), invoices: 0 };
    prev.soldPCS += totalPCS;
    prev.revenue += totalRevenue;
    prev.invoices += 1;
    routeAgg.set(key, prev);
  }
  const rows: RouteSummaryRow[] = Array.from(routeAgg.entries()).map(([route_id, v]) => ({
    route_id,
    route_name: route_id ? routesMap[route_id] || '' : '',
    assigned_pcs: v.assignedPCS,
    sold_pcs: v.soldPCS,
    returned_pcs: Math.max(0, v.assignedPCS - v.soldPCS),
    revenue: v.revenue,
    unique_drivers: v.drivers.size,
    invoices: v.invoices,
  }));
  return rows;
}

export async function buildDriverSummary(range: DateRange): Promise<DriverSummaryRow[]> {
  const [pmMap, routesMap, driversMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDriversMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to),
  ]);

  const driverAgg = new Map<string, { routes: Set<string>; assignedPCS: number; soldPCS: number; revenue: number; bills: number }>();
  for (const a of assignedRows) {
    const key = a.auth_user_id || '';
    const prev = driverAgg.get(key) || { routes: new Set<string>(), assignedPCS: 0, soldPCS: 0, revenue: 0, bills: 0 };
    prev.assignedPCS += assignedPCSFromDailyStock(a.stock, pmMap);
    if (a.route_id) prev.routes.add(a.route_id);
    driverAgg.set(key, prev);
  }
  for (const s of salesRows) {
    const items = toItemsArray(s.products_sold);
    let totalPCS = 0;
    let totalRevenue = 0;
    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      totalPCS += q.totalPCS;
      totalRevenue += q.totalPCS * (q.unitPrice || 0);
    }
    const key = (s as any).auth_user_id || '';
    const prev = driverAgg.get(key) || { routes: new Set<string>(), assignedPCS: 0, soldPCS: 0, revenue: 0, bills: 0 };
    prev.soldPCS += totalPCS;
    prev.revenue += totalRevenue;
    prev.bills += 1;
    driverAgg.set(key, prev);
  }
  const rows: DriverSummaryRow[] = Array.from(driverAgg.entries()).map(([driver_id, v]) => ({
    driver_id,
    driver_name: driver_id ? driversMap[driver_id] || '' : '',
    routes: Array.from(v.routes).map(r => routesMap[r] || '').filter(Boolean),
    assigned_pcs: v.assignedPCS,
    sold_pcs: v.soldPCS,
    returned_pcs: Math.max(0, v.assignedPCS - v.soldPCS),
    revenue: v.revenue,
    bills: v.bills,
  }));
  return rows;
}

export async function buildProductSummary(range: DateRange): Promise<ProductSummaryRow[]> {
  const [pmMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to),
  ]);

  const agg = new Map<string, { name: string; assignedPCS: number; soldPCS: number; revenue: number; totalUnitPrice: number; unitCount: number }>();
  for (const a of assignedRows) {
    for (const s of a.stock) {
      const pm = pmMap[s.productId];
      if (!pm) continue;
      const pcs = s.boxQty * (pm.pcs_per_box || 24) + s.pcsQty;
      const prev = agg.get(s.productId) || { name: pm.name, assignedPCS: 0, soldPCS: 0, revenue: 0, totalUnitPrice: 0, unitCount: 0 };
      prev.assignedPCS += pcs;
      agg.set(s.productId, prev);
    }
  }
  for (const sale of salesRows) {
    const items = toItemsArray(sale.products_sold);
    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      const prev = agg.get(it.productId) || { name: pm.name, assignedPCS: 0, soldPCS: 0, revenue: 0, totalUnitPrice: 0, unitCount: 0 };
      prev.soldPCS += q.totalPCS;
      prev.revenue += q.totalPCS * (q.unitPrice || 0);
      if (q.unitPrice) { prev.totalUnitPrice += q.unitPrice; prev.unitCount += 1; }
      agg.set(it.productId, prev);
    }
  }
  const rows: ProductSummaryRow[] = Array.from(agg.entries()).map(([product_id, v]) => ({
    product_id,
    product_name: v.name,
    assigned_pcs: v.assignedPCS,
    sold_pcs: v.soldPCS,
    returned_pcs: Math.max(0, v.assignedPCS - v.soldPCS),
    revenue: v.revenue,
    avg_unit_price: v.unitCount > 0 ? v.totalUnitPrice / v.unitCount : 0,
  }));
  return rows;
}

export async function buildSalesReport(range: DateRange): Promise<SalesReportRow[]> {
  const [pmMap, routesMap, driversMap, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDriversMap(),
    getSalesBetween(range.from, range.to),
  ]);
  const rows: SalesReportRow[] = salesRows.map((s) => {
    const itemsArr = toItemsArray(s.products_sold);
    const items = itemsArr.map(it => {
      const pm = pmMap[it.productId];
      if (!pm) return { product_id: it.productId, product_name: '', boxQty: 0, pcsQty: 0, unitPrice: 0, totalPCS: 0, lineRevenue: 0 };
      const q = qtyToPCS(it, pm);
      return { product_id: it.productId, product_name: pm.name, boxQty: q.boxQty, pcsQty: q.pcsQty, unitPrice: q.unitPrice || 0, totalPCS: q.totalPCS, lineRevenue: q.totalPCS * (q.unitPrice || 0) };
    });
    const totalPCS = items.reduce((sum, it) => sum + it.totalPCS, 0);
    const amount = items.reduce((sum, it) => sum + it.lineRevenue, 0);
    const route_name = s.route_id ? routesMap[s.route_id] || '' : '';
    const driver_id = (s as any).auth_user_id || null;
    const driver_name = driver_id ? driversMap[driver_id] || '' : '';
    return {
      id: s.id,
      date: s.date,
      driver_id,
      driver_name,
      route_id: s.route_id || null,
      route_name,
      shop_name: s.shop_name || '',
      total_sold_pcs: totalPCS,
      returned_pcs: 0,
      amount,
      items,
    };
  });
  return rows;
}

export function exportCsv(headers: string[], rows: Array<Record<string, string | number>>): string {
  const headerLine = headers.join(',');
  const bodyLines = rows.map(r => headers.map(h => String(r[h] ?? '')).join(',')).join('\n');
  return [headerLine, bodyLines].join('\n');
}
