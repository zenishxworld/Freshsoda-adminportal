import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { useToast } from "../../hooks/use-toast";
import {
  getDailyStockForBilling,
  searchProductsInStock,
  createOrGetShop,
  saveShopBill,
  reduceDailyStock,
  getProducts,
  getActiveRoutes,
  getTrucks,
  getDriverRoute,
  type Product,
  type DailyStockItem,
  type ShopBillItem,
} from "../../lib/supabase";
import { mapRouteName } from "../../lib/routeUtils";
import { ArrowLeft, ShoppingCart, Plus, Store, Check, RefreshCw, Route as RouteIcon, MapPin, Phone } from "lucide-react";
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
  const [cartItems, setCartItems] = useState<Record<string, CartItem>>({});
  const [showAddProductModal, setShowAddProductModal] = useState(false);

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
    if (selectedRoute && selectedTruck && selectedDate) {
      loadAssignedStock();
    }
  }, [selectedRoute, selectedTruck, selectedDate]);

  const loadAssignedStock = async () => {
    if (!selectedRoute || !selectedTruck || !selectedDate) return;

    try {
      setLoadingStock(true);
      const stock = await getDailyStockForBilling(selectedRoute, selectedTruck, selectedDate);
      setAvailableProducts(stock);
    } catch (error) {
      console.error("Error loading stock:", error);
      toast({
        title: "Error",
        description: "Failed to load assigned stock.",
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
      const totalAvailablePcs = ((item.stock.boxQty || 0) * pcsPerBox) + (item.stock.pcsQty || 0);
      const maxPcsQty = totalAvailablePcs - (item.boxQty * pcsPerBox);
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
    if (!selectedRoute || !selectedTruck || !selectedDate) return false;
    if (!shopName.trim()) return false;
    const hasItems = Object.values(cartItems).some(item => item.boxQty > 0 || item.pcsQty > 0);
    if (!hasItems) return false;

    // Check stock availability
    for (const item of Object.values(cartItems)) {
      if (item.boxQty > 0 || item.pcsQty > 0) {
        const pcsPerBox = item.product.pcs_per_box || 24;
        const totalAvailablePcs = ((item.stock.boxQty || 0) * pcsPerBox) + (item.stock.pcsQty || 0);
        const totalRequestedPcs = (item.boxQty * pcsPerBox) + item.pcsQty;
        if (totalRequestedPcs > totalAvailablePcs) {
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

      // Save shop bill
      await saveShopBill(
        selectedRoute,
        selectedTruck,
        {
          name: shopName.trim(),
          address: shopAddress.trim() || undefined,
          phone: shopPhone.trim() || undefined,
        },
        billItems,
        totals.totalAmount,
        selectedDate
      );

      // Reduce daily stock
      const products = await getProducts();
      await reduceDailyStock(
        selectedRoute,
        selectedTruck,
        selectedDate,
        billItems.map(item => ({
          productId: item.productId,
          boxQty: item.boxQty,
          pcsQty: item.pcsQty,
        })),
        products
      );

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
                    Products
                  </Label>
                  <Button
                    type="button"
                    onClick={() => setShowAddProductModal(true)}
                    disabled={availableProducts.length === 0}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </div>

                {/* Selected Products Box - Old Portal Style */}
                {addedItems.length > 0 && (
                  <div className="rounded-lg border-2 border-primary/20 bg-primary-light/10 p-4">
                    <div className="text-sm font-semibold mb-3 text-foreground">Selected Products</div>
                    <div className="space-y-2">
                      {addedItems.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between p-2 bg-background rounded border border-border">
                          <div>
                            <span className="text-sm font-medium text-foreground">{item.product.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {item.boxQty > 0 && `${item.boxQty} Box`}
                              {item.boxQty > 0 && item.pcsQty > 0 && ", "}
                              {item.pcsQty > 0 && `${item.pcsQty} PCS`}
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

                {/* Product Cards */}
                {addedItems.length > 0 && (
                  <div className="space-y-4">
                    {addedItems.map((item) => (
                      <ProductQuantityCard
                        key={item.product.id}
                        product={item.product}
                        stock={item.stock}
                        boxQty={item.boxQty}
                        pcsQty={item.pcsQty}
                        onBoxQtyChange={(value) => updateBoxQty(item.product.id, value)}
                        onPcsQtyChange={(value) => updatePcsQty(item.product.id, value)}
                        onBoxPriceChange={(value) => updateBoxPrice(item.product.id, value)}
                        onPcsPriceChange={(value) => updatePcsPrice(item.product.id, value)}
                        onRemove={() => removeFromCart(item.product.id)}
                        boxPrice={item.boxPrice}
                        pcsPrice={item.pcsPrice}
                        totalAmount={item.totalAmount}
                      />
                    ))}
                  </div>
                )}

                {addedItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Click "Add Product" to start adding items to the bill
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
