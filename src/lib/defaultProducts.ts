import { getProducts, upsertProduct } from "./localDb";

// Default product names from user request
export const DEFAULT_PRODUCT_NAMES: string[] = [
  "Fresh Instant Energy 200 ml",
  "Fresh Jeera 200 ml",
  "Fresh Pepyo 200 ml",
  "Fresh Club Soda 300ml",
  "Fresh Jeera 250 ml",
  "Fresh Mojito 200 ml",
  "Fresh Lahori 200 ml",
  "Fresh Blueberry Soda 200ml",
  "Fresh Mango 200ml",
  "Fresh Cola 200 ml",
  "Fresh Clear Lemon 200ml",
  // Water variants (ensure coverage for common spellings)
  "1 little water mrp 20",
  "500 ml water mrp 10",
];

// Per-unit default pricing map (case-insensitive keys)
export const UNIT_PRICE_MAP: Record<string, { pcs: number; box: number }> = {
  // Fresh beverages — pcs: 10, box: 170
  "fresh instant energy 200 ml": { pcs: 10, box: 170 },
  "fresh jeera 200 ml": { pcs: 10, box: 170 },
  "fresh pepyo 200 ml": { pcs: 10, box: 170 },
  "fresh club soda 300ml": { pcs: 10, box: 170 },
  "fresh jeera 250 ml": { pcs: 10, box: 170 },
  "fresh mojito 200 ml": { pcs: 10, box: 170 },
  "fresh lahori 200 ml": { pcs: 10, box: 170 },
  "fresh blueberry soda 200ml": { pcs: 10, box: 170 },
  "fresh mango 200ml": { pcs: 10, box: 170 },
  "fresh cola 200 ml": { pcs: 10, box: 170 },
  "fresh clear lemon 200ml": { pcs: 10, box: 170 },

  // Water — normalize multiple spellings to required defaults
  // 1 liter water: pcs 20, box 80
  "1 liter water": { pcs: 20, box: 80 },
  "1 litter water": { pcs: 20, box: 80 },
  "1 little water mrp 20": { pcs: 20, box: 80 },

  // 500 ml / 50 ml water: pcs 10, box 100
  "500 ml water mrp 10": { pcs: 10, box: 100 },
  "50 ml water": { pcs: 10, box: 100 },
  "50ml water": { pcs: 10, box: 100 },
};

// Deterministic pseudo-random price generator so prices stay stable across runs
function stablePrice(name: string): number {
  const key = name.trim().toLowerCase();
  const unit = UNIT_PRICE_MAP[key];
  if (unit) return unit.pcs; // default base price aligns with pcs price

  // Fallback explicit prices for legacy entries based on provided MRP
  if (key === "1 little water mrp 20") return 20;
  if (key === "500 ml water mrp 10") return 10;

  // Hash-based pseudo-random between 12 and 35
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  const base = 12; // min
  const range = 24; // 12..35
  return base + (Math.abs(h) % range);
}

// Upsert default products into the database if missing (case-insensitive by name)
export async function seedDefaultProductsIfMissing(): Promise<void> {
  const existing = getProducts();
  const existingNames = new Set<string>((existing || []).map((p: any) => (p.name || "").trim().toLowerCase()));
  const toInsert = DEFAULT_PRODUCT_NAMES
    .filter((n) => !existingNames.has(n.trim().toLowerCase()))
    .map((n) => {
      const key = n.trim().toLowerCase();
      const unit = UNIT_PRICE_MAP[key];
      const pcsPrice = unit?.pcs ?? stablePrice(n);
      const ppb = 24;
      const boxPrice = unit?.box ?? pcsPrice * ppb;
      return {
        name: n,
        price: boxPrice,
        pcs_price: pcsPrice,
        box_price: boxPrice,
        pcs_per_box: ppb,
        description: null,
        status: "active",
      };
    });
  toInsert.forEach((p) => upsertProduct(p as any));
}