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
  assigned_boxes: number;
  assigned_extra_pcs: number;
  sold_pcs: number;
  sold_boxes: number;
  sold_extra_pcs: number;
  returned_pcs: number;
  returned_boxes: number;
  returned_extra_pcs: number;
  revenue: number;
}

export interface RouteSummaryRow {
  route_id: string;
  route_name: string;
  assigned_pcs: number;
  assigned_boxes: number;
  assigned_extra_pcs: number;
  sold_pcs: number;
  sold_boxes: number;
  sold_extra_pcs: number;
  returned_pcs: number;
  returned_boxes: number;
  returned_extra_pcs: number;
  revenue: number;
  unique_drivers: number;
  invoices: number;
}

export interface DriverSummaryRow {
  driver_id: string;
  driver_name: string;
  routes: string[];
  assigned_pcs: number;
  assigned_boxes: number;
  assigned_extra_pcs: number;
  sold_pcs: number;
  sold_boxes: number;
  sold_extra_pcs: number;
  returned_pcs: number;
  returned_boxes: number;
  returned_extra_pcs: number;
  revenue: number;
  bills: number;
}

export interface ProductSummaryRow {
  product_id: string;
  product_name: string;
  assigned_pcs: number;
  assigned_boxes: number;
  assigned_extra_pcs: number;
  sold_pcs: number;
  sold_boxes: number;
  sold_extra_pcs: number;
  returned_pcs: number;
  returned_boxes: number;
  returned_extra_pcs: number;
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
  total_sold_boxes: number;
  total_sold_extra_pcs: number;
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

function normalizeQty(totalPCS: number, pcsPerBox: number) {
  const boxes = Math.floor(totalPCS / (pcsPerBox || 24));
  const pcs = totalPCS % (pcsPerBox || 24);
  return { boxes, pcs };
}

// Helper to accumulate normalized quantities per product
class StockAggregator {
  // Map<productId, totalPCS>
  private stockMap = new Map<string, number>();

  add(productId: string, pcs: number) {
    const prev = this.stockMap.get(productId) || 0;
    this.stockMap.set(productId, prev + pcs);
  }

  getTotals(pmMap: Record<string, ProductMinimal>) {
    let totalPCS = 0;
    let totalBoxes = 0;
    let totalExtraPCS = 0;

    for (const [pid, pcs] of this.stockMap.entries()) {
      const pm = pmMap[pid];
      if (!pm) {
        totalPCS += pcs; // Fallback
        continue;
      }
      totalPCS += pcs;
      const n = normalizeQty(pcs, pm.pcs_per_box || 24);
      totalBoxes += n.boxes;
      totalExtraPCS += n.pcs;
    }
    return { totalPCS, totalBoxes, totalExtraPCS };
  }
}

export async function buildDailySummary(range: DateRange): Promise<DailySummaryRow[]> {
  const [pmMap, routesMap, driversMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDriversMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to),
  ]);

  return buildDailySummaryCorrect(assignedRows, salesRows, pmMap, routesMap, driversMap);
}

