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
import { getProducts, getActiveRoutes, getTrucks, saveDailyStock, getDailyStockForRouteTruckDate, addRoute, deactivateRoute, type Product, type DailyStockItem, type RouteOption, type TruckOption } from "../../lib/supabase";
import { mapRouteName, shouldDisplayRoute } from "../../lib/routeUtils";
import { ArrowLeft, Route as RouteIcon, Package, Plus, Minus, Trash2, RefreshCw, Truck } from "lucide-react";



// RouteOption and TruckOption are imported from supabase.ts
interface RouteOptionWithDisplay extends RouteOption {
  displayName?: string;
}




const StartRoute = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<{ id?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [routes, setRoutes] = useState<RouteOptionWithDisplay[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [stock, setStock] = useState<Record<string, DailyStockItem>>({}); // productId -> { productId, boxQty, pcsQty }
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [showNewRouteDialog, setShowNewRouteDialog] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [deletingRoute, setDeletingRoute] = useState(false);

  useEffect(() => {
    setUser(null);
    setAuthLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedRoute && selectedTruck && selectedDate) {
      // Only load existing stock if products are available
      if (products.length > 0) {
        loadExistingStock();
      }
    } else {
      // Reset stock when route/truck/date is cleared
      setStock({});
    }
  }, [selectedRoute, selectedTruck, selectedDate, products]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch products, routes, and trucks from Supabase
      const [productsRes, routesRes, trucksRes] = await Promise.all([
        getProducts(),
        getActiveRoutes(),
        getTrucks()
      ]);

      const activeProducts = productsRes.filter((p) => (p.status || 'active') === 'active');
      setProducts(activeProducts);

      // Initialize stock map with all products (0/0)
      const initialStock: Record<string, DailyStockItem> = {};
      activeProducts.forEach(product => {
        initialStock[product.id] = {
          productId: product.id,
          boxQty: 0,
          pcsQty: 0,
        };
      });
      setStock(initialStock);

      // Map route names for display
      const mappedRoutes = routesRes
        .filter(route => shouldDisplayRoute(route.name))
        .map(route => ({
          ...route,
          displayName: mapRouteName(route.name)
        }));
      setRoutes(mappedRoutes);

      setTrucks(trucksRes);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExistingStock = async () => {
    if (!selectedRoute || !selectedTruck || !selectedDate) {
      return;
    }

    // Ensure products are loaded before proceeding
    if (products.length === 0) {
      return;
    }

    try {
      setLoadingStock(true);
      const existingStock = await getDailyStockForRouteTruckDate(selectedRoute, selectedTruck, selectedDate);
      
      // existingStock can be: null (no record), [] (record exists but empty), or [{...}] (with items)
      if (existingStock !== null && existingStock.length > 0) {
        // Convert array to map
        const stockMap: Record<string, DailyStockItem> = {};
        existingStock.forEach(item => {
          stockMap[item.productId] = {
            productId: item.productId,
            boxQty: item.boxQty || 0,
            pcsQty: item.pcsQty || 0,
          };
        });

        // Merge with existing stock map (to include all products)
        const mergedStock: Record<string, DailyStockItem> = {};
        products.forEach(product => {
          mergedStock[product.id] = stockMap[product.id] || {
            productId: product.id,
            boxQty: 0,
            pcsQty: 0,
          };
        });
        setStock(mergedStock);

        toast({
          title: "Stock Loaded",
          description: "Existing stock for this route/truck/date has been loaded.",
        });
      } else {
        // No existing stock (null) or empty stock array ([]), reset to zeros for all products
        const emptyStock: Record<string, DailyStockItem> = {};
        products.forEach(product => {
          emptyStock[product.id] = {
            productId: product.id,
            boxQty: 0,
            pcsQty: 0,
          };
        });
        setStock(emptyStock);
      }
    } catch (error: any) {
      console.error("Error loading existing stock:", error);
      toast({
        title: "Error",
        description: "Failed to load existing stock. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStock(false);
    }
  };

  const updateStockQuantity = (productId: string, type: 'box' | 'pcs', value: number) => {
    setStock(prev => {
      const current = prev[productId] || { productId, boxQty: 0, pcsQty: 0 };
      return {
        ...prev,
        [productId]: {
          ...current,
          [type === 'box' ? 'boxQty' : 'pcsQty']: Math.max(0, value),
        },
      };
    });
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

    // Validation
    if (!selectedRoute) {
      toast({
        title: "Error",
        description: "Please select a route",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTruck) {
      toast({
        title: "Error",
        description: "Please select a truck",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate) {
      toast({
        title: "Error",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Convert stock map to array
      const stockArray: DailyStockItem[] = Object.values(stock).filter(item => 
        item.boxQty > 0 || item.pcsQty > 0
      );

      if (stockArray.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one product with quantity",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      await saveDailyStock(selectedRoute, selectedTruck, selectedDate, stockArray);

      // Store route in localStorage for use in other pages
      localStorage.setItem('currentRoute', selectedRoute);
      localStorage.setItem('currentTruck', selectedTruck);
      localStorage.setItem('currentDate', selectedDate);

      toast({
        title: "Route Started!",
        description: "Your daily stock has been saved successfully",
      });

      navigate("/driver/dashboard");
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as { message?: string }).message || "Failed to save stock",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalBoxes = Object.values(stock).reduce((sum, item) => sum + (item.boxQty || 0), 0);
  const totalPcs = Object.values(stock).reduce((sum, item) => sum + (item.pcsQty || 0), 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-accent-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading...</p>
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
                                      className="bg-destructive text-white hover:bg-destructive/90"
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

              {/* Truck Selection */}
              <div className="space-y-2">
                <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Select Truck
                </Label>
                <Select value={selectedTruck} onValueChange={setSelectedTruck} required>
                  <SelectTrigger className="h-11 sm:h-10 text-base">
                    <SelectValue placeholder="Choose your truck" />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id} className="text-base py-3">
                        {truck.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label className="text-sm sm:text-base font-semibold">Select Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  className="h-11 sm:h-10 text-base"
                />
              </div>

              {/* Stock Configuration */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                    Stock Quantities
                  </Label>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Boxes: <span className="font-semibold text-primary">{totalBoxes}</span>
                    <span className="mx-1">|</span>
                    Pcs: <span className="font-semibold text-primary">{totalPcs}</span>
                  </div>
                </div>

                {loadingStock ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading stock...</p>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm font-semibold">Product Name</th>
                            <th className="text-center px-4 py-3 text-sm font-semibold">Box Qty</th>
                            <th className="text-center px-4 py-3 text-sm font-semibold">Pcs Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((product) => {
                            const stockItem = stock[product.id] || { productId: product.id, boxQty: 0, pcsQty: 0 };
                            return (
                              <tr key={product.id} className="border-t hover:bg-muted/30">
                                <td className="px-4 py-3">
                                  <div className="font-medium">{product.name}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => updateStockQuantity(product.id, 'box', stockItem.boxQty - 1)}
                                      disabled={stockItem.boxQty <= 0}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      className="w-20 text-center h-8"
                                      value={stockItem.boxQty || 0}
                                      min={0}
                                      onChange={(e) => {
                                        const value = Math.max(0, parseInt(e.target.value || "0", 10));
                                        updateStockQuantity(product.id, 'box', value);
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => updateStockQuantity(product.id, 'box', stockItem.boxQty + 1)}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => updateStockQuantity(product.id, 'pcs', stockItem.pcsQty - 1)}
                                      disabled={stockItem.pcsQty <= 0}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      className="w-20 text-center h-8"
                                      value={stockItem.pcsQty || 0}
                                      min={0}
                                      onChange={(e) => {
                                        const value = Math.max(0, parseInt(e.target.value || "0", 10));
                                        updateStockQuantity(product.id, 'pcs', value);
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => updateStockQuantity(product.id, 'pcs', stockItem.pcsQty + 1)}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="success"
                size="default"
                className="w-full h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation text-white"
                disabled={loading || !selectedRoute || !selectedTruck || !selectedDate || (totalBoxes === 0 && totalPcs === 0)}
              >
                {loading ? "Saving Stock..." : "Start Route / Save Stock"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StartRoute;
