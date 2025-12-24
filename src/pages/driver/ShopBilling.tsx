import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { useToast } from "../../hooks/use-toast";
import {
  getAssignedStockForBilling,
  searchAssignedProductsInStock,
  saveSale,
  updateStockAfterSaleRPC,
  updateStockAfterSaleRouteRPC,
  updateDailyStockAfterSale,
  updateDriverStockAfterSale,
  getRouteAssignedStock,
  getProducts,
  getActiveRoutes,
  getTrucks,
  getDriverRoute,
  subscribeAssignedStockForRouteDate,
  type Product,
  type DailyStockItem,
  type ShopBillItem,
} from "../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { mapRouteName } from "../../lib/routeUtils";
import { useAuth } from "../../contexts/AuthContext";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Printer,
  Store,
  Check,
  RefreshCw,
  Route as RouteIcon,
  MapPin,
  Phone,
} from "lucide-react";
import AddProductModal from "../../components/driver/AddProductModal";
import ProductQuantityCard from "../../components/driver/ProductQuantityCard";

interface CartItem {
  product: Product;
  stock: DailyStockItem;
  boxQty: number;
  pcsQty: number;
  boxPrice: number;
  pcsPrice: number;
  totalAmount: number;
}

const ShopBilling = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Route/Truck/Date
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [routeName, setRouteName] = useState("");

  // Shop details
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");

  const fillDevDetails = () => {
    const name = shopName?.trim() ? shopName : "BHAVYA ENTERPRICE";
    const addr = shopAddress?.trim() ? shopAddress : "Dev Village";
    const phone = shopPhone?.trim() ? shopPhone : "9999999999";
    setShopName(name);
    setShopAddress(addr);
    setShopPhone(phone);
    console.log("Dev: temporary shop details set", { name, addr, phone });
  };

  useEffect(() => {
    if (import.meta.env.DEV) {
      if (!shopName && !shopAddress && !shopPhone) {
        fillDevDetails();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Products
  const [availableProducts, setAvailableProducts] = useState<
    Array<{ product: Product; stock: DailyStockItem }>
  >([]);
  const assignedSubRef = useRef<RealtimeChannel | null>(null);
  const [cartItems, setCartItems] = useState<Record<string, CartItem>>({});
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [showBillPreviewUI, setShowBillPreviewUI] = useState(false);
  // Snapshot to ensure printed data is consistent and not affected by state resets
  const [printSnapshot, setPrintSnapshot] = useState<null | {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    routeName: string;
    items: Array<{
      productId: string;
      productName: string;
      boxQty: number;
      pcsQty: number;
      price: number;
      total: number;
    }>;
    total: number;
  }>(null);

  // Load route/truck/date from localStorage
  useEffect(() => {
    const loadRoute = async () => {
      const route = await getDriverRoute();
      if (route) {
        setSelectedRoute(route.routeId);
        setSelectedTruck(route.truckId);
        setSelectedDate(route.date);
      } else {
        // Fallback to localStorage if getDriverRoute doesn't work
        const routeId = localStorage.getItem("currentRoute");
        const truckId = localStorage.getItem("currentTruck");
        const date =
          localStorage.getItem("currentDate") ||
          format(new Date(), "yyyy-MM-dd");
        if (routeId) setSelectedRoute(routeId);
        if (truckId) setSelectedTruck(truckId);
        if (date) setSelectedDate(date);
        if (!routeId) {
          const routes = await getActiveRoutes();
          if (routes.length > 0) {
            setSelectedRoute(routes[0].id);
          }
        }
      }
    };
    loadRoute();
  }, []);

  // Load route name
  useEffect(() => {
    const loadRouteName = async () => {
      if (selectedRoute) {
        const routes = await getActiveRoutes();
        const route = routes.find((r) => r.id === selectedRoute);
        if (route) {
          setRouteName(mapRouteName(route.name));
        }
      }
    };
    loadRouteName();
  }, [selectedRoute]);

  // Load assigned stock
  useEffect(() => {
    // For assigned routes, truck is optional - only need route and date
    if (selectedRoute && selectedDate) {
      loadAssignedStock();
    }
  }, [selectedRoute, selectedTruck, selectedDate]);

  useEffect(() => {
    let mounted = true;
    const doSub = async () => {
      if (!selectedRoute || !selectedDate || !mounted) return;
      assignedSubRef.current?.unsubscribe?.();
      assignedSubRef.current = subscribeAssignedStockForRouteDate(
        selectedRoute,
        selectedDate,
        loadAssignedStock
      );
    };
    doSub();
    return () => {
      mounted = false;
      assignedSubRef.current?.unsubscribe?.();
    };
  }, [selectedRoute, selectedDate]);

  const loadAssignedStock = async () => {
    // For assigned routes, truck is optional - only need route and date
    if (!selectedRoute || !selectedDate) {
      console.log("Cannot load stock - missing route or date:", {
        selectedRoute,
        selectedDate,
      });
      return;
    }

    try {
      setLoadingStock(true);
      const driverId = user?.id || null;
      console.log("Loading assigned stock for:", {
        route: selectedRoute,
        date: selectedDate,
        driverId,
      });

      // Get both driver-assigned stock (if logged in) and route-only stock
      const stockPromises: Promise<
        Array<{ product: Product; stock: DailyStockItem }>
      >[] = [];

      // Try driver-assigned stock first if we have a driver ID
      if (driverId) {
        stockPromises.push(
          getAssignedStockForBilling(driverId, selectedRoute, selectedDate)
        );
      }

      // Also get route-only stock (driver_id IS NULL)
      stockPromises.push(
        getAssignedStockForBilling(null, selectedRoute, selectedDate)
      );

      // Get all stock results
      const stockResults = await Promise.all(stockPromises);

      // Combine and deduplicate by product ID (prefer driver-assigned over route-only)
      const stockMap = new Map<
        string,
        { product: Product; stock: DailyStockItem }
      >();
      stockResults.forEach((stockArray) => {
        stockArray.forEach(({ product, stock: stockItem }) => {
          // Only add if product has available stock
          if ((stockItem.boxQty || 0) > 0 || (stockItem.pcsQty || 0) > 0) {
            const existing = stockMap.get(product.id);
            // Prefer driver-assigned stock if both exist, otherwise add new
            if (!existing || (driverId && stockArray === stockResults[0])) {
              stockMap.set(product.id, { product, stock: stockItem });
            }
          }
        });
      });

      const combinedStock = Array.from(stockMap.values());
      console.log("Combined stock:", combinedStock.length, "products");
      setAvailableProducts(combinedStock);

      // Initialize cart items for all products with available stock
      const initialCartItems: Record<string, CartItem> = {};
      combinedStock.forEach(({ product, stock: stockItem }) => {
        // Only add products that have available stock
        if ((stockItem.boxQty || 0) > 0 || (stockItem.pcsQty || 0) > 0) {
          const pcsPerBox = product.pcs_per_box || 24;
          const boxPrice = product.box_price || product.price || 0;
          const pcsPrice = product.pcs_price || boxPrice / pcsPerBox || 0;

          initialCartItems[product.id] = {
            product,
            stock: stockItem,
            boxQty: 0,
            pcsQty: 0,
            boxPrice,
            pcsPrice,
            totalAmount: 0,
          };
        }
      });
      setCartItems(initialCartItems);
      console.log(
        "Initialized cart items:",
        Object.keys(initialCartItems).length,
        "products"
      );
    } catch (error) {
      console.error("Error loading stock:", error);
      toast({
        title: "Error",
        description: `Failed to load assigned stock: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        variant: "destructive",
      });
    } finally {
      setLoadingStock(false);
    }
  };

  const handleAddProduct = (product: Product, stock: DailyStockItem) => {
    const pcsPerBox = product.pcs_per_box || 24;
    const boxPrice = product.box_price || product.price || 0;
    const pcsPrice = product.pcs_price || boxPrice / pcsPerBox || 0;

    setCartItems((prev) => ({
      ...prev,
      [product.id]: {
        product,
        stock,
        boxQty: 0,
        pcsQty: 0,
        boxPrice,
        pcsPrice,
        totalAmount: 0,
      },
    }));
  };

  const updateBoxQty = (productId: string, value: number) => {
    setCartItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;

      const newBoxQty = Math.max(0, Math.min(item.stock.boxQty || 0, value));
      const totalAmount =
        newBoxQty * item.boxPrice + item.pcsQty * item.pcsPrice;

      return {
        ...prev,
        [productId]: {
          ...item,
          boxQty: newBoxQty,
          totalAmount,
        },
      };
    });
  };

  const updatePcsQty = (productId: string, value: number) => {
    setCartItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;

      const pcsPerBox = item.product.pcs_per_box || 24;
      // Allow cutting boxes automatically - total available pcs includes boxes that can be converted
      const totalAvailablePcs =
        (item.stock.boxQty || 0) * pcsPerBox + (item.stock.pcsQty || 0);
      const maxPcsQty = totalAvailablePcs; // Allow using all available pcs (including from boxes)
      const newPcsQty = Math.max(0, Math.min(maxPcsQty, value));
      const totalAmount =
        item.boxQty * item.boxPrice + newPcsQty * item.pcsPrice;

      return {
        ...prev,
        [productId]: {
          ...item,
          pcsQty: newPcsQty,
          totalAmount,
        },
      };
    });
  };

  const updateBoxPrice = (productId: string, value: number) => {
    setCartItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;

      const totalAmount = item.boxQty * value + item.pcsQty * item.pcsPrice;

      return {
        ...prev,
        [productId]: {
          ...item,
          boxPrice: value,
          totalAmount,
        },
      };
    });
  };

  const updatePcsPrice = (productId: string, value: number) => {
    setCartItems((prev) => {
      const item = prev[productId];
      if (!item) return prev;

      const totalAmount = item.boxQty * item.boxPrice + item.pcsQty * value;

      return {
        ...prev,
        [productId]: {
          ...item,
          pcsPrice: value,
          totalAmount,
        },
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => {
      const newCart = { ...prev };
      delete newCart[productId];
      return newCart;
    });
  };

  // Calculate totals
  const totals = useMemo(() => {
    const items = Object.values(cartItems).filter(
      (item) => item.boxQty > 0 || item.pcsQty > 0
    );
    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
    return { totalAmount };
  }, [cartItems]);

  // Phone validation
  const isValidPhone = (p: string) => p.trim() === "" || /^\d{10}$/.test(p);

  // Validation
  const isFormValid = useMemo(() => {
    if (!selectedRoute || !selectedDate) return false;
    // Truck is optional for assigned routes, but required for regular routes
    // For now, we'll allow empty truck for assigned routes
    if (!selectedTruck && availableProducts.length === 0) return false;
    if (!shopName.trim()) return false;
    if (shopPhone.trim() && !isValidPhone(shopPhone)) return false;
    const hasItems = Object.values(cartItems).some(
      (item) => item.boxQty > 0 || item.pcsQty > 0
    );
    if (!hasItems) return false;

    // Check stock availability (with auto-cut logic - pcs can use boxes)
    for (const item of Object.values(cartItems)) {
      if (item.boxQty > 0 || item.pcsQty > 0) {
        const pcsPerBox = item.product.pcs_per_box || 24;
        const totalAvailablePcs =
          (item.stock.boxQty || 0) * pcsPerBox + (item.stock.pcsQty || 0);
        const totalRequestedPcs = item.boxQty * pcsPerBox + item.pcsQty;
        // Allow pcs to use boxes automatically, so check total available pcs
        if (totalRequestedPcs > totalAvailablePcs) {
          return false;
        }
        // Check box quantity doesn't exceed available boxes (boxes can't be cut from other boxes)
        if (item.boxQty > (item.stock.boxQty || 0)) {
          return false;
        }
      }
    }

    return true;
  }, [selectedRoute, selectedTruck, selectedDate, shopName, cartItems]);

  const handleGenerateBill = () => {
    if (!shopName.trim()) {
      toast({
        title: "Error",
        description: "Please enter shop name",
        variant: "destructive",
      });
      return;
    }
    if (shopPhone.trim() && !isValidPhone(shopPhone)) {
      toast({
        title: "Error",
        description: "Enter a valid 10-digit mobile number",
        variant: "destructive",
      });
      return;
    }
    if (!isFormValid) {
      toast({
        title: "Error",
        description:
          "Please add products with valid quantity and non-negative price (₹0 allowed)",
        variant: "destructive",
      });
      return;
    }
    setShowBillPreviewUI(true); // Show the preview UI
  };

  // Get sold items for preview/print
  const getSoldItems = () => {
    return Object.values(cartItems)
      .filter((item) => item.boxQty > 0 || item.pcsQty > 0)
      .map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        boxQty: item.boxQty,
        pcsQty: item.pcsQty,
        price: item.boxQty > 0 ? item.boxPrice : item.pcsPrice,
        total: item.totalAmount,
      }));
  };

  // Handle print bill - saves and prints
  const handlePrintBill = async () => {
    // Make printing synchronous with the user click to fix mobile blank preview
    setLoading(true);

    const soldItems = getSoldItems();
    // Build snapshot for print content
    const snapshot = {
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim(),
      shopPhone: shopPhone.trim(),
      routeName: routeName,
      items: soldItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        boxQty: item.boxQty,
        pcsQty: item.pcsQty,
        price: item.price,
        total: item.total,
      })),
      total: totals.totalAmount,
    };
    setPrintSnapshot(snapshot);

    // 1) Trigger print immediately (synchronously) to preserve mobile gesture context
    window.print();

    // 2) After print dialog opens, persist the sale
    try {
      // Prepare bill items for stock deduction
      const billItems: ShopBillItem[] = soldItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        boxQty: item.boxQty,
        pcsQty: item.pcsQty,
        pricePerBox: item.boxQty > 0 ? item.price : 0,
        pricePerPcs: item.pcsQty > 0 ? item.price : 0,
        amount: item.total,
      }));

      // Build products_sold payload in old-portal shape
      const items = Object.values(cartItems)
        .filter((ci) => ci.boxQty > 0 || ci.pcsQty > 0)
        .flatMap((ci) => {
          const boxLine =
            ci.boxQty > 0
              ? [
                  {
                    productId: ci.product.id,
                    productName: ci.product.name,
                    unit: "box" as const,
                    quantity: ci.boxQty,
                    price: ci.boxPrice,
                    total: ci.boxQty * ci.boxPrice,
                  },
                ]
              : [];
          const pcsLine =
            ci.pcsQty > 0
              ? [
                  {
                    productId: ci.product.id,
                    productName: ci.product.name,
                    unit: "pcs" as const,
                    quantity: ci.pcsQty,
                    price: ci.pcsPrice,
                    total: ci.pcsQty * ci.pcsPrice,
                  },
                ]
              : [];
          return [...boxLine, ...pcsLine];
        });
      const products_sold = {
        items,
        shop_address: shopAddress.trim() || undefined,
        shop_phone: shopPhone.trim() || undefined,
      };

      const truckId =
        selectedTruck && /^[0-9a-fA-F-]{36}$/.test(selectedTruck)
          ? selectedTruck
          : null;
      const routeId = selectedRoute;
      const totalAmount = totals.totalAmount;
      const salePayload = {
        route_id: routeId,
        truck_id: truckId,
        shop_name: shopName.trim(),
        date: selectedDate,
        products_sold,
        total_amount: totalAmount,
      };
      console.log(
        "saveSale payload JSON:",
        JSON.stringify(
          {
            route_id: routeId,
            truck_id: truckId,
            shop_name: shopName,
            date: selectedDate,
            products_sold: items,
            total_amount: totalAmount,
          },
          null,
          2
        )
      );
      const savedSale = await saveSale(salePayload);
      console.log("Sale saved:", savedSale);

      // Update stock after sale
      const products = await getProducts();
      const saleItems = billItems.map((item) => {
        const p = products.find((pp) => pp.id === item.productId);
        const perBox = p?.pcs_per_box || 24;
        return {
          productId: item.productId,
          qty_pcs: (item.boxQty || 0) * perBox + (item.pcsQty || 0),
        };
      });
      const assignedRows = await getRouteAssignedStock(
        selectedRoute,
        selectedDate
      );
      const assignedIds = new Set(assignedRows.map((r) => r.product_id));
      // Relaxed validation: Log warning instead of throwing error
      // This allows sales even if assigned_stock table is out of sync with daily_stock
      for (const si of saleItems) {
        if (!assignedIds.has(si.productId)) {
          console.warn(
            "Assigned stock missing in assigned_stock table (but present in daily_stock)",
            {
              route_id: selectedRoute,
              date: selectedDate,
              productId: si.productId,
            }
          );
        }
      }
      // const strictValidation = import.meta.env.VITE_STRICT_ASSIGNED_STOCK_VALIDATION === 'true' || import.meta.env.DEV;
      // for (const si of saleItems) {
      //   if (!assignedIds.has(si.productId)) {
      //     console.error("Assigned stock missing", { route_id: selectedRoute, date: selectedDate, productId: si.productId });
      //     if (strictValidation) {
      //       throw new Error("Assigned stock missing for this product/route/date");
      //     }
      //   }
      // }
      console.log("Updating daily stock (client-side)...");
      const stockUpdateItems = billItems.map((item) => ({
        productId: item.productId,
        boxQty: item.boxQty || 0,
        pcsQty: item.pcsQty || 0,
      }));

      // Use driver-aware stock update (handles missing truckId if driver is logged in)
      await updateDriverStockAfterSale(
        user?.id || null,
        selectedRoute,
        truckId,
        selectedDate,
        stockUpdateItems,
        products
      );
      console.log("Daily stock updated successfully");

      // Refresh stock and reset quantities
      console.log("Reloading assigned stock after sale...");
      await loadAssignedStock();
      console.log("Assigned stock reloaded");
      setCartItems((prev) => {
        const updated: Record<string, CartItem> = {};
        Object.keys(prev).forEach((key) => {
          updated[key] = { ...prev[key], boxQty: 0, pcsQty: 0, totalAmount: 0 };
        });
        return updated;
      });
      setShopName("");
      setShopAddress("");
      setShopPhone("");
      console.log("Cleared cart quantities and reset shop details");

      setLoading(false);
      toast({ title: "Saved", description: "Bill saved successfully." });
      setShowBillPreviewUI(false);
    } catch (error: unknown) {
      console.error("Error during print+save flow:", error);
      const msg =
        (error as { message?: string }).message || "Failed to save bill";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    setShowBillPreviewUI(false); // Hide the preview UI
  };

  // Defer cleanup until the print dialog completes
  useEffect(() => {
    const handleAfterPrint = () => {
      setLoading(false);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handleSaveBill = async () => {
    setLoading(true);
    const soldItems = getSoldItems();
    const billItems: ShopBillItem[] = soldItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      boxQty: item.boxQty,
      pcsQty: item.pcsQty,
      pricePerBox: item.boxQty > 0 ? item.price : 0,
      pricePerPcs: item.pcsQty > 0 ? item.price : 0,
      amount: item.total,
    }));
    try {
      const items = Object.values(cartItems)
        .filter((ci) => ci.boxQty > 0 || ci.pcsQty > 0)
        .flatMap((ci) => {
          const boxLine =
            ci.boxQty > 0
              ? [
                  {
                    productId: ci.product.id,
                    productName: ci.product.name,
                    unit: "box" as const,
                    quantity: ci.boxQty,
                    price: ci.boxPrice,
                    total: ci.boxQty * ci.boxPrice,
                  },
                ]
              : [];
          const pcsLine =
            ci.pcsQty > 0
              ? [
                  {
                    productId: ci.product.id,
                    productName: ci.product.name,
                    unit: "pcs" as const,
                    quantity: ci.pcsQty,
                    price: ci.pcsPrice,
                    total: ci.pcsQty * ci.pcsPrice,
                  },
                ]
              : [];
          return [...boxLine, ...pcsLine];
        });
      const products_sold = {
        items,
        shop_address: shopAddress.trim() || undefined,
        shop_phone: shopPhone.trim() || undefined,
      };
      const truckId =
        selectedTruck && /^[0-9a-fA-F-]{36}$/.test(selectedTruck)
          ? selectedTruck
          : null;
      const salePayload = {
        route_id: selectedRoute,
        truck_id: truckId,
        shop_name: shopName.trim(),
        date: selectedDate,
        products_sold,
        total_amount: totals.totalAmount,
      };
      console.log("saveSale payload:", {
        route_id: salePayload.route_id,
        truck_id: salePayload.truck_id,
        date: salePayload.date,
        shop_name: salePayload.shop_name,
        items: products_sold.items,
        total_amount: salePayload.total_amount,
      });
      const savedSale = await saveSale(salePayload);
      console.log("Sale saved:", savedSale);
      const products = await getProducts();
      const saleItems = billItems.map((item) => {
        const p = products.find((pp) => pp.id === item.productId);
        const perBox = p?.pcs_per_box || 24;
        return {
          productId: item.productId,
          qty_pcs: (item.boxQty || 0) * perBox + (item.pcsQty || 0),
        };
      });
      const assignedRows = await getRouteAssignedStock(
        selectedRoute,
        selectedDate
      );
      const assignedIds = new Set(assignedRows.map((r) => r.product_id));
      // Relaxed validation for Save Bill as well
      for (const si of saleItems) {
        if (!assignedIds.has(si.productId)) {
          console.warn(
            "Assigned stock missing in assigned_stock table (but present in daily_stock)",
            {
              route_id: selectedRoute,
              date: selectedDate,
              productId: si.productId,
            }
          );
        }
      }
      // const strictValidation = import.meta.env.VITE_STRICT_ASSIGNED_STOCK_VALIDATION === 'true' || import.meta.env.DEV;
      // for (const si of saleItems) {
      //   if (!assignedIds.has(si.productId)) {
      //     console.error("Assigned stock missing", { route_id: selectedRoute, date: selectedDate, productId: si.productId });
      //     if (strictValidation) {
      //       throw new Error("Assigned stock missing for this product/route/date");
      //     }
      //   }
      // }
      if (!truckId) {
        console.error("No truck ID found, cannot update stock");
        throw new Error("Cannot update stock: No Truck ID selected.");
      }
      await updateDailyStockAfterSale(
        selectedRoute,
        truckId,
        selectedDate,
        billItems.map((item) => ({
          productId: item.productId,
          boxQty: item.boxQty || 0,
          pcsQty: item.pcsQty || 0,
        })),
        products
      );
      console.log("Daily stock updated successfully (client-side)");
      console.log("Reloading assigned stock after save...");
      await loadAssignedStock();
      console.log("Assigned stock reloaded");
      setCartItems((prev) => {
        const updated: Record<string, CartItem> = {};
        Object.keys(prev).forEach((key) => {
          updated[key] = { ...prev[key], boxQty: 0, pcsQty: 0, totalAmount: 0 };
        });
        return updated;
      });
      setShopName("");
      setShopAddress("");
      setShopPhone("");
      console.log("Cleared cart quantities and reset shop details");
      setLoading(false);
      toast({ title: "Saved", description: "Bill saved successfully." });
      setShowBillPreviewUI(false);
      // stay on the page
    } catch (error: unknown) {
      console.error("Error during save bill flow:", error);
      const msg =
        (error as { message?: string }).message || "Failed to save bill";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };

  const addedItems = Object.values(cartItems).filter(
    (item) => item.boxQty > 0 || item.pcsQty > 0
  );
  const soldItems = getSoldItems();
  const totalAmount = totals.totalAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-success-green-light/10">
      {/* Header */}
      <header className="bg-white backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (showBillPreviewUI) {
                    handleBackToForm();
                  } else {
                    navigate(-1);
                  }
                }}
                className="h-9 w-9 p-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-success-green to-accent rounded-lg sm:rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">
                    Shop Billing
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">
                    Create bills for shop sales
                  </p>
                </div>
              </div>
            </div>
            {routeName && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="text-sm sm:text-base font-semibold text-primary">
                  {routeName}
                </p>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadAssignedStock}
              className="h-9 w-9 p-0"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-safe">
        {!showBillPreviewUI ? (
          // Billing Form
          <Card className="border-0 shadow-strong">
            <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl font-bold">
                New Sale
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Enter shop details and select products
              </CardDescription>
              {routeName && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-semibold text-primary">
                    📍 Route: {routeName}
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="px-4 sm:px-6">
              <div className="space-y-6 sm:space-y-8">
                {/* Shop Details */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      Shop Name *
                    </Label>
                    <Input
                      type="text"
                      placeholder="Enter shop name"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="h-11 sm:h-10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Address / Village
                    </Label>
                    <Input
                      type="text"
                      placeholder="Enter address or village name"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      className="h-11 sm:h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone Number
                    </Label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Enter 10-digit mobile number"
                      value={shopPhone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        setShopPhone(digitsOnly);
                      }}
                      pattern="[0-9]{10}"
                      maxLength={10}
                      className="h-11 sm:h-10 text-base"
                    />
                    {shopPhone && !isValidPhone(shopPhone) && (
                      <p className="text-xs text-destructive">
                        Enter 10-digit mobile number
                      </p>
                    )}
                    {import.meta.env.DEV && (
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={fillDevDetails}
                        >
                          Set Temp Details
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Products Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base sm:text-lg font-semibold flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                      Select Products
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Items:{" "}
                        <span className="font-semibold text-primary">
                          {addedItems.length}
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setShowAddProductModal(true)}
                        disabled={availableProducts.length === 0}
                        variant="default"
                        size="sm"
                        className="h-9"
                        title="Quick add product"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Product
                      </Button>
                    </div>
                  </div>

                  {/* Quick Edit Added Items */}
                  {addedItems.length > 0 && (
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold mb-2">
                        Added Items
                      </div>
                      <div className="space-y-2">
                        {addedItems.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {item.product.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {item.boxQty > 0 && `${item.boxQty} Box`}
                                {item.boxQty > 0 && item.pcsQty > 0 && ", "}
                                {item.pcsQty > 0 && `${item.pcsQty} pcs`}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-primary">
                              ₹{item.totalAmount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product Cards - Show all available products like Old-Portal */}
                  {loadingStock ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading products...
                    </div>
                  ) : availableProducts.length > 0 ? (
                    <div className="grid gap-3 sm:gap-4">
                      {availableProducts
                        .filter(
                          ({ stock: stockItem }) =>
                            (stockItem.boxQty || 0) > 0 ||
                            (stockItem.pcsQty || 0) > 0
                        )
                        .map(({ product, stock: stockItem }) => {
                          const cartItem = cartItems[product.id];
                          if (!cartItem) return null;

                          const boxAvail = stockItem.boxQty || 0;
                          const pcsAvail = stockItem.pcsQty || 0;
                          const boxQty = cartItem.boxQty || 0;
                          const pcsQty = cartItem.pcsQty || 0;
                          const boxPrice = cartItem.boxPrice;
                          const pcsPrice = cartItem.pcsPrice;
                          const availableStock = boxAvail + pcsAvail;
                          const lineTotal = cartItem.totalAmount;

                          return (
                            <Card
                              key={product.id}
                              className={`border transition-colors ${
                                availableStock === 0
                                  ? "border-destructive/50 opacity-60"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <CardContent className="p-3 sm:p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold text-foreground text-base">
                                      {product.name}
                                    </h4>
                                    {availableStock === 0 && (
                                      <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                                        Out of Stock
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      {/* Box */}
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          Unit: Box
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          Avail: {boxAvail} Box
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs font-medium text-muted-foreground">
                                          Price (₹)
                                        </Label>
                                        <Input
                                          type="number"
                                          value={boxPrice}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            const num =
                                              v === "" ? 0 : parseFloat(v);
                                            updateBoxPrice(
                                              product.id,
                                              Number.isFinite(num) ? num : 0
                                            );
                                          }}
                                          className="h-9 text-sm"
                                          min="0"
                                          step="0.01"
                                          disabled={boxAvail === 0}
                                          placeholder={`${
                                            product.box_price ?? product.price
                                          }`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs font-medium text-muted-foreground">
                                          Quantity (Box)
                                        </Label>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() =>
                                              updateBoxQty(
                                                product.id,
                                                boxQty - 1
                                              )
                                            }
                                            disabled={boxQty === 0}
                                            className="h-9 w-9"
                                          >
                                            <Minus className="w-4 h-4" />
                                          </Button>
                                          <Input
                                            type="text"
                                            value={String(boxQty)}
                                            onChange={(e) => {
                                              const sanitized =
                                                e.target.value
                                                  .replace(/[^0-9]/g, "")
                                                  .replace(/^0+/, "") || "0";
                                              const newQuantity = Math.max(
                                                0,
                                                parseInt(sanitized) || 0
                                              );
                                              updateBoxQty(
                                                product.id,
                                                newQuantity
                                              );
                                            }}
                                            className="w-16 text-center text-sm h-9"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            disabled={boxAvail === 0}
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() =>
                                              updateBoxQty(
                                                product.id,
                                                boxQty + 1
                                              )
                                            }
                                            disabled={
                                              boxQty >= boxAvail ||
                                              boxAvail === 0
                                            }
                                            className="h-9 w-9"
                                          >
                                            <Plus className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      {/* Pcs */}
                                      {(() => {
                                        const pcsPerBox =
                                          product.pcs_per_box || 24;
                                        const maxPcsCapacity =
                                          pcsAvail + boxAvail * pcsPerBox;
                                        return (
                                          <>
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-muted-foreground">
                                                Unit: 1 pcs
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                Avail: {pcsAvail} pcs
                                              </span>
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs font-medium text-muted-foreground">
                                                Price (₹)
                                              </Label>
                                              <Input
                                                type="number"
                                                value={pcsPrice}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  const num =
                                                    v === ""
                                                      ? 0
                                                      : parseFloat(v);
                                                  updatePcsPrice(
                                                    product.id,
                                                    Number.isFinite(num)
                                                      ? num
                                                      : 0
                                                  );
                                                }}
                                                className="h-9 text-sm"
                                                min="0"
                                                step="0.01"
                                                disabled={maxPcsCapacity === 0}
                                                placeholder={`${
                                                  product.pcs_price ??
                                                  (product.box_price ??
                                                    product.price) / pcsPerBox
                                                }`}
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs font-medium text-muted-foreground">
                                                Quantity (pcs)
                                              </Label>
                                              <div className="flex items-center gap-2">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="icon"
                                                  onClick={() =>
                                                    updatePcsQty(
                                                      product.id,
                                                      pcsQty - 1
                                                    )
                                                  }
                                                  disabled={pcsQty === 0}
                                                  className="h-9 w-9"
                                                >
                                                  <Minus className="w-4 h-4" />
                                                </Button>
                                                <Input
                                                  type="text"
                                                  value={String(pcsQty)}
                                                  onChange={(e) => {
                                                    const sanitized =
                                                      e.target.value
                                                        .replace(/[^0-9]/g, "")
                                                        .replace(/^0+/, "") ||
                                                      "0";
                                                    const newQuantity =
                                                      Math.max(
                                                        0,
                                                        parseInt(sanitized) || 0
                                                      );
                                                    updatePcsQty(
                                                      product.id,
                                                      newQuantity
                                                    );
                                                  }}
                                                  className="w-16 text-center text-sm h-9"
                                                  inputMode="numeric"
                                                  pattern="[0-9]*"
                                                  disabled={
                                                    maxPcsCapacity === 0
                                                  }
                                                />
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="icon"
                                                  onClick={() =>
                                                    updatePcsQty(
                                                      product.id,
                                                      pcsQty + 1
                                                    )
                                                  }
                                                  disabled={
                                                    pcsQty >= maxPcsCapacity ||
                                                    maxPcsCapacity === 0
                                                  }
                                                  className="h-9 w-9"
                                                >
                                                  <Plus className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-warning">
                                        Available: {boxAvail} Box, {pcsAvail}{" "}
                                        pcs
                                      </p>
                                    </div>
                                    {boxQty + pcsQty > 0 && (
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-success-green">
                                          Line Total: ₹{lineTotal.toFixed(2)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No products available. Please start a route first.
                    </div>
                  )}
                </div>

                {/* Total Amount Section */}
                <div className="bg-primary-light/30 border-2 border-primary rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg sm:text-xl font-bold text-gray-900">
                      Total Amount:
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold text-primary-dark">
                      ₹{totals.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Generate Bill Button */}
                <div className="sticky bottom-3 sm:static bg-background/95 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none p-1 sm:p-0 -mx-2 sm:mx-0 rounded-md sm:rounded-none">
                  <Button
                    onClick={handleGenerateBill}
                    variant="success"
                    size="default"
                    className="w-full h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation shadow sm:shadow-none"
                    disabled={!isFormValid || loading}
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Generate Bill
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Bill Preview & Print UI
          <>
            <div className="space-y-4">
              <Card className="border-0 shadow-strong print:hidden">
                <CardHeader className="text-center pb-4 px-4 sm:px-6">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-success-green">
                    Bill Generated!
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Review and print the bill
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 space-y-4">
                  <div className="sticky bottom-3 sm:static bg-background/95 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none p-1 sm:p-0 -mx-2 sm:mx-0 rounded-md sm:rounded-none">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <Button
                        onClick={handlePrintBill}
                        variant="success"
                        size="default"
                        className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation w-full sm:w-auto shadow sm:shadow-none"
                        disabled={loading}
                      >
                        <Printer className="w-5 h-5 mr-2" />
                        {loading ? "Printing..." : "Print Bill"}
                      </Button>
                      <Button
                        onClick={handleSaveBill}
                        variant="default"
                        size="default"
                        className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation w-full sm:w-auto shadow sm:shadow-none"
                        disabled={loading}
                      >
                        Save Bill
                      </Button>
                      <Button
                        onClick={handleBackToForm}
                        variant="outline"
                        size="default"
                        className="h-10 sm:h-11 px-4 sm:px-6 touch-manipulation w-full sm:w-auto shadow sm:shadow-none"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-strong print:hidden">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="text-center">
                      <h2 className="text-xl font-bold">BHAVYA ENTERPRICE</h2>
                      <p className="text-sm">Sales Invoice</p>
                    </div>
                    <div className="border-t pt-4">
                      <p className="font-semibold">Shop: {shopName}</p>
                      {shopAddress && (
                        <p className="text-sm text-muted-foreground">
                          Address: {shopAddress}
                        </p>
                      )}
                      {shopPhone && (
                        <p className="text-sm text-muted-foreground">
                          Phone: {shopPhone}
                        </p>
                      )}
                    </div>
                    <div className="border-t pt-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Item</th>
                            <th className="text-center py-2">Qty</th>
                            <th className="text-right py-2">Rate</th>
                            <th className="text-right py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {soldItems.map((item, index) => (
                            <tr
                              key={`${item.productId}-${index}`}
                              className="border-b"
                            >
                              <td className="py-2">{item.productName}</td>
                              <td className="text-center py-2">
                                {item.boxQty > 0 && `${item.boxQty} Box`}
                                {item.boxQty > 0 && item.pcsQty > 0 && ", "}
                                {item.pcsQty > 0 && `${item.pcsQty} pcs`}
                              </td>
                              <td className="text-right py-2">
                                ₹{item.price.toFixed(2)}
                              </td>
                              <td className="text-right py-2 font-semibold">
                                ₹{item.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">TOTAL:</span>
                        <span className="text-2xl font-bold text-success-green">
                          ₹{totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Portal for Print Content - Now always rendered */}
      {createPortal(
        <div id="print-receipt-container" style={{ display: "none" }}>
          <div className="receipt-58mm">
            {/* Bill Header */}
            <div style={{ textAlign: "center", marginBottom: "4px" }}>
              <h1 style={{ margin: "0", fontSize: "14px", fontWeight: "bold" }}>
                BHAVYA ENTERPRICE
              </h1>
              <p style={{ margin: "0", fontSize: "10px", fontWeight: "600" }}>
                Sales Invoice
              </p>
              <div style={{ marginTop: "2px", fontSize: "8px" }}>
                <p style={{ margin: "0", lineHeight: "1.1" }}>
                  Near Bala petrol pump
                </p>
                <p style={{ margin: "0", lineHeight: "1.1" }}>
                  Jambusar Bharuch road
                </p>
              </div>
              <div style={{ marginTop: "2px", fontSize: "8px" }}>
                <p style={{ margin: "0", lineHeight: "1.1" }}>
                  Phone: 8866756059
                </p>
                <p style={{ margin: "0", lineHeight: "1.1" }}>
                  GSTIN: 24EVVPS8220P1ZF
                </p>
              </div>
              <div style={{ marginTop: "2px", fontSize: "8px" }}>
                <p style={{ margin: "0" }}>
                  Date:{" "}
                  {new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {routeName && (
                  <p style={{ margin: "0", fontWeight: "bold" }}>
                    Route: {routeName}
                  </p>
                )}
              </div>
            </div>
            {/* Shop Details */}
            <div
              style={{
                marginBottom: "4px",
                paddingBottom: "2px",
                borderTop: "1px dashed black",
                borderBottom: "1px dashed black",
                paddingTop: "2px",
              }}
            >
              <p style={{ fontSize: "9px", fontWeight: "600", margin: "0" }}>
                Shop: {printSnapshot?.shopName || shopName}
              </p>
              {(printSnapshot?.shopAddress || shopAddress) && (
                <p style={{ fontSize: "8px", margin: "0" }}>
                  Addr: {printSnapshot?.shopAddress || shopAddress}
                </p>
              )}
              {(printSnapshot?.shopPhone || shopPhone) && (
                <p style={{ fontSize: "8px", margin: "0" }}>
                  Ph: {printSnapshot?.shopPhone || shopPhone}
                </p>
              )}
            </div>
            {/* Products Table */}
            <div style={{ marginBottom: "4px" }}>
              <table
                style={{
                  width: "100%",
                  fontSize: "8px",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px dashed black" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "1px 0",
                        fontSize: "8px",
                      }}
                    >
                      Item
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "1px 0",
                        fontSize: "8px",
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "1px 0",
                        fontSize: "8px",
                      }}
                    >
                      Rate
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "1px 0",
                        fontSize: "8px",
                      }}
                    >
                      Amt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(printSnapshot?.items || soldItems).map((item, index) => (
                    <tr key={`${item.productId}-${index}`}>
                      <td style={{ padding: "1px 0", fontSize: "8px" }}>
                        {item.productName}
                      </td>
                      <td
                        style={{
                          padding: "1px 0",
                          textAlign: "center",
                          fontSize: "8px",
                        }}
                      >
                        {item.boxQty > 0 && `${item.boxQty} Box`}
                        {item.boxQty > 0 && item.pcsQty > 0 && " "}
                        {item.pcsQty > 0 && `${item.pcsQty} pcs`}
                      </td>
                      <td
                        style={{
                          padding: "1px 0",
                          textAlign: "right",
                          fontSize: "8px",
                        }}
                      >
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "1px 0",
                          textAlign: "right",
                          fontSize: "8px",
                          fontWeight: "600",
                        }}
                      >
                        ₹{item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Total Section */}
            <div
              style={{
                borderTop: "1px dashed black",
                paddingTop: "2px",
                marginBottom: "4px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                  TOTAL:
                </span>
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                  ₹{(printSnapshot?.total ?? totalAmount).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: "8px", textAlign: "right" }}>
                Items:{" "}
                {(printSnapshot?.items || soldItems).reduce(
                  (sum, it) => sum + (it.boxQty || 0) + (it.pcsQty || 0),
                  0
                )}
              </div>
            </div>
            {/* Footer */}
            <div
              style={{
                marginTop: "4px",
                paddingTop: "2px",
                borderTop: "1px dashed black",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "9px", fontWeight: "600", margin: "0" }}>
                Thank you for your business!
              </p>
              <p style={{ fontSize: "8px", margin: "0" }}>Have a great day!</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          /* Hide everything except the portal */
          body > *:not(#print-receipt-container) { display: none !important; }
          #print-receipt-container { display: block !important; }

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
          .receipt-58mm th:nth-child(1), .receipt-58mm td:nth-child(1) { width: 52% !important; }
          .receipt-58mm th:nth-child(2), .receipt-58mm td:nth-child(2) { width: 14% !important; }
          .receipt-58mm th:nth-child(3), .receipt-58mm td:nth-child(3) { width: 16% !important; }
          .receipt-58mm th:nth-child(4), .receipt-58mm td:nth-child(4) { width: 18% !important; }
          .receipt { width: 58mm !important; margin: 0 !important; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important; color: #000 !important; }
          .print-container { padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Add Product Modal */}
      <AddProductModal
        open={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSelectProduct={handleAddProduct}
        availableProducts={availableProducts.filter(
          ({ product }) => !cartItems[product.id]
        )}
      />
    </div>
  );
};

export default ShopBilling;