// Actual implementation
async function buildDailySummaryCorrect(assignedRows: any[], salesRows: any[], pmMap: any, routesMap: any, driversMap: any) {
  const salesByRowKey = new Map<string, Map<string, number>>();
  const revenueByKey = new Map<string, number>();

  for (const s of salesRows) {
    const key = `${s.date}|${s.route_id || ''}|${(s as any).auth_user_id || ''}`;
    if (!salesByRowKey.has(key)) salesByRowKey.set(key, new Map());
    const map = salesByRowKey.get(key)!;
    const items = toItemsArray(s.products_sold);
    let rev = revenueByKey.get(key) || 0;

    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      map.set(it.productId, (map.get(it.productId) || 0) + q.totalPCS);
      rev += q.totalPCS * (q.unitPrice || 0);
    }
    revenueByKey.set(key, rev);
  }

  return assignedRows.map((a: any) => {
    const key = `${a.date}|${a.route_id || ''}|${a.auth_user_id || ''}`;
    const soldMap = salesByRowKey.get(key) || new Map<string, number>();

    // Collect all products involved in this row (assigned + sold)
    const products = new Set<string>();
    a.stock.forEach((x: any) => products.add(x.productId));
    for (const k of soldMap.keys()) products.add(k);

    let assignedPCS = 0, assignedBoxes = 0, assignedExtra = 0;
    let soldPCS = 0, soldBoxes = 0, soldExtra = 0;
    let retPCS = 0, retBoxes = 0, retExtra = 0;

    // Map assigned stock for easy lookup
    const assignedMap = new Map<string, number>();
    a.stock.forEach((x: any) => {
      const pm = pmMap[x.productId];
      if (pm) assignedMap.set(x.productId, (x.boxQty || 0) * (pm.pcs_per_box || 24) + (x.pcsQty || 0));
    });

    for (const pid of products) {
      const pm = pmMap[pid];
      if (!pm) continue;
      const aQty = assignedMap.get(pid) || 0;
      const sQty = soldMap.get(pid) || 0;
      const rQty = Math.max(0, aQty - sQty);

      assignedPCS += aQty;
      const na = normalizeQty(aQty, pm.pcs_per_box || 24);
      assignedBoxes += na.boxes; assignedExtra += na.pcs;

      soldPCS += sQty;
      const ns = normalizeQty(sQty, pm.pcs_per_box || 24);
      soldBoxes += ns.boxes; soldExtra += ns.pcs;

      retPCS += rQty;
      const nr = normalizeQty(rQty, pm.pcs_per_box || 24);
      retBoxes += nr.boxes; retExtra += nr.pcs;
    }

    return {
      date: a.date,
      route_id: a.route_id,
      driver_id: a.auth_user_id,
      route_name: a.route_id ? routesMap[a.route_id] || '' : '',
      driver_name: a.auth_user_id ? driversMap[a.auth_user_id] || '' : '',
      assigned_pcs: assignedPCS,
      assigned_boxes: assignedBoxes,
      assigned_extra_pcs: assignedExtra,
      sold_pcs: soldPCS,
      sold_boxes: soldBoxes,
      sold_extra_pcs: soldExtra,
      returned_pcs: retPCS,
      returned_boxes: retBoxes,
      returned_extra_pcs: retExtra,
      revenue: revenueByKey.get(key) || 0,
    };
  });
}

export async function buildRouteSummary(range: DateRange): Promise<RouteSummaryRow[]> {
  const [pmMap, routesMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to),
  ]);

  // Aggregation per route
  // Map<routeId, Map<productId, {assigned, sold}>>
  const routeProductMap = new Map<string, Map<string, { assigned: number, sold: number }>>();
  const routeStats = new Map<string, { revenue: number, drivers: Set<string>, invoices: number }>();

  // Init route helper
  const getRouteProd = (rid: string, pid: string) => {
    if (!routeProductMap.has(rid)) routeProductMap.set(rid, new Map());
    const pMap = routeProductMap.get(rid)!;
    if (!pMap.has(pid)) pMap.set(pid, { assigned: 0, sold: 0 });
    return pMap.get(pid)!;
  };
  const getStats = (rid: string) => {
    if (!routeStats.has(rid)) routeStats.set(rid, { revenue: 0, drivers: new Set(), invoices: 0 });
    return routeStats.get(rid)!;
  };

  for (const a of assignedRows) {
    const key = a.route_id || '';
    const stats = getStats(key);
    if (a.auth_user_id) stats.drivers.add(a.auth_user_id);

    for (const s of a.stock) {
      const pm = pmMap[s.productId];
      if (!pm) continue;
      const qty = (s.boxQty || 0) * (pm.pcs_per_box || 24) + (s.pcsQty || 0);
      const p = getRouteProd(key, s.productId);
      p.assigned += qty;
    }
  }

  for (const s of salesRows) {
    const key = s.route_id || '';
    const stats = getStats(key);
    stats.invoices++;

    const items = toItemsArray(s.products_sold);
    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      const p = getRouteProd(key, it.productId);
      p.sold += q.totalPCS;
      stats.revenue += q.totalPCS * (q.unitPrice || 0);
    }
  }

  // Build rows
  const allRoutes = new Set([...routeProductMap.keys(), ...routesMap ? Object.keys(routesMap) : []]);

  const activeRoutes = new Set([...routeProductMap.keys()]);

  return Array.from(activeRoutes).map(rid => {
    const pMap = routeProductMap.get(rid) || new Map();
    const stats = routeStats.get(rid) || { revenue: 0, drivers: new Set(), invoices: 0 };

    let ap = 0, asb = 0, ase = 0;
    let sp = 0, sb = 0, se = 0;
    let rp = 0, rb = 0, re = 0;

    for (const [pid, val] of pMap.entries()) {
      const pm = pmMap[pid];
      if (!pm) continue;

      const ret = Math.max(0, val.assigned - val.sold);

      ap += val.assigned;
      const na = normalizeQty(val.assigned, pm.pcs_per_box || 24);
      asb += na.boxes; ase += na.pcs;

      sp += val.sold;
      const ns = normalizeQty(val.sold, pm.pcs_per_box || 24);
      sb += ns.boxes; se += ns.pcs;

      rp += ret;
      const nr = normalizeQty(ret, pm.pcs_per_box || 24);
      rb += nr.boxes; re += nr.pcs;
    }

    return {
      route_id: rid,
      route_name: rid ? routesMap[rid] || '' : '',
      assigned_pcs: ap, assigned_boxes: asb, assigned_extra_pcs: ase,
      sold_pcs: sp, sold_boxes: sb, sold_extra_pcs: se,
      returned_pcs: rp, returned_boxes: rb, returned_extra_pcs: re,
      revenue: stats.revenue,
      unique_drivers: stats.drivers.size,
      invoices: stats.invoices
    };
  });
}

