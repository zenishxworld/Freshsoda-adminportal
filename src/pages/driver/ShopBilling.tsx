import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { useToast } from "../../hooks/use-toast";
import { getProducts, getDailyStock, getSalesFor, appendSale, getActiveRoutes, getShopSuggestions, getShopSuggestionsByVillage, createShop, type Product, type DailyStock, type Sale, type Shop } from "../../lib/supabase";
import { mapRouteName } from "../../lib/routeUtils";
import { ArrowLeft, ShoppingCart, Plus, Minus, Printer, Store, Check, RefreshCw, X, MapPin, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { nameMatchesQueryByWordPrefix } from "../../lib/utils";



interface SaleItem {
  productId: string;
  productName: string;
  unit: 'box' | 'pcs';
  quantity: number;
  price: number;
  total: number;
  availableStock: number;
}

const ShopBilling = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  // We no longer need a ref for the print content itself
  // const printRef = useRef<HTMLDivElement>(null);

  const [shopName, setShopName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBillPreviewUI, setShowBillPreviewUI] = useState(false); // Renamed state for clarity
  const [currentRoute, setCurrentRoute] = useState("");
  const [currentRouteName, setCurrentRouteName] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [currentStockId, setCurrentStockId] = useState<string>("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  // Current authenticated user id to scope shop details/suggestions per account
  const [authUserId, setAuthUserId] = useState<string>("anon");
  // Shop name suggestions state
  const [shopSuggestions, setShopSuggestions] = useState<string[]>([]);
  const [serverShopSuggestions, setServerShopSuggestions] = useState<Shop[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [serverVillageSuggestions, setServerVillageSuggestions] = useState<Shop[]>([]);
  const localNameMatches = useMemo(() => {
    const q = shopName.trim().toLowerCase();
    if (!q) return [] as string[];
    return shopSuggestions.filter(n => n.toLowerCase().startsWith(q)).slice(0, 8);
  }, [shopName, shopSuggestions]);

  // Snapshot to ensure printed data is consistent and not affected by state resets
  const [printSnapshot, setPrintSnapshot] = useState<null | {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    routeName: string;
    items: Array<{ productId: string; productName: string; unit: 'box' | 'pcs'; quantity: number; price: number; total: number; }>;
    total: number;
  }>(null);

  // Defer cleanup until the print dialog completes
  useEffect(() => {
    const handleAfterPrint = () => {
      // IMPORTANT: Do NOT clear bill data here.
      // Some mobile browsers (iOS Safari) may fire 'afterprint' early while the preview is still rendering.
      // Clearing state here blanked the preview. Keep snapshot and inputs intact.
      setLoading(false);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [currentRoute, currentDate]);

  // --- Functions for shop details cache (now scoped per account id) ---
  const getDetailsKey = useCallback(() => `shopDetails:${authUserId || 'anon'}`, [authUserId]);
  const saveShopDetailsToLocal = (_routeId: string, name: string, address?: string, phone?: string) => {
    if (!name) return;
    const key = getDetailsKey();
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    const map = existing && typeof existing === 'object' ? existing : {};
    map[name] = { address: address || '', phone: phone || '' };
    localStorage.setItem(key, JSON.stringify(map));
  };
  const getShopDetailsFromLocal = (_routeId: string, name: string): { address?: string; phone?: string } | undefined => {
    if (!name) return undefined;
    const key = getDetailsKey();
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    const map = existing && typeof existing === 'object' ? existing : {};
    return map[name];
  };

  // Normalize products_sold payload which can be stored as an array or
  // as an object { items: [...] }. Also handle stringified JSON.
  type SoldItem = { productId: string; unit?: 'box' | 'pcs'; quantity?: number; price?: number; total?: number; productName?: string; name?: string };
  const normalizeSaleProducts = useCallback((ps: unknown): SoldItem[] => {
    if (!ps) return [];
    if (Array.isArray(ps)) return ps as SoldItem[];
    if (typeof ps === 'object' && ps !== null) {
      const obj = ps as { items?: unknown };
      if (Array.isArray(obj.items)) return obj.items as SoldItem[];
    }
    if (typeof ps === 'string') {
      const parsed = JSON.parse(ps);
      if (Array.isArray(parsed)) return parsed as SoldItem[];
      if (typeof parsed === 'object' && parsed !== null) {
        const obj2 = parsed as { items?: unknown };
        if (Array.isArray(obj2.items)) return obj2.items as SoldItem[];
      }
    }
    return [];
  }, []);

  // --- Functions for shop suggestions (now scoped per account id and across all routes) ---
  const loadShopSuggestions = useCallback(async (_routeId: string) => {
    try {
      const localKey = `shopNames:${authUserId || 'anon'}`;
      const hiddenKey = `shopNames:hidden:${authUserId || 'anon'}`;
      const local = JSON.parse(localStorage.getItem(localKey) || '[]');
      const hidden = JSON.parse(localStorage.getItem(hiddenKey) || '[]');
      const namesSet = new Set<string>(Array.isArray(local) ? local : []);
      const hiddenSet = new Set<string>(Array.isArray(hidden) ? hidden : []);
      const detailsKey = `shopDetails:${authUserId || 'anon'}`;
      const raw = localStorage.getItem(detailsKey);
      let detailsMap: Record<string, { address?: string; phone?: string }> = {};
      try {
        const parsed = JSON.parse(raw || '{}') as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          detailsMap = parsed as Record<string, { address?: string; phone?: string }>;
        }
      } catch (err: unknown) {
        detailsMap = {};
      }

      // Suggestions rely on local storage in this offline mode

      const names = Array.from(namesSet).filter(n => !hiddenSet.has(n)).sort((a, b) => a.localeCompare(b));
      setShopSuggestions(names);
      localStorage.setItem(localKey, JSON.stringify(names));
      localStorage.setItem(detailsKey, JSON.stringify(detailsMap));
    } catch (err) {
      console.warn('Failed to load shop suggestions', err);
    }
  }, [authUserId]);
  const saveShopNameToLocal = (_routeId: string, name: string) => {
    const localKey = `shopNames:${authUserId || 'anon'}`;
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    let updated: string[] = Array.isArray(existing) ? existing : [];
    if (!updated.includes(name)) {
      updated = [name, ...updated].slice(0, 100); // keep recent up to 100
      localStorage.setItem(localKey, JSON.stringify(updated));
    }
    setShopSuggestions(prev => (prev.includes(name) ? prev : [name, ...prev]));
  };
  const removeShopName = (_routeId: string, name: string) => {
    const localKey = `shopNames:${authUserId || 'anon'}`;
    const hiddenKey = `shopNames:hidden:${authUserId || 'anon'}`;
    const existingLocal = JSON.parse(localStorage.getItem(localKey) || '[]');
    let updatedLocal: string[] = Array.isArray(existingLocal) ? existingLocal : [];
    updatedLocal = updatedLocal.filter(n => n !== name);
    localStorage.setItem(localKey, JSON.stringify(updatedLocal));

    const existingHidden = JSON.parse(localStorage.getItem(hiddenKey) || '[]');
    const updatedHidden: string[] = Array.isArray(existingHidden) ? existingHidden : [];
    if (!updatedHidden.includes(name)) {
      updatedHidden.push(name);
      localStorage.setItem(hiddenKey, JSON.stringify(updatedHidden));
    }

    setShopSuggestions(prev => prev.filter(n => n !== name));
  };

  useEffect(() => {
    const route = localStorage.getItem('currentRoute');
    const date = localStorage.getItem('currentDate') || new Date().toISOString().split('T')[0];

    if (!route) {
      toast({ title: "No Active Route", description: "Please start a route first", variant: "destructive" });
      navigate('/start-route');
      return;
    }

    setAuthUserId('anon');
    loadShopSuggestions(route);

    setCurrentRoute(route);
    setCurrentDate(date);
    fetchProductsAndStock(route, date);
  }, [navigate, toast, loadShopSuggestions]);

  useEffect(() => {
    const q = shopName.trim();
    let cancelled = false;
    (async () => {
      if (q.length >= 2) {
        try {
          const results = await getShopSuggestions(q);
          if (!cancelled) setServerShopSuggestions(results.slice(0, 10));
        } catch {
          if (!cancelled) setServerShopSuggestions([]);
        }
      } else {
        setServerShopSuggestions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [shopName]);

  useEffect(() => {
    const q = shopAddress.trim();
    let cancelled = false;
    (async () => {
      if (q.length >= 2) {
        try {
          const results = await getShopSuggestionsByVillage(q);
          if (!cancelled) setServerVillageSuggestions(results.slice(0, 10));
        } catch {
          if (!cancelled) setServerVillageSuggestions([]);
        }
      } else {
        setServerVillageSuggestions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [shopAddress]);



  // Helper to compute pcs-per-box directly from a product object during fetch.
  // This avoids relying on the React state update timing for `products`.
  const getPcsPerBoxFromProduct = (product: unknown): number => {
    const p = product as Partial<Product>;
    if (typeof p.pcs_per_box === 'number' && p.pcs_per_box > 0) return p.pcs_per_box;
    const box = (p.box_price ?? p.price) as number | undefined;
    const pcs = (p.pcs_price ?? (box ? box / 24 : undefined)) as number | undefined;
    const ratio = Math.round((box || 0) / (pcs || 1));
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 24;
  };

  // --- fetchProductsAndStock remains largely the same ---
  const fetchProductsAndStock = useCallback(async (route: string, date: string) => {
    try {
      const routes = await getActiveRoutes();
      const r = routes.find((rr) => String(rr.id) === String(route));
      if (r) setCurrentRouteName(mapRouteName(r.name));

      const productsData = await getProducts();
      const activeProducts = productsData.filter((p) => (p.status || 'active') === 'active');
      setProducts(activeProducts);

      const stockData = await getDailyStock(route, date);

      const salesData = await getSalesFor(date, route);

      const saleItemsWithStock = productsData.flatMap(product => {
        let initialBox = 0, initialPcs = 0;
        if (stockData?.stock) {
          const items = stockData.stock;
          const boxStock = items.find(s => s.productId === product.id && s.unit === 'box');
          const pcsStock = items.find(s => s.productId === product.id && (s.unit === 'pcs' || !('unit' in s)));
          initialBox = boxStock?.quantity || 0;
          initialPcs = pcsStock?.quantity || 0;
        }

        let soldBoxes = 0, soldPcs = 0;
        if (salesData) {
          salesData.forEach((sale) => {
            const items = normalizeSaleProducts(sale.products_sold);
            items.forEach((p) => {
              if (p.productId === product.id) {
                const q = p.quantity || 0;
                if ((p.unit || 'pcs') === 'box') soldBoxes += q; else soldPcs += q;
              }
            });
          });
        }
        const ppb = getPcsPerBoxFromProduct(product);
        const startTotalPcs = (initialBox * ppb) + initialPcs;
        const soldTotalPcs = (soldBoxes * ppb) + soldPcs;
        const remainingTotalPcs = Math.max(0, startTotalPcs - soldTotalPcs);
        const availableBox = Math.floor(remainingTotalPcs / ppb);
        const availablePcs = remainingTotalPcs % ppb;

        return [
          { productId: product.id, productName: product.name, unit: 'box' as const, quantity: 0, price: product.box_price ?? product.price, total: 0, availableStock: availableBox },
          { productId: product.id, productName: product.name, unit: 'pcs' as const, quantity: 0, price: product.pcs_price ?? ((product.box_price ?? product.price) / ppb), total: 0, availableStock: availablePcs }
        ];
      });
      setSaleItems(saleItemsWithStock);

      if (!stockData) {
        toast({ title: "No Stock Set", description: "Please set initial stock for today's route first", variant: "destructive" });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({ title: "Error", description: `Failed to load data: ${errorMessage}`, variant: "destructive" });
    }
  }, [toast, normalizeSaleProducts]);


  // --- updateQuantity, setQuantityDirect with auto-cut logic ---
  const getPcsPerBox = (productId: string): number => {
    const p = products.find(pr => pr.id === productId);
    if (!p) return 24;
    if (typeof p.pcs_per_box === 'number' && p.pcs_per_box > 0) return p.pcs_per_box as number;
    const pcs = p.pcs_price ?? ((p.box_price ?? p.price) / 24);
    const box = p.box_price ?? p.price;
    const ratio = Math.round(box / (pcs || 1));
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 24;
  };

  const updateQuantity = (productId: string, unit: 'box' | 'pcs', change: number) => {
    setSaleItems(prev => {
      const boxItem = prev.find(i => i.productId === productId && i.unit === 'box');
      const pcsItem = prev.find(i => i.productId === productId && i.unit === 'pcs');
      const boxAvail = boxItem?.availableStock ?? 0;
      const pcsAvail = pcsItem?.availableStock ?? 0;

      if (unit === 'box') {
        const maxAllowed = boxAvail;
        return prev.map(item =>
          item.productId === productId && item.unit === 'box'
            ? { ...item, quantity: Math.max(0, Math.min(maxAllowed, item.quantity + change)), total: Math.max(0, Math.min(maxAllowed, item.quantity + change)) * item.price }
            : item
        );
      } else {
        const ppb = getPcsPerBox(productId);
        const maxAllowed = pcsAvail + boxAvail * ppb; // allow cutting boxes automatically
        return prev.map(item =>
          item.productId === productId && item.unit === 'pcs'
            ? { ...item, quantity: Math.max(0, Math.min(maxAllowed, item.quantity + change)), total: Math.max(0, Math.min(maxAllowed, item.quantity + change)) * item.price }
            : item
        );
      }
    });
  };

  const setQuantityDirect = (productId: string, unit: 'box' | 'pcs', quantity: number) => {
    setSaleItems(prev => {
      const boxItem = prev.find(i => i.productId === productId && i.unit === 'box');
      const pcsItem = prev.find(i => i.productId === productId && i.unit === 'pcs');
      const boxAvail = boxItem?.availableStock ?? 0;
      const pcsAvail = pcsItem?.availableStock ?? 0;

      if (unit === 'box') {
        const maxAllowed = boxAvail;
        return prev.map(item =>
          item.productId === productId && item.unit === 'box'
            ? { ...item, quantity: Math.max(0, Math.min(maxAllowed, quantity)), total: Math.max(0, Math.min(maxAllowed, quantity)) * item.price }
            : item
        );
      } else {
        const ppb = getPcsPerBox(productId);
        const maxAllowed = pcsAvail + boxAvail * ppb;
        return prev.map(item =>
          item.productId === productId && item.unit === 'pcs'
            ? { ...item, quantity: Math.max(0, Math.min(maxAllowed, quantity)), total: Math.max(0, Math.min(maxAllowed, quantity)) * item.price }
            : item
        );
      }
    });
  };
  const updatePrice = (productId: string, unit: 'box' | 'pcs', newPrice: number) => {
    setSaleItems(prev =>
      prev.map(item => {
        if (item.productId === productId && item.unit === unit) {
          const validPrice = (Number.isFinite(newPrice) && newPrice >= 0) ? newPrice : 0;
          return { ...item, price: validPrice, total: item.quantity * validPrice };
        }
        return item;
      })
    );
  };



  // --- calculateTotal, getSoldItems, isValidPhone, isValidForBilling remain the same ---
  const calculateTotal = () => saleItems.reduce((sum, item) => sum + item.total, 0);
  const getSoldItems = () => saleItems.filter(item => item.quantity > 0);
  const isValidPhone = (p: string) => /^\d{10}$/.test(p);
  const isValidForBilling = () => {
    const sold = getSoldItems();
    return sold.length > 0 && sold.every(item => item.quantity > 0 && item.price >= 0);
  };

  const handleGenerateBill = () => {
    if (!shopName.trim()) {
      toast({ title: "Error", description: "Please enter shop name", variant: "destructive" });
      return;
    }
    if (!isValidPhone(shopPhone)) {
      toast({ title: "Error", description: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    if (!isValidForBilling()) {
      toast({ title: "Error", description: "Please add products with valid quantity and non-negative price (₹0 allowed)", variant: "destructive" });
      return;
    }
    setShowBillPreviewUI(true); // Show the preview UI
  };

  // *** FIXED handlePrintBill function ***
  const handlePrintBill = async () => {
    // Make printing synchronous with the user click to fix mobile blank preview
    setLoading(true);

    const soldItems = getSoldItems();
    // Build snapshot for print content
    const snapshot = {
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim(),
      shopPhone: shopPhone.trim(),
      routeName: currentRouteName,
      items: soldItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      total: calculateTotal(),
    };
    setPrintSnapshot(snapshot);
    const saleData = {
      auth_user_id: authUserId || "00000000-0000-0000-0000-000000000000",
      shop_name: shopName,
      date: currentDate,
      products_sold: {
        items: snapshot.items,
        shop_address: shopAddress,
        shop_phone: shopPhone,
      },
      total_amount: snapshot.total,
      route_id: currentRoute,
      truck_id: "00000000-0000-0000-0000-000000000000",
    };

    // 1) Trigger print immediately (synchronously) to preserve mobile gesture context
    window.print();

    // 2) After print dialog opens, ensure shop exists and persist the sale
    try {
      try {
        await createShop({ name: shopName.trim(), phone: shopPhone.trim(), village: shopAddress.trim(), address: shopAddress.trim(), route_id: currentRoute || undefined });
      } catch {}
      const saleForAppend: Omit<Sale, 'id' | 'created_at'> = {
        route_id: currentRoute,
        date: currentDate,
        shop_name: shopName,
        products_sold: {
          items: snapshot.items,
          shop_address: shopAddress,
          shop_phone: shopPhone,
        },
        total_amount: snapshot.total,
      };
      await appendSale(saleForAppend);

      // Persist shop hinting info
      if (currentRoute && shopName.trim()) {
        saveShopNameToLocal(currentRoute, shopName.trim());
        saveShopDetailsToLocal(currentRoute, shopName.trim(), shopAddress.trim(), shopPhone.trim());
      }

      // Do not mutate daily_stock here. It must represent the start-of-day stock
      // so that Day Summary can calculate Remaining = Start - Sold correctly.
      // Instead, immediately refresh availability by subtracting today's sales
      if (currentRoute && currentDate) {
        await fetchProductsAndStock(currentRoute, currentDate);
        // Reset current quantities so the next shop starts clean
        setSaleItems(prev => prev.map(i => ({ ...i, quantity: 0, total: 0 })));
      }
      setLoading(false);
      toast({ title: "Saved", description: "Bill saved successfully." });
    } catch (error: unknown) {
      const msg = (error as { message?: string }).message || "Failed to save bill";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };


  const handleBackToForm = () => {
    setShowBillPreviewUI(false); // Hide the preview UI
  };

  const totalAmount = calculateTotal();
  const soldItemsCount = getSoldItems().length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-success-green-light/10">
      {/* Header - Remains the same */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/driver/dashboard")} className="h-9 w-9 p-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-success-green to-accent rounded-lg sm:rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">Shop Billing</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">Create bills for shop sales</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentRouteName && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Route</p>
                  <p className="text-sm sm:text-base font-semibold text-primary">{currentRouteName}</p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (currentRoute && currentDate) {
                    fetchProductsAndStock(currentRoute, currentDate);
                  }
                }}
                className="h-9 w-9 p-0"
                title="Refresh products"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-safe">
        {!showBillPreviewUI ? (
          // Billing Form - Remains the same structure
          <Card className="border-0 shadow-strong">
            <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl font-bold">New Sale</CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Enter shop details and select products
              </CardDescription>
              {currentRouteName && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-semibold text-primary">
                    📍 Route: {currentRouteName}
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="px-4 sm:px-6">
              <div className="space-y-6 sm:space-y-8">
                {/* Shop Name Input with suggestions */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Shop Name
                  </Label>
                  <div className="relative">
                    <Input
                      type="text" placeholder="Enter shop name" value={shopName}
                      onChange={(e) => {
                        const value = e.target.value; setShopName(value);
                        setShowSuggestions(value.trim().length >= 1);
                        if (value.trim().length >= 1 && currentRoute) {
                          const details = getShopDetailsFromLocal(currentRoute, value.trim());
                          if (details) { if (typeof details.address === 'string') setShopAddress(details.address); if (typeof details.phone === 'string') setShopPhone(details.phone); }
                        }
                      }}
                      onFocus={() => { if (shopName.trim().length >= 1) setShowSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      className="h-11 sm:h-10 text-base" required
                    />
                    {showSuggestions && (serverShopSuggestions.length > 0 || localNameMatches.length > 0) && (
                      <div className="absolute z-20 left-0 right-0 mt-2 bg-background border border-border rounded-md shadow-soft max-h-48 overflow-auto">
                        {(serverShopSuggestions.length > 0 ? serverShopSuggestions.map(s => s.name) : localNameMatches).map((name) => (
                          <div key={name} className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted text-sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setShopName(name); setShowSuggestions(false);
                              const s = serverShopSuggestions.find(ss => ss.name === name);
                              if (s) {
                                if (s.village) setShopAddress(s.village);
                                if (s.address) setShopAddress(s.address);
                                if (s.phone) setShopPhone(s.phone);
                              } else if (currentRoute) {
                                const details = getShopDetailsFromLocal(currentRoute, name);
                                if (details) { if (typeof details.address === 'string') setShopAddress(details.address); if (typeof details.phone === 'string') setShopPhone(details.phone); }
                              }
                            }}
                          >
                            <span className="truncate">{name}</span>
                            <button type="button" className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remove"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                if (currentRoute) {
                                  removeShopName(currentRoute, name);
                                  const value = shopName.trim();
                                  if (!(value.length >= 1)) { setShowSuggestions(false); }
                                }
                              }}
                            > <X className="w-4 h-4" /> </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Address Input with suggestions */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Address / Village</Label>
                  <div className="relative">
                    <Input type="text" placeholder="Enter address or village name" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} className="h-11 sm:h-10 text-base" />
                    {serverVillageSuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-2 bg-background border border-border rounded-md shadow-soft max-h-48 overflow-auto">
                        {serverVillageSuggestions.map((s) => (
                          <div key={s.id} className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted text-sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setShopAddress(s.village || s.address || '');
                              if (s.name) setShopName(s.name);
                              if (s.phone) setShopPhone(s.phone);
                              setShowSuggestions(false);
                            }}
                          >
                            <span className="truncate">{s.village || s.address || ''}</span>
                            {s.name && (<span className="ml-2 text-xs text-muted-foreground truncate">{s.name}</span>)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Phone Input - remains same */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2"><Phone className="w-4 h-4" /> Phone Number</Label>
                  <Input type="tel" inputMode="numeric" placeholder="Enter 10-digit mobile number" value={shopPhone}
                    onChange={(e) => { const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10); setShopPhone(digitsOnly); }}
                    pattern="[0-9]{10}" maxLength={10} className="h-11 sm:h-10 text-base"
                  />
                  {shopPhone && !isValidPhone(shopPhone) && (<p className="text-xs text-destructive-dark font-medium">Enter 10-digit mobile number</p>)}
                </div>

                {/* Products Selection Section - remains same structure */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base sm:text-lg font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" /> Select Products</Label>
                    <div className="flex items-center gap-2">
                      <div className="text-xs sm:text-sm text-muted-foreground">Items: <span className="font-semibold text-primary">{soldItemsCount}</span></div>
                    </div>
                  </div>
                  {/* Quick Edit Added Items - remains same */}
                  <div className="space-y-2">
                    {saleItems.filter(i => i.quantity > 0).length > 0 && (
                      <div className="rounded-md border p-3">
                        <div className="text-sm font-semibold mb-2">Added Items</div>
                        <div className="space-y-2">
                          {saleItems.filter(i => i.quantity > 0).map(i => (
                            <div key={`${i.productId}-${i.unit}`} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2"><span className="text-sm">{i.productName}</span><span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{i.unit === 'pcs' ? 'pcs' : 'Box'}</span></div>
                              <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(i.productId, i.unit, -1)} className="h-8 w-8"><Minus className="w-4 h-4" /></Button>
                                <Input type="text" value={String(i.quantity)}
                                  onChange={(e) => { const sanitized = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '') || '0'; const val = Math.max(0, parseInt(sanitized) || 0); setQuantityDirect(i.productId, i.unit, val); }}
                                  className="w-16 text-center h-8" inputMode="numeric" pattern="[0-9]*"
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(i.productId, i.unit, 1)} className="h-8 w-8"><Plus className="w-4 h-4" /></Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setQuantityDirect(i.productId, i.unit, 0)} className="h-8 w-8" title="Remove"><X className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Product Cards List - remains same */}
                  <div className="grid gap-3 sm:gap-4">
                    {(products.map((prod) => ({ prod, avail: (saleItems.find(s => s.productId === prod.id && s.unit === 'box')?.availableStock || 0) + (saleItems.find(s => s.productId === prod.id && s.unit === 'pcs')?.availableStock || 0) })).filter(item => item.avail > 0).map(x => x.prod)).map((product) => {
                      const boxItem = saleItems.find(s => s.productId === product.id && s.unit === 'box'); const pcsItem = saleItems.find(s => s.productId === product.id && s.unit === 'pcs'); const boxAvail = boxItem?.availableStock || 0; const pcsAvail = pcsItem?.availableStock || 0; const boxQty = boxItem?.quantity || 0; const pcsQty = pcsItem?.quantity || 0; const boxPrice = boxItem?.price ?? (product.box_price ?? product.price); const pcsPrice = pcsItem?.price ?? (product.pcs_price ?? ((product.box_price ?? product.price ?? 0) / 24)); const availableStock = boxAvail + pcsAvail; const lineTotal = (boxItem?.total || 0) + (pcsItem?.total || 0);
                      return (
                        <Card key={product.id} className={`border transition-colors active:border-primary ${availableStock === 0 ? 'border-destructive/50 opacity-60' : 'border-border hover:border-primary/50'}`}>
                          <CardContent className="p-3 sm:p-4"><div className="space-y-3">
                            <div className="flex items-center gap-2 mb-2"><h4 className="font-semibold text-foreground text-base">{product.name}</h4>{availableStock === 0 && (<span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">Out of Stock</span>)}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-2"> {/* Box */}
                                <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Unit: Box</span><span className="text-xs text-muted-foreground">Avail: {boxAvail} Box</span></div>
                                <div className="space-y-1"><Label className="text-xs font-medium text-muted-foreground">Price (₹)</Label><Input type="number" value={boxPrice} onChange={(e) => { const v = e.target.value; const num = v === '' ? 0 : parseFloat(v); updatePrice(product.id, 'box', Number.isFinite(num) ? num : 0); }} className="h-9 text-sm" min="0" step="0.01" disabled={boxAvail === 0} placeholder={`${product.box_price ?? product.price}`} /></div>
                                <div className="space-y-1"><Label className="text-xs font-medium text-muted-foreground">Quantity (Box)</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(product.id, 'box', -1)} disabled={boxQty === 0} className="h-9 w-9"><Minus className="w-4 h-4" /></Button><Input type="text" value={String(boxQty)} onChange={(e) => { const sanitized = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '') || '0'; const newQuantity = Math.max(0, parseInt(sanitized) || 0); setQuantityDirect(product.id, 'box', newQuantity); }} className="w-16 text-center text-sm h-9" inputMode="numeric" pattern="[0-9]*" disabled={boxAvail === 0} /><Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(product.id, 'box', 1)} disabled={boxQty >= boxAvail || boxAvail === 0} className="h-9 w-9"><Plus className="w-4 h-4" /></Button></div></div>
                              </div>
                              <div className="space-y-2"> {/* Pcs */}
                                <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Unit: 1 pcs</span><span className="text-xs text-muted-foreground">Avail: {pcsAvail} pcs</span></div>
                                {(() => {
                                  const ppb = getPcsPerBox(product.id); const maxPcsCapacity = pcsAvail + boxAvail * ppb; return (
                                    <>
                                      <div className="space-y-1"><Label className="text-xs font-medium text-muted-foreground">Price (₹)</Label><Input type="number" value={pcsPrice} onChange={(e) => { const v = e.target.value; const num = v === '' ? 0 : parseFloat(v); updatePrice(product.id, 'pcs', Number.isFinite(num) ? num : 0); }} className="h-9 text-sm" min="0" step="0.01" disabled={maxPcsCapacity === 0} placeholder={`${product.pcs_price ?? ((product.box_price ?? product.price) / 24)}`} /></div>
                                      <div className="space-y-1"><Label className="text-xs font-medium text-muted-foreground">Quantity (pcs)</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(product.id, 'pcs', -1)} disabled={pcsQty === 0} className="h-9 w-9"><Minus className="w-4 h-4" /></Button><Input type="text" value={String(pcsQty)} onChange={(e) => { const sanitized = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '') || '0'; const newQuantity = Math.max(0, parseInt(sanitized) || 0); setQuantityDirect(product.id, 'pcs', newQuantity); }} className="w-16 text-center text-sm h-9" inputMode="numeric" pattern="[0-9]*" disabled={maxPcsCapacity === 0} /><Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(product.id, 'pcs', 1)} disabled={pcsQty >= maxPcsCapacity || maxPcsCapacity === 0} className="h-9 w-9"><Plus className="w-4 h-4" /></Button></div></div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t"><div className="space-y-1"><p className="text-sm font-semibold text-warning-dark">Available: {boxAvail} Box, {pcsAvail} pcs</p></div>{(boxQty + pcsQty) > 0 && (<div className="text-right"><p className="text-sm font-semibold text-success-green-dark">Line Total: ₹{lineTotal.toFixed(2)}</p></div>)}</div>
                          </div></CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Total Amount - remains same */}
                <div className="bg-primary-light/30 border-2 border-primary rounded-lg p-4">
                  <div className="flex items-center justify-between"><span className="text-lg sm:text-xl font-bold text-gray-900">Total Amount:</span><span className="text-2xl sm:text-3xl font-bold text-primary-dark">₹{totalAmount.toFixed(2)}</span></div>
                </div>
                {/* Generate Bill Button - remains same */}
                <div className="sticky bottom-3 sm:static bg-background/95 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none p-1 sm:p-0 -mx-2 sm:mx-0 rounded-md sm:rounded-none">
                  <Button onClick={handleGenerateBill} variant="success" size="default" className="w-full h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation shadow sm:shadow-none text-white" disabled={!shopName.trim() || !isValidForBilling() || !isValidPhone(shopPhone)}><Check className="w-5 h-5 mr-2" /> Generate Bill</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Bill Preview & Print UI - Remains the same structure
          <>
            <div className="space-y-4">
              <Card className="border-0 shadow-strong print:hidden">
                <CardHeader className="text-center pb-4 px-4 sm:px-6"><CardTitle className="text-xl sm:text-2xl font-bold text-success-green-dark">Bill Generated!</CardTitle><CardDescription className="text-sm sm:text-base text-gray-700">Review and print the bill</CardDescription></CardHeader>
                <CardContent className="px-4 sm:px-6 space-y-4">
                  <div className="sticky bottom-3 sm:static bg-background/95 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none p-1 sm:p-0 -mx-2 sm:mx-0 rounded-md sm:rounded-none">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <Button onClick={handlePrintBill} variant="success" size="default" className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation w-full sm:w-auto shadow sm:shadow-none text-white" disabled={loading}><Printer className="w-5 h-5 mr-2" />{loading ? "Printing..." : "Print Bill"}</Button>
                      <Button onClick={handleBackToForm} variant="outline" size="default" className="h-10 sm:h-11 px-4 sm:px-6 touch-manipulation w-full sm:w-auto shadow sm:shadow-none">Edit</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-strong print:hidden">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="text-center"><h2 className="text-xl font-bold">BHAVYA ENTERPRICE</h2><p className="text-sm">Sales Invoice</p></div>
                    <div className="border-t pt-4"><p className="font-semibold">Shop: {shopName}</p>{shopAddress && <p className="text-sm text-muted-foreground">Address: {shopAddress}</p>}{shopPhone && <p className="text-sm text-muted-foreground">Phone: {shopPhone}</p>}</div>
                    <div className="border-t pt-4">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="text-left py-2">Item</th><th className="text-center py-2">Qty</th><th className="text-right py-2">Rate</th><th className="text-right py-2">Amount</th></tr></thead>
                        <tbody>{getSoldItems().map((item, index) => (<tr key={`${item.productId}-${item.unit}-${index}`} className="border-b"><td className="py-2">{item.productName}</td><td className="text-center py-2">{item.quantity} {item.unit === 'box' ? 'Box' : 'pcs'}</td><td className="text-right py-2">₹{item.price.toFixed(2)}</td><td className="text-right py-2 font-semibold">₹{item.total.toFixed(2)}</td></tr>))}</tbody>
                      </table>
                    </div>
                    <div className="border-t pt-4"><div className="flex justify-between items-center"><span className="text-lg font-bold text-gray-900">TOTAL:</span><span className="text-2xl font-bold text-success-green-dark">₹{totalAmount.toFixed(2)}</span></div></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Portal for Print Content - Now always rendered */}
      {createPortal(
        <div id="print-receipt-container" style={{ display: 'none' }}> {/* Initially hidden */}
          <div className="receipt-58mm">
            {/* Bill Header */}
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <h1 style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>BHAVYA ENTERPRICE</h1>
              <p style={{ margin: '0', fontSize: '10px', fontWeight: '600' }}>Sales Invoice</p>
              <div style={{ marginTop: '2px', fontSize: '8px' }}>
                <p style={{ margin: '0', lineHeight: '1.1' }}>Near Bala petrol pump</p>
                <p style={{ margin: '0', lineHeight: '1.1' }}>Jambusar Bharuch road</p>
              </div>
              <div style={{ marginTop: '2px', fontSize: '8px' }}>
                <p style={{ margin: '0', lineHeight: '1.1' }}>Phone: 8866756059</p>
                <p style={{ margin: '0', lineHeight: '1.1' }}>GSTIN: 24EVVPS8220P1ZF</p>
              </div>
              <div style={{ marginTop: '2px', fontSize: '8px' }}>
                <p style={{ margin: '0' }}>Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                {(printSnapshot?.routeName || currentRouteName) && (<p style={{ margin: '0', fontWeight: 'bold' }}>Route: {printSnapshot?.routeName || currentRouteName}</p>)}
              </div>
            </div>
            {/* Shop Details */}
            <div style={{ marginBottom: '4px', paddingBottom: '2px', borderTop: '1px dashed black', borderBottom: '1px dashed black', paddingTop: '2px' }}>
              <p style={{ fontSize: '9px', fontWeight: '600', margin: '0' }}>Shop: {printSnapshot?.shopName || shopName}</p>
              {(printSnapshot?.shopAddress || shopAddress) && (<p style={{ fontSize: '8px', margin: '0' }}>Addr: {printSnapshot?.shopAddress || shopAddress}</p>)}
              {(printSnapshot?.shopPhone || shopPhone) && (<p style={{ fontSize: '8px', margin: '0' }}>Ph: {printSnapshot?.shopPhone || shopPhone}</p>)}
            </div>
            {/* Products Table */}
            <div style={{ marginBottom: '4px' }}>
              <table style={{ width: '100%', fontSize: '8px', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px dashed black' }}><th style={{ textAlign: 'left', padding: '1px 0', fontSize: '8px' }}>Item</th><th style={{ textAlign: 'center', padding: '1px 0', fontSize: '8px' }}>Qty</th><th style={{ textAlign: 'right', padding: '1px 0', fontSize: '8px' }}>Rate</th><th style={{ textAlign: 'right', padding: '1px 0', fontSize: '8px' }}>Amt</th></tr></thead>
                <tbody>
                  {(printSnapshot?.items || getSoldItems()).map((item, index) => (
                    <tr key={`${item.productId}-${item.unit}-${index}`}>
                      <td style={{ padding: '1px 0', fontSize: '8px' }}>{item.productName}</td>
                      <td style={{ padding: '1px 0', textAlign: 'center', fontSize: '8px' }}>{item.quantity} {item.unit === 'box' ? 'Box' : 'pcs'}</td>
                      <td style={{ padding: '1px 0', textAlign: 'right', fontSize: '8px' }}>₹{item.price.toFixed(2)}</td>
                      <td style={{ padding: '1px 0', textAlign: 'right', fontSize: '8px', fontWeight: '600' }}>₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Total Section */}
            <div style={{ borderTop: '1px dashed black', paddingTop: '2px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '11px', fontWeight: 'bold' }}>TOTAL:</span><span style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{(printSnapshot?.total ?? calculateTotal()).toFixed(2)}</span></div>
              <div style={{ fontSize: '8px', textAlign: 'right' }}>Items: {(printSnapshot?.items || getSoldItems()).reduce((sum, it) => sum + (it.quantity || 0), 0)}</div>
            </div>
            {/* Footer */}
            <div style={{ marginTop: '4px', paddingTop: '2px', borderTop: '1px dashed black', textAlign: 'center' }}>
              <p style={{ fontSize: '9px', fontWeight: '600', margin: '0' }}>Thank you for your business!</p>
              <p style={{ fontSize: '8px', margin: '0' }}>Have a great day!</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Print Styles - Remain the same */}
      <style>{`
        @media print {
          /* Hide everything except the portal */
          body > *:not(#print-receipt-container) { display: none !important; }
          #print-receipt-container { display: block !important; } /* Make portal visible */

          @page { size: 58mm auto; margin: 0mm; }
          html, body { margin: 0 !important; padding: 0 !important; background-color: #fff !important; width: 58mm !important; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
          .receipt-58mm { display: block !important; width: 58mm !important; max-width: 58mm !important; margin: 0 !important; padding: 2mm !important; background: white !important; color: #000 !important; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important; font-size: 9px !important; line-height: 1.15 !important; page-break-after: avoid !important; page-break-inside: avoid !important; box-sizing: border-box !important; }
          .receipt-58mm * { color: #000 !important; border-color: #000 !important; box-shadow: none !important; border-radius: 0 !important; }
          .receipt-58mm p { margin: 0 !important; }
          .receipt-58mm h1 { font-size: 12px !important; font-weight: bold !important; margin: 2px 0 !important; text-align: center !important; }
          .receipt-58mm table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 2px 0 !important; }
          .receipt-58mm th, .receipt-58mm td { padding: 1px 2px !important; font-size: 9px !important; white-space: normal !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
          .receipt-58mm th { font-weight: bold !important; border-bottom: 1px dashed black !important; }
          .receipt-58mm th:nth-child(1), .receipt-58mm td:nth-child(1) { width: 52% !important; } .receipt-58mm th:nth-child(2), .receipt-58mm td:nth-child(2) { width: 14% !important; } .receipt-58mm th:nth-child(3), .receipt-58mm td:nth-child(3) { width: 16% !important; } .receipt-58mm th:nth-child(4), .receipt-58mm td:nth-child(4) { width: 18% !important; }
          .receipt { width: 58mm !important; margin: 0 !important; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important; color: #000 !important; }
          .print-container { padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ShopBilling;

