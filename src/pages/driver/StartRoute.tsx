import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../components/ui/alert-dialog";
import { useToast } from "../../hooks/use-toast";
import { getProducts, getActiveRoutes, setDailyStock, getDailyStock, addRoute, deactivateRoute, type Product, type DailyStock, type StockItem } from "../../lib/supabase";
import { mapRouteName, shouldDisplayRoute } from "../../lib/routeUtils";
import { ArrowLeft, Route as RouteIcon, Package, Plus, Minus, Trash2, RefreshCw } from "lucide-react";
import { isWithinAuthGracePeriod, nameMatchesQueryByWordPrefix } from "../../lib/utils";



interface RouteOption {
  id: string;
  name: string;
  displayName?: string;
}




const StartRoute = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<{ id?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [selectedRoute, setSelectedRoute] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewRouteDialog, setShowNewRouteDialog] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [deletingRoute, setDeletingRoute] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [unitMode, setUnitMode] = useState<'box' | 'pcs'>('box');
  const [tempQuantity, setTempQuantity] = useState<number>(0);
  const [itemUnitModes, setItemUnitModes] = useState<Record<string, 'box' | 'pcs'>>({});

  useEffect(() => {
    setUser(null);
    setAuthLoading(false);
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);



  useEffect(() => {
    if (selectedRoute) {
      checkExistingStock();
    }
  }, [selectedRoute]);

  const fetchData = async () => {
    try {
      // Fetch products and routes from Supabase
      const productsRes = await getProducts();
      const routesRes = await getActiveRoutes();

      const activeProducts = productsRes.filter((p) => (p.status || 'active') === 'active');

      if (activeProducts) {
        setProducts(activeProducts);
        // Initialize stock list as empty; entries are added per product+unit
        setStock([]);
      }

      if (routesRes) {
        // Map route names for display
        const mappedRoutes = routesRes
          .filter(route => shouldDisplayRoute(route.name))
          .map(route => ({
            ...route,
            displayName: mapRouteName(route.name)
          }));

        setRoutes(mappedRoutes);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    }
  };

  const checkExistingStock = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getDailyStock(selectedRoute, today);
      if (data) {
        // Stock already exists for today
        toast({
          title: "Stock Already Set",
          description: "Initial stock for this route has already been set today. Loading existing stock...",
        });

        // Load existing stock
        if (data && Array.isArray(data.stock)) {
          const items = data.stock;
          setStock(items.map((s) => ({
            productId: s.productId,
            unit: s.unit ?? 'pcs',
            quantity: s.quantity || 0,
          })));
        }
      }
    } catch (error: any) {
      console.error("Error checking existing stock:", error);
    }
  };

  const updateStock = (productId: string, unit: 'box' | 'pcs', change: number) => {
    setStock(prev =>
      prev.map(item =>
        item.productId === productId && item.unit === unit
          ? { ...item, quantity: Math.max(0, item.quantity + change) }
          : item
      )
    );
  };

  const createNewRoute = async () => {
    if (!newRouteName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a route name",
        variant: "destructive",
      });
      return;
    }

    setCreatingRoute(true);
    try {
      // Prevent duplicate route names (case-insensitive)
      const nameToCheck = newRouteName.trim();
      const allRoutes = await getActiveRoutes();
      const existing = allRoutes.find((r) => String(r.name).toLowerCase() === String(nameToCheck).toLowerCase());
      if (existing) {
        toast({
          title: "Route name already exists",
          description: "Please choose a different name.",
          variant: "destructive",
        });
        setCreatingRoute(false);
        return;
      }
      const data = await addRoute(nameToCheck);
      setRoutes((prev) => [
        ...prev,
        { id: data.id, name: data.name, displayName: mapRouteName(data.name) },
      ]);
      setSelectedRoute(data.id);

      // Close dialog and reset form
      setShowNewRouteDialog(false);
      setNewRouteName("");

      toast({
        title: "Success!",
        description: `Route "${data.name}" created successfully`,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      const message = err?.code === "23505" ? "A route with this name already exists. Please choose a different name." : err?.message || "Failed to create route";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreatingRoute(false);
    }
  };

  const deleteRoute = async (routeId: string) => {
    setDeletingRoute(true);
    try {
      // Soft delete: set is_active to false instead of deleting
      await deactivateRoute(routeId);

      // Remove the route from local state
      setRoutes(prev => prev.filter(route => route.id !== routeId));

      // If the deleted route was selected, clear selection
      if (selectedRoute === routeId) {
        setSelectedRoute("");
      }

      toast({
        title: "Success!",
        description: "Route deactivated successfully",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as { message?: string }).message || "Failed to deactivate route",
        variant: "destructive",
      });
    } finally {
      setDeletingRoute(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();



    setLoading(true);

    try {
      // Filter out products with 0 quantity
      const nonZeroStock = stock.filter(item => item.quantity > 0);

      if (nonZeroStock.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one product to your stock",
          variant: "destructive",
        });
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      await setDailyStock(selectedRoute, today, nonZeroStock);

      // Store route in localStorage for use in other pages
      localStorage.setItem('currentRoute', selectedRoute);
      localStorage.setItem('currentDate', today);

      toast({
        title: "Route Started!",
        description: "Your daily stock has been recorded successfully",
      });

      navigate("/driver/dashboard");
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as { message?: string }).message || "Failed to start route",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalBoxes = stock
    .filter((item) => item.unit === 'box')
    .reduce((sum, item) => sum + item.quantity, 0);
  const totalPcs = stock
    .filter((item) => item.unit === 'pcs')
    .reduce((sum, item) => sum + item.quantity, 0);
  const totalProducts = totalBoxes + totalPcs;

  const resetAddProductState = () => {
    setProductQuery("");
    setSelectedProduct(null);
    setUnitMode('box');
    setTempQuantity(0);
  };

  const toggleUnitMode = () => {
    setUnitMode((prev) => {
      const next = prev === 'box' ? 'pcs' : 'box';
      if (next === 'pcs' && tempQuantity === 0) {
        setTempQuantity(1);
      }
      return next;
    });
  };

  const adjustTempQuantity = (delta: number) => {
    setTempQuantity((q) => Math.max(0, q + delta));
  };

  const handleAddProductToStock = () => {
    if (!selectedProduct) return;
    const quantity = Math.max(0, tempQuantity);
    setStock((prev) => {
      const idx = prev.findIndex(si => si.productId === selectedProduct.id && si.unit === unitMode);
      if (idx >= 0) {
        return prev.map((si, i) => i === idx ? { ...si, quantity } : si);
      }
      return [...prev, { productId: selectedProduct.id, unit: unitMode, quantity }];
    });
    setShowAddProductDialog(false);
    resetAddProductState();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-accent-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary-light/10">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/driver/dashboard")} className="h-9 w-9 p-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-business-blue to-business-blue-dark rounded-lg sm:rounded-xl flex items-center justify-center">
                <RouteIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground">Start Route</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">Setup your daily inventory</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="h-9 w-9 p-0"
              title="Refresh products"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
        <Card className="border-0 shadow-strong">
          <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold">Route Configuration</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Select your route and set initial stock levels
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Route Selection */}
              <div className="space-y-2">
                <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <RouteIcon className="w-4 h-4" />
                  Select Route
                </Label>
                <div className="flex gap-2 flex-wrap">
                  <Select value={selectedRoute} onValueChange={setSelectedRoute} required>
                    <SelectTrigger className="h-11 sm:h-10 text-base flex-1">
                      <SelectValue placeholder="Choose your route" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((route) => {
                        const isCustomRoute = !['Route 1', 'Route 2', 'Route 3'].includes(route.displayName || route.name);
                        return (
                          <div key={route.id} className="flex items-center justify-between group">
                            <SelectItem value={route.id} className="text-base py-3 flex-1 min-w-0">
                              <span className="block truncate">{route.displayName || route.name}</span>
                            </SelectItem>
                            {isCustomRoute && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity mr-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Route</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{route.displayName || route.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteRoute(route.id)}
                                      disabled={deletingRoute}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {deletingRoute ? "Deleting..." : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <Dialog open={showNewRouteDialog} onOpenChange={setShowNewRouteDialog}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 sm:h-10 w-11 sm:w-10 flex-shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New Route</DialogTitle>
                        <DialogDescription>
                          Add a new route to your system. It will be available for immediate use.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="route-name">Route Name</Label>
                          <Input
                            id="route-name"
                            placeholder="e.g., Route 4, Route 5..."
                            value={newRouteName}
                            onChange={(e) => setNewRouteName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                createNewRoute();
                              }
                            }}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowNewRouteDialog(false);
                              setNewRouteName("");
                            }}
                            disabled={creatingRoute}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={createNewRoute}
                            disabled={creatingRoute || !newRouteName.trim()}
                          >
                            {creatingRoute ? "Creating..." : "Create Route"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Stock Configuration */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                    Initial Stock
                  </Label>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Boxes: <span className="font-semibold text-primary">{totalBoxes}</span>
                    <span className="mx-1">|</span>
                    Pcs: <span className="font-semibold text-primary">{totalPcs}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:gap-4">
                  <div className="flex justify-center py-4">
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      className="h-12 w-12 rounded-full"
                      onClick={() => { resetAddProductState(); setShowAddProductDialog(true); }}
                      title="Add product to route"
                    >
                      <Plus className="w-6 h-6" />
                    </Button>
                  </div>

                  <Dialog open={showAddProductDialog} onOpenChange={(open) => { setShowAddProductDialog(open); if (!open) resetAddProductState(); }}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Product to Route</DialogTitle>
                        <DialogDescription>Search product and set quantity.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Product</Label>
                          <Input
                            value={productQuery}
                            onChange={(e) => {
                              setProductQuery(e.target.value);
                              setSelectedProduct(null);
                            }}
                            placeholder="Type word start to search"
                          />
                          {productQuery && (
                            <div className="max-h-40 overflow-auto border rounded-md">
                              {products
                                .filter((p) => nameMatchesQueryByWordPrefix(p.name, productQuery))
                                .slice(0, 8)
                                .map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-muted"
                                    onClick={() => {
                                      setSelectedProduct(p);
                                      setProductQuery(p.name);
                                    }}
                                  >
                                    {p.name} <span className="text-muted-foreground">₹{p.price.toFixed(2)}</span>
                                  </button>
                                ))}
                              {products.filter(p => nameMatchesQueryByWordPrefix(p.name, productQuery)).length === 0 && (
                                <div className="px-3 py-2 text-muted-foreground text-sm">No matches</div>
                              )}
                            </div>
                          )}
                        </div>

                        {selectedProduct && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{selectedProduct.name}</div>
                              <Button type="button" variant="secondary" size="sm" onClick={toggleUnitMode}>
                                Unit: {unitMode === 'box' ? 'Box' : '1 pcs'}
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => adjustTempQuantity(-5)}
                                disabled={tempQuantity <= 0}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="w-20 text-center"
                                value={String(tempQuantity)}
                                onChange={(e) => {
                                  const raw = (e.target.value || '').replace(/\D+/g, '');
                                  // Strip leading zeros but keep single zero
                                  const sanitized = raw.replace(/^0+(?=\d)/, '');
                                  const v = Math.max(0, parseInt(sanitized || '0', 10));
                                  setTempQuantity(v);
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => adjustTempQuantity(5)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="flex justify-end">
                              <Button type="button" onClick={handleAddProductToStock} disabled={!selectedProduct}>
                                Add to Route
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Added Stock List */}
                  {stock.filter((item) => item.quantity > 0).length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Added Stock</Label>
                      <div className="space-y-2">
                        {stock
                          .filter((item) => item.quantity > 0)
                          .map((item) => {
                            const product = products.find((p) => p.id === item.productId);
                            if (!product) return null;
                            return (
                              <div
                                key={`${item.productId}-${item.unit}`}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border px-3 py-2"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium truncate">{product.name}</div>
                                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                                      {item.unit === 'pcs' ? '1 pcs' : 'Box'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateStock(item.productId, item.unit, -5)}
                                    disabled={item.quantity <= 0}
                                    title="Decrease"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    className="w-16 sm:w-20 text-center"
                                    value={item.quantity}
                                    min={0}
                                    onChange={(e) => {
                                      const v = Math.max(0, parseInt(e.target.value || "0"));
                                      setStock((prev) =>
                                        prev.map((si) =>
                                          si.productId === item.productId && si.unit === item.unit ? { ...si, quantity: v } : si
                                        )
                                      );
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateStock(item.productId, item.unit, 5)}
                                    title="Increase"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setStock((prev) =>
                                        prev.map((si) =>
                                          si.productId === item.productId && si.unit === item.unit ? { ...si, quantity: 0 } : si
                                        )
                                      );
                                    }}
                                    title="Remove"
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                variant="success"
                size="default"
                className="w-full h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation"
                disabled={loading || !selectedRoute || totalProducts === 0}
              >
                {loading ? "Starting Route..." : "Start Route"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StartRoute;