export async function buildDriverSummary(range: DateRange): Promise<DriverSummaryRow[]> {
  const [pmMap, routesMap, driversMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDriversMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to),
  ]);

  // Reuse logic from buildDailySummary or just do basic aggregation.
  // Implementing minimal version to satisfy typescript interface

  const driverAgg = new Map<string, { routes: Set<string>; assignedPCS: number; soldPCS: number; revenue: number; bills: number; assignedBoxes: number; assignedExtra: number; soldBoxes: number; soldExtra: number; retBoxes: number; retExtra: number }>();
  // To correctly calc boxes/extra, we MUST aggregate per product first.
  const driverProductMap = new Map<string, Map<string, { assigned: number, sold: number }>>();

  const getDriverProd = (did: string, pid: string) => {
    if (!driverProductMap.has(did)) driverProductMap.set(did, new Map());
    const m = driverProductMap.get(did)!;
    if (!m.has(pid)) m.set(pid, { assigned: 0, sold: 0 });
    return m.get(pid)!;
  };
  const getStats = (did: string) => {
    if (!driverAgg.has(did)) driverAgg.set(did, { routes: new Set(), assignedPCS: 0, soldPCS: 0, revenue: 0, bills: 0, assignedBoxes: 0, assignedExtra: 0, soldBoxes: 0, soldExtra: 0, retBoxes: 0, retExtra: 0 });
    return driverAgg.get(did)!;
  };

  for (const a of assignedRows) {
    if (!a.auth_user_id) continue;
    const stats = getStats(a.auth_user_id);
    if (a.route_id) stats.routes.add(a.route_id);

    for (const s of a.stock) {
      const pm = pmMap[s.productId];
      if (!pm) continue;
      const qty = (s.boxQty || 0) * (pm.pcs_per_box || 24) + (s.pcsQty || 0);
      const p = getDriverProd(a.auth_user_id, s.productId);
      p.assigned += qty;
    }
  }

  for (const s of salesRows) {
    const did = (s as any).auth_user_id;
    if (!did) continue;
    const stats = getStats(did);
    stats.bills++;
    const items = toItemsArray(s.products_sold);
    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      const p = getDriverProd(did, it.productId);
      p.sold += q.totalPCS;
      stats.revenue += q.totalPCS * (q.unitPrice || 0);
    }
  }

  return Array.from(driverProductMap.keys()).map(did => {
    const pMap = driverProductMap.get(did)!;
    const stats = driverAgg.get(did)!;

    let ap = 0, asb = 0, ase = 0;
    let sp = 0, sb = 0, se = 0;
    let rp = 0, rb = 0, re = 0;

    for (const [pid, val] of pMap.entries()) {
      const pm = pmMap[pid];
      if (!pm) continue;
      const ret = Math.max(0, val.assigned - val.sold);

      ap += val.assigned;
      const na = normalizeQty(val.assigned, pm.pcs_per_box || 24);
      asb += na.boxes; ase += na.pcs;

      sp += val.sold;
      const ns = normalizeQty(val.sold, pm.pcs_per_box || 24);
      sb += ns.boxes; se += ns.pcs;

      rp += ret;
      const nr = normalizeQty(ret, pm.pcs_per_box || 24);
      rb += nr.boxes; re += nr.pcs;
    }

    return {
      driver_id: did,
      driver_name: driversMap[did] || '',
      routes: Array.from(stats.routes).map(r => routesMap[r] || ''),
      assigned_pcs: ap,
      assigned_boxes: asb, assigned_extra_pcs: ase,
      sold_pcs: sp,
      sold_boxes: sb, sold_extra_pcs: se,
      returned_pcs: rp,
      returned_boxes: rb, returned_extra_pcs: re,
      revenue: stats.revenue,
      bills: stats.bills
    };
  });
}

