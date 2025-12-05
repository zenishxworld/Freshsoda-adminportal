import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { useToast } from "../../hooks/use-toast";
import {
  getAssignedStockForBilling,
  searchAssignedProductsInStock,
  createOrGetShop,
  saveShopBill,
  updateStockAfterSaleRouteRPC,
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
import { ArrowLeft, ShoppingCart, Plus, Minus, Store, Check, RefreshCw, Route as RouteIcon, MapPin, Phone } from "lucide-react";
import AddProductModal from "../../components/driver/AddProductModal";
import ProductQuantityCard from "../../components/driver/ProductQuantityCard";
import BillPreview from "./BillPreview";

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
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [routeName, setRouteName] = useState("");

  // Shop details
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");

  // Products
  const [availableProducts, setAvailableProducts] = useState<Array<{ product: Product; stock: DailyStockItem }>>([]);
  const assignedSubRef = useRef<RealtimeChannel | null>(null);
  const [cartItems, setCartItems] = useState<Record<string, CartItem>>({});
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [generatedBill, setGeneratedBill] = useState<any>(null);

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
        const routeId = localStorage.getItem('currentRoute');
        const truckId = localStorage.getItem('currentTruck');
        const date = localStorage.getItem('currentDate') || format(new Date(), "yyyy-MM-dd");
        if (routeId) setSelectedRoute(routeId);
        if (truckId) setSelectedTruck(truckId);
        if (date) setSelectedDate(date);
      }
    };
    loadRoute();
  }, []);

  // Load route name
  useEffect(() => {
    const loadRouteName = async () => {
      if (selectedRoute) {
        const routes = await getActiveRoutes();
        const route = routes.find(r => r.id === selectedRoute);
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
      assignedSubRef.current = subscribeAssignedStockForRouteDate(selectedRoute, selectedDate, loadAssignedStock);
    };
    doSub();
    return () => { mounted = false; assignedSubRef.current?.unsubscribe?.(); };
  }, [selectedRoute, selectedDate]);

  const loadAssignedStock = async () => {
    // For assigned routes, truck is optional - only need route and date
    if (!selectedRoute || !selectedDate) {
      console.log("Cannot load stock - missing route or date:", { selectedRoute, selectedDate });
      return;
    }

    try {
      setLoadingStock(true);
      const driverId = user?.id || null;
      console.log("Loading assigned stock for:", { route: selectedRoute, date: selectedDate, driverId });
      
      // Get both driver-assigned stock (if logged in) and route-only stock
      const stockPromises: Promise<Array<{ product: Product; stock: DailyStockItem }>>[] = [];
      
      // Try driver-assigned stock first if we have a driver ID
      if (driverId) {
        stockPromises.push(getAssignedStockForBilling(driverId, selectedRoute, selectedDate));
      }
      
      // Also get route-only stock (driver_id IS NULL)
      stockPromises.push(getAssignedStockForBilling(null, selectedRoute, selectedDate));
      
      // Get all stock results
      const stockResults = await Promise.all(stockPromises);
      
      // Combine and deduplicate by product ID (prefer driver-assigned over route-only)
      const stockMap = new Map<string, { product: Product; stock: DailyStockItem }>();
      stockResults.forEach(stockArray => {
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
          const pcsPrice = product.pcs_price || (boxPrice / pcsPerBox) || 0;
          
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
      console.log("Initialized cart items:", Object.keys(initialCartItems).length, "products");
    } catch (error) {
      console.error("Error loading stock:", error);
      toast({
        title: "Error",
        description: `Failed to load assigned stock: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoadingStock(false);
    }
  };

  const handleAddProduct = (product: Product, stock: DailyStockItem) => {
    const pcsPerBox = product.pcs_per_box || 24;
    const boxPrice = product.box_price || product.price || 0;
    const pcsPrice = product.pcs_price || (boxPrice / pcsPerBox) || 0;

    setCartItems(prev => ({
      ...prev,
      [product.id]: {
        product,
        stock,
        boxQty: 0,
        pcsQty: 0,
        boxPrice,
        pcsPrice,
        totalAmount: 0,
      }
    }));
  };

  const updateBoxQty = (productId: string, value: number) => {
    setCartItems(prev => {
      const item = prev[productId];
      if (!item) return prev;

      const newBoxQty = Math.max(0, Math.min(item.stock.boxQty || 0, value));
      const totalAmount = (newBoxQty * item.boxPrice) + (item.pcsQty * item.pcsPrice);

      return {
        ...prev,
        [productId]: {
          ...item,
          boxQty: newBoxQty,
          totalAmount,
        }
      };
    });
  };

  const updatePcsQty = (productId: string, value: number) => {
    setCartItems(prev => {
      const item = prev[productId];
      if (!item) return prev;

      const pcsPerBox = item.product.pcs_per_box || 24;
      // Allow cutting boxes automatically - total available pcs includes boxes that can be converted
      const totalAvailablePcs = ((item.stock.boxQty || 0) * pcsPerBox) + (item.stock.pcsQty || 0);
      const maxPcsQty = totalAvailablePcs; // Allow using all available pcs (including from boxes)
      const newPcsQty = Math.max(0, Math.min(maxPcsQty, value));
      const totalAmount = (item.boxQty * item.boxPrice) + (newPcsQty * item.pcsPrice);

      return {
        ...prev,
        [productId]: {
          ...item,
          pcsQty: newPcsQty,
          totalAmount,
        }
      };
    });
  };

  const updateBoxPrice = (productId: string, value: number) => {
    setCartItems(prev => {
      const item = prev[productId];
      if (!item) return prev;

      const totalAmount = (item.boxQty * value) + (item.pcsQty * item.pcsPrice);

      return {
        ...prev,
        [productId]: {
          ...item,
          boxPrice: value,
          totalAmount,
        }
      };
    });
  };

  const updatePcsPrice = (productId: string, value: number) => {
    setCartItems(prev => {
      const item = prev[productId];
      if (!item) return prev;

      const totalAmount = (item.boxQty * item.boxPrice) + (item.pcsQty * value);

      return {
        ...prev,
        [productId]: {
          ...item,
          pcsPrice: value,
          totalAmount,
        }
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => {
      const newCart = { ...prev };
      delete newCart[productId];
      return newCart;
    });
  };

  // Calculate totals
  const totals = useMemo(() => {
    const items = Object.values(cartItems).filter(item => item.boxQty > 0 || item.pcsQty > 0);
    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
    return { totalAmount };
  }, [cartItems]);

  // Validation
  const isFormValid = useMemo(() => {
    if (!selectedRoute || !selectedDate) return false;
    // Truck is optional for assigned routes, but required for regular routes
    // For now, we'll allow empty truck for assigned routes
    if (!selectedTruck && availableProducts.length === 0) return false;
    if (!shopName.trim()) return false;
    const hasItems = Object.values(cartItems).some(item => item.boxQty > 0 || item.pcsQty > 0);
    if (!hasItems) return false;

    // Check stock availability (with auto-cut logic - pcs can use boxes)
    for (const item of Object.values(cartItems)) {
      if (item.boxQty > 0 || item.pcsQty > 0) {
        const pcsPerBox = item.product.pcs_per_box || 24;
        const totalAvailablePcs = ((item.stock.boxQty || 0) * pcsPerBox) + (item.stock.pcsQty || 0);
        const totalRequestedPcs = (item.boxQty * pcsPerBox) + item.pcsQty;
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

  const handleGenerateBill = async () => {
    if (!isFormValid) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields and add products with valid quantities.",
        variant: "destructive",
      });
      return;
    }

    // Validate stock
    for (const item of Object.values(cartItems)) {
      if (item.boxQty > 0 || item.pcsQty > 0) {
        const pcsPerBox = item.product.pcs_per_box || 24;
        const totalAvailablePcs = ((item.stock.boxQty || 0) * pcsPerBox) + (item.stock.pcsQty || 0);
        const totalRequestedPcs = (item.boxQty * pcsPerBox) + item.pcsQty;
        if (totalRequestedPcs > totalAvailablePcs) {
          toast({
            title: "Insufficient Stock",
            description: `Insufficient stock for ${item.product.name}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setLoading(true);

    try {
      // Prepare bill items
      const billItems: ShopBillItem[] = Object.values(cartItems)
        .filter(item => item.boxQty > 0 || item.pcsQty > 0)
        .map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          boxQty: item.boxQty,
          pcsQty: item.pcsQty,
          pricePerBox: item.boxPrice,
          pricePerPcs: item.pcsPrice,
          amount: item.totalAmount,
        }));

      // Save shop bill (use empty string for truck if not set, for assigned routes)
      await saveShopBill(
        selectedRoute,
        selectedTruck || '',
        {
          name: shopName.trim(),
          address: shopAddress.trim() || undefined,
          phone: shopPhone.trim() || undefined,
        },
        billItems,
        totals.totalAmount,
        selectedDate
      );
      {
        const products = await getProducts();
        const saleItems = billItems.map(item => {
          const p = products.find(pp => pp.id === item.productId);
          const perBox = p?.pcs_per_box || 24;
          return { productId: item.productId, qty_pcs: (item.boxQty || 0) * perBox + (item.pcsQty || 0) };
        });
        await updateStockAfterSaleRouteRPC(selectedRoute, selectedDate, saleItems);
      }

      // Prepare bill data for preview
      setGeneratedBill({
        shopName: shopName.trim(),
        shopAddress: shopAddress.trim(),
        shopPhone: shopPhone.trim(),
        routeName,
        date: selectedDate,
        items: billItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          boxQty: item.boxQty,
          pcsQty: item.pcsQty,
          rate: item.boxQty > 0 ? item.pricePerBox : item.pricePerPcs,
          amount: item.amount,
        })),
        totalAmount: totals.totalAmount,
      });

      setShowBillPreview(true);
      toast({
        title: "Bill generated successfully!",
        description: "Bill has been saved and stock updated.",
      });
    } catch (error: any) {
      console.error("Error generating bill:", error);
      const errorMessage = error.message || "Failed to generate bill. Please try again.";
      if (errorMessage.includes("stock") || errorMessage.includes("insufficient")) {
        toast({
          title: "Insufficient Stock",
          description: "Not enough stock to complete this bill.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const addedItems = Object.values(cartItems).filter(item => item.boxQty > 0 || item.pcsQty > 0);

  if (showBillPreview && generatedBill) {
    return (
      <BillPreview
        bill={generatedBill}
        onBack={() => {
          setShowBillPreview(false);
          setCartItems({});
          setShopName("");
          setShopAddress("");
          setShopPhone("");
          loadAssignedStock();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-success-green-light/10">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10">
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
            {routeName && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="text-sm sm:text-base font-semibold text-primary">{routeName}</p>
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

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-safe">
        <Card className="border-0 shadow-strong">
          <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold">New Sale</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Enter shop details and select products
            </CardDescription>
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
                    placeholder="Enter 10-digit mobile number"
                    value={shopPhone}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setShopPhone(digitsOnly);
                    }}
                    className="h-11 sm:h-10"
                    maxLength={10}
                  />
                  {shopPhone && shopPhone.length !== 10 && (
                    <p className="text-xs text-destructive">Enter a valid 10-digit mobile number</p>
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
                      Items: <span className="font-semibold text-primary">{addedItems.length}</span>
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
                    <div className="text-sm font-semibold mb-2">Added Items</div>
                    <div className="space-y-2">
                      {addedItems.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.product.name}</span>
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
                      .filter(({ stock: stockItem }) => (stockItem.boxQty || 0) > 0 || (stockItem.pcsQty || 0) > 0)
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
                                ? 'border-destructive/50 opacity-60'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <CardContent className="p-3 sm:p-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-foreground text-base">{product.name}</h4>
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
                                      <span className="text-xs font-medium text-muted-foreground">Unit: Box</span>
                                      <span className="text-xs text-muted-foreground">Avail: {boxAvail} Box</span>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs font-medium text-muted-foreground">Price (₹)</Label>
                                      <Input
                                        type="number"
                                        value={boxPrice}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          const num = v === '' ? 0 : parseFloat(v);
                                          updateBoxPrice(product.id, Number.isFinite(num) ? num : 0);
                                        }}
                                        className="h-9 text-sm"
                                        min="0"
                                        step="0.01"
                                        disabled={boxAvail === 0}
                                        placeholder={`${product.box_price ?? product.price}`}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs font-medium text-muted-foreground">Quantity (Box)</Label>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          onClick={() => updateBoxQty(product.id, boxQty - 1)}
                                          disabled={boxQty === 0}
                                          className="h-9 w-9"
                                        >
                                          <Minus className="w-4 h-4" />
                                        </Button>
                                        <Input
                                          type="text"
                                          value={String(boxQty)}
                                          onChange={(e) => {
                                            const sanitized = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '') || '0';
                                            const newQuantity = Math.max(0, parseInt(sanitized) || 0);
                                            updateBoxQty(product.id, newQuantity);
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
                                          onClick={() => updateBoxQty(product.id, boxQty + 1)}
                                          disabled={boxQty >= boxAvail || boxAvail === 0}
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
                                      const pcsPerBox = product.pcs_per_box || 24;
                                      const maxPcsCapacity = pcsAvail + boxAvail * pcsPerBox;
                                      return (
                                        <>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-muted-foreground">Unit: 1 pcs</span>
                                            <span className="text-xs text-muted-foreground">Avail: {pcsAvail} pcs</span>
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-muted-foreground">Price (₹)</Label>
                                            <Input
                                              type="number"
                                              value={pcsPrice}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                const num = v === '' ? 0 : parseFloat(v);
                                                updatePcsPrice(product.id, Number.isFinite(num) ? num : 0);
                                              }}
                                              className="h-9 text-sm"
                                              min="0"
                                              step="0.01"
                                              disabled={maxPcsCapacity === 0}
                                              placeholder={`${product.pcs_price ?? ((product.box_price ?? product.price) / pcsPerBox)}`}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-muted-foreground">Quantity (pcs)</Label>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => updatePcsQty(product.id, pcsQty - 1)}
                                                disabled={pcsQty === 0}
                                                className="h-9 w-9"
                                              >
                                                <Minus className="w-4 h-4" />
                                              </Button>
                                              <Input
                                                type="text"
                                                value={String(pcsQty)}
                                                onChange={(e) => {
                                                  const sanitized = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '') || '0';
                                                  const newQuantity = Math.max(0, parseInt(sanitized) || 0);
                                                  updatePcsQty(product.id, newQuantity);
                                                }}
                                                className="w-16 text-center text-sm h-9"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                disabled={maxPcsCapacity === 0}
                                              />
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => updatePcsQty(product.id, pcsQty + 1)}
                                                disabled={pcsQty >= maxPcsCapacity || maxPcsCapacity === 0}
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
                                      Available: {boxAvail} Box, {pcsAvail} pcs
                                    </p>
                                  </div>
                                  {(boxQty + pcsQty) > 0 && (
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
                  <span className="text-lg sm:text-xl font-bold text-gray-900">Total Amount:</span>
                  <span className="text-2xl sm:text-3xl font-bold text-primary-dark">₹{totals.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Generate Bill Button */}
              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 border-t">
                <Button
                  onClick={handleGenerateBill}
                  variant="success"
                  size="default"
                  className="w-full h-11 text-base font-semibold"
                  disabled={!isFormValid || loading}
                >
                  {loading ? "Generating..." : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Generate Bill
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

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