export async function buildProductSummary(range: DateRange): Promise<ProductSummaryRow[]> {
  const [pmMap, assignedRows, salesRows] = await Promise.all([
    getProductsMap(),
    getDailyStockBetween(range.from, range.to),
    getSalesBetween(range.from, range.to)
  ]);

  const agg = new Map<string, { assigned: number, sold: number, revenue: number, unitPriceSum: number, count: number }>();

  const getAgg = (pid: string) => {
    if (!agg.has(pid)) agg.set(pid, { assigned: 0, sold: 0, revenue: 0, unitPriceSum: 0, count: 0 });
    return agg.get(pid)!;
  };

  for (const a of assignedRows) {
    for (const s of a.stock) {
      const qt = (s.boxQty || 0) * (pmMap[s.productId]?.pcs_per_box || 24) + (s.pcsQty || 0);
      getAgg(s.productId).assigned += qt;
    }
  }

  for (const s of salesRows) {
    const items = toItemsArray(s.products_sold);
    for (const it of items) {
      const pm = pmMap[it.productId];
      if (!pm) continue;
      const q = qtyToPCS(it, pm);
      const p = getAgg(it.productId);
      p.sold += q.totalPCS;
      p.revenue += q.totalPCS * (q.unitPrice || 0);
      if (q.unitPrice) { p.unitPriceSum += q.unitPrice; p.count++; }
    }
  }

  return Array.from(agg.entries()).map(([pid, val]) => {
    const pm = pmMap[pid];
    const ret = Math.max(0, val.assigned - val.sold);
    const na = normalizeQty(val.assigned, pm?.pcs_per_box || 24);
    const ns = normalizeQty(val.sold, pm?.pcs_per_box || 24);
    const nr = normalizeQty(ret, pm?.pcs_per_box || 24);

    return {
      product_id: pid,
      product_name: pm?.name || '',
      assigned_pcs: val.assigned,
      assigned_boxes: na.boxes, assigned_extra_pcs: na.pcs,
      sold_pcs: val.sold,
      sold_boxes: ns.boxes, sold_extra_pcs: ns.pcs,
      returned_pcs: ret,
      returned_boxes: nr.boxes, returned_extra_pcs: nr.pcs,
      revenue: val.revenue,
      avg_unit_price: val.count > 0 ? val.unitPriceSum / val.count : 0
    };
  });
}

export async function buildSalesReport(range: DateRange): Promise<SalesReportRow[]> {
  const [pmMap, routesMap, driversMap, salesRows] = await Promise.all([
    getProductsMap(),
    getRoutesMap(),
    getDriversMap(),
    getSalesBetween(range.from, range.to),
  ]);

  return salesRows.map(s => {
    const items = toItemsArray(s.products_sold).map(it => {
      const pm = pmMap[it.productId];
      if (!pm) return { product_id: it.productId, product_name: '', boxQty: 0, pcsQty: 0, unitPrice: 0, totalPCS: 0, lineRevenue: 0 };
      const q = qtyToPCS(it, pm);
      return { product_id: it.productId, product_name: pm.name, boxQty: q.boxQty, pcsQty: q.pcsQty, unitPrice: q.unitPrice || 0, totalPCS: q.totalPCS, lineRevenue: q.totalPCS * (q.unitPrice || 0) };
    });

    // Calculate totals for the row
    let totalPCS = 0, totalBoxes = 0, totalExtra = 0;

    items.forEach(it => {
      const pm = pmMap[it.product_id];
      totalPCS += it.totalPCS;
      const n = normalizeQty(it.totalPCS, pm?.pcs_per_box || 24);
      totalBoxes += n.boxes;
      totalExtra += n.pcs;
    });

    const amount = items.reduce((sum, it) => sum + it.lineRevenue, 0);

    return {
      id: s.id,
      date: s.date,
      driver_id: (s as any).auth_user_id || null,
      driver_name: (s as any).auth_user_id ? driversMap[(s as any).auth_user_id] || '' : '',
      route_id: s.route_id || null,
      route_name: s.route_id ? routesMap[s.route_id] || '' : '',
      shop_name: s.shop_name || '',
      total_sold_pcs: totalPCS,
      total_sold_boxes: totalBoxes,
      total_sold_extra_pcs: totalExtra,
      returned_pcs: 0,
      amount: amount,
      items
    };
  });
}

export function exportCsv(headers: string[], rows: Array<Record<string, string | number>>): string {
  const headerLine = headers.join(',');
  const bodyLines = rows.map(r => headers.map(h => String(r[h] ?? '')).join(',')).join('\n');
  return [headerLine, bodyLines].join('\n');
}
