import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ErrorInfo,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, parseISO } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { useToast } from "../../hooks/use-toast";
import {
  getProducts,
  getActiveRoutes,
  getTrucks,
  saveDailyStock,
  getDailyStockForRouteTruckDate,
  getAssignedStockForBilling,
  addRoute,
  deactivateRoute,
  type Product,
  type DailyStockItem,
  type RouteOption,
  type TruckOption,
} from "../../lib/supabase";
import { mapRouteName, shouldDisplayRoute } from "../../lib/routeUtils";
import {
  ArrowLeft,
  Route as RouteIcon,
  Package,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Truck,
  RotateCcw,
  Copy,
  AlertTriangle,
} from "lucide-react";

// RouteOption and TruckOption are imported from supabase.ts
interface RouteOptionWithDisplay extends RouteOption {
  displayName?: string;
}

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: ReactNode; onRetry: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onRetry: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary-light/10 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
              <CardDescription>
                An error occurred while loading Start Route. Please try again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={this.props.onRetry} className="w-full">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

const StartRoute = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<{ id?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load last selections from localStorage
  const [selectedRoute, setSelectedRoute] = useState(() => {
    return localStorage.getItem("fs_last_route") || "";
  });
  const [selectedTruck, setSelectedTruck] = useState(() => {
    return localStorage.getItem("fs_last_truck") || "";
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const lastDate = localStorage.getItem("fs_last_date");
    if (lastDate) return lastDate;
    return new Date().toISOString().split("T")[0];
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
  const [savingDisabled, setSavingDisabled] = useState(false);

  // Track highlighted rows for animation
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(
    new Set()
  );
  const [prefilledRows, setPrefilledRows] = useState<Set<string>>(new Set());

  // Refs for hold-to-increase functionality
  const holdIntervalRef = useRef<Record<string, NodeJS.Timeout | null>>({});

  // New state for production features
  const [showRouteStartedWarning, setShowRouteStartedWarning] = useState(false);
  const [hasExistingStock, setHasExistingStock] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(new Set()); // Track manually edited products
  const [saveCooldown, setSaveCooldown] = useState(false);

  useEffect(() => {
    setUser(null);
    setAuthLoading(false);
  }, [navigate]);

  // Offline queue sync function (defined early for use in useEffect)
  const syncOfflineQueue = useCallback(async () => {
    try {
      const queueStr = localStorage.getItem("fs_start_route_offline_queue");
      if (!queueStr) return;

      const queue = JSON.parse(queueStr);
      if (!Array.isArray(queue) || queue.length === 0) return;

      // Try to sync each item
      for (const item of queue) {
        try {
          await saveDailyStock(
            item.routeId,
            item.truckId,
            item.date,
            item.stock
          );
        } catch (err) {
          // If sync fails, keep item in queue
          console.error("Failed to sync offline item:", err);
          return;
        }
      }

      // All items synced successfully
      localStorage.removeItem("fs_start_route_offline_queue");
      toast({
        title: "Offline data synced successfully!",
        description: "Your saved data has been synchronized.",
      });
    } catch (error) {
      console.error("Error syncing offline queue:", error);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    // Set up offline sync listener
    const handleOnline = async () => {
      await syncOfflineQueue();
    };
    window.addEventListener("online", handleOnline);
    // Try to sync immediately on mount
    syncOfflineQueue();
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncOfflineQueue]);

  // Save selections to localStorage
  useEffect(() => {
    if (selectedRoute) localStorage.setItem("fs_last_route", selectedRoute);
  }, [selectedRoute]);

  useEffect(() => {
    if (selectedTruck) localStorage.setItem("fs_last_truck", selectedTruck);
  }, [selectedTruck]);

  useEffect(() => {
    if (selectedDate) localStorage.setItem("fs_last_date", selectedDate);
  }, [selectedDate]);

  // Check for existing stock when route/truck/date changes
  useEffect(() => {
    if (selectedRoute && selectedTruck && selectedDate && products.length > 0) {
      checkExistingStock();
    } else {
      setShowRouteStartedWarning(false);
      setHasExistingStock(false);
    }
  }, [selectedRoute, selectedTruck, selectedDate, products]);

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

  useEffect(() => {
    const prefillAssigned = async () => {
      if (!selectedRoute || !selectedDate || products.length === 0) return;
      try {
        setLoadingStock(true);
        const rows = await getAssignedStockForBilling(
          null,
          selectedRoute,
          selectedDate
        );
        const prefilledIds = new Set<string>();
        const merged: Record<string, DailyStockItem> = {};
        const rowMap = new Map<string, DailyStockItem>();
        rows.forEach((r) => {
          const s = r.stock;
          rowMap.set(r.product.id, {
            productId: r.product.id,
            boxQty: s.boxQty || 0,
            pcsQty: s.pcsQty || 0,
          });
          if ((s.boxQty || 0) > 0 || (s.pcsQty || 0) > 0)
            prefilledIds.add(r.product.id);
        });
        products.forEach((p) => {
          if (dirtyProducts.has(p.id)) {
            merged[p.id] = stock[p.id];
          } else {
            merged[p.id] = rowMap.get(p.id) || {
              productId: p.id,
              boxQty: 0,
              pcsQty: 0,
            };
          }
        });
        setStock(merged);
        setPrefilledRows(prefilledIds);
        setHasExistingStock(prefilledIds.size > 0);
        setTimeout(() => {
          setPrefilledRows(new Set());
        }, 1500);
      } finally {
        setLoadingStock(false);
      }
    };
    prefillAssigned();
  }, [selectedRoute, selectedDate, products]);

  // Check if route already started today
  const checkExistingStock = async () => {
    if (
      !selectedRoute ||
      !selectedTruck ||
      !selectedDate ||
      products.length === 0
    )
      return;

    try {
      const normalizedDate = new Date(selectedDate).toISOString().split("T")[0];

      const existing = await getDailyStockForRouteTruckDate(
        selectedRoute,
        selectedTruck,
        normalizedDate
      );

      if (existing !== null && existing.length > 0) {
        setHasExistingStock(true);
        setShowRouteStartedWarning(true);
      } else {
        setHasExistingStock(false);
        setShowRouteStartedWarning(false);
      }
    } catch (error) {
      console.error("Error checking existing stock:", error);
    }
  };

  // Copy previous day's stock
  const copyPreviousDayStock = async () => {
    if (!selectedRoute || !selectedTruck || !selectedDate) {
      toast({
        title: "Error",
        description: "Please select route, truck, and date first",
        variant: "destructive",
      });
      return;
    }

    try {
      const normalizedDate = new Date(selectedDate).toISOString().split("T")[0];

      const dateObj = parseISO(normalizedDate);
      const yesterdayDate = format(subDays(dateObj, 1), "yyyy-MM-dd");

      const yesterdayStock = await getDailyStockForRouteTruckDate(
        selectedRoute,
        selectedTruck,
        yesterdayDate
      );

      if (yesterdayStock === null || yesterdayStock.length === 0) {
        toast({
          title: "No previous stock found",
          description: "No stock found for this route and truck yesterday.",
        });
        return;
      }

      // Prefill stock from yesterday
      const stockMap: Record<string, DailyStockItem> = {};
      const copiedProductIds = new Set<string>();

      yesterdayStock.forEach((item) => {
        stockMap[item.productId] = {
          productId: item.productId,
          boxQty: item.boxQty || 0,
          pcsQty: item.pcsQty || 0,
        };
        if ((item.boxQty || 0) > 0 || (item.pcsQty || 0) > 0) {
          copiedProductIds.add(item.productId);
        }
      });

      // Merge with all products
      const mergedStock: Record<string, DailyStockItem> = {};
      products.forEach((product) => {
        mergedStock[product.id] = stockMap[product.id] || {
          productId: product.id,
          boxQty: 0,
          pcsQty: 0,
        };
      });

      setStock(mergedStock);

      // Highlight copied rows with light-blue
      setHighlightedRows(copiedProductIds);
      setTimeout(() => {
        setHighlightedRows(new Set());
      }, 1000);

      toast({
        title: "Stock Copied",
        description: "Yesterday's stock has been copied successfully.",
      });
    } catch (error) {
      console.error("Error copying previous day stock:", error);
      toast({
        title: "Error",
        description: "Failed to copy previous day's stock",
        variant: "destructive",
      });
    }
  };

  const fetchData = async () => {
    try {
      setError(null);
      setLoading(true);
      setLoadingRoutes(true);
      setLoadingTrucks(true);
      setLoadingProducts(true);

      // Fetch products, routes, and trucks from Supabase
      const [productsRes, routesRes, trucksRes] = await Promise.all([
        getProducts(),
        getActiveRoutes(),
        getTrucks(),
      ]);

      const activeProducts = productsRes.filter(
        (p) => (p.status || "active") === "active"
      );
      setProducts(activeProducts);
      setLoadingProducts(false);

      // Initialize stock map with all products (0/0)
      const initialStock: Record<string, DailyStockItem> = {};
      activeProducts.forEach((product) => {
        initialStock[product.id] = {
          productId: product.id,
          boxQty: 0,
          pcsQty: 0,
        };
      });
      setStock(initialStock);

      // Map route names for display
      const mappedRoutes = routesRes
        .filter((route) => shouldDisplayRoute(route.name))
        .map((route) => ({
          ...route,
          displayName: mapRouteName(route.name),
        }));
      setRoutes(mappedRoutes);
      setLoadingRoutes(false);

      setTrucks(trucksRes);
      setLoadingTrucks(false);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to load data");
      setError(error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingRoutes(false);
      setLoadingTrucks(false);
      setLoadingProducts(false);
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
      // Normalize date format (ensure YYYY-MM-DD)
      const normalizedDate = selectedDate.includes("T")
        ? format(new Date(selectedDate), "yyyy-MM-dd")
        : selectedDate;
      const existingStock = await getDailyStockForRouteTruckDate(
        selectedRoute,
        selectedTruck,
        normalizedDate
      );

      // existingStock can be: null (no record), [] (record exists but empty), or [{...}] (with items)
      if (existingStock !== null && existingStock.length > 0) {
        // Convert array to map
        const stockMap: Record<string, DailyStockItem> = {};
        const prefilledProductIds = new Set<string>();
        const changedProductIds = new Set<string>();

        existingStock.forEach((item) => {
          const existingValue = stock[item.productId];
          const newBoxQty = item.boxQty || 0;
          const newPcsQty = item.pcsQty || 0;

          stockMap[item.productId] = {
            productId: item.productId,
            boxQty: newBoxQty,
            pcsQty: newPcsQty,
          };

          // Track which products were prefilled
          if (newBoxQty > 0 || newPcsQty > 0) {
            prefilledProductIds.add(item.productId);
          }

          // Track changed products (only if not manually edited)
          if (!dirtyProducts.has(item.productId)) {
            if (
              !existingValue ||
              existingValue.boxQty !== newBoxQty ||
              existingValue.pcsQty !== newPcsQty
            ) {
              changedProductIds.add(item.productId);
            }
          }
        });

        // Merge with existing stock map (to include all products)
        // Only update non-dirty products
        const mergedStock: Record<string, DailyStockItem> = {};
        products.forEach((product) => {
          if (dirtyProducts.has(product.id)) {
            // Keep manually edited values
            mergedStock[product.id] = stock[product.id];
          } else {
            mergedStock[product.id] = stockMap[product.id] || {
              productId: product.id,
              boxQty: 0,
              pcsQty: 0,
            };
          }
        });
        setStock(mergedStock);

        // Highlight prefilled rows (green for all, blue for changed only)
        setPrefilledRows(prefilledProductIds);
        if (changedProductIds.size > 0) {
          setHighlightedRows(changedProductIds);
          setTimeout(() => {
            setHighlightedRows(new Set());
          }, 1000);
        }
        setTimeout(() => {
          setPrefilledRows(new Set());
        }, 1500);

        toast({
          title: "Stock Loaded",
          description:
            "Existing stock for this route/truck/date has been loaded.",
        });
      } else {
        // No daily_stock yet; fallback to admin assigned stock (route-only) for prefill
        try {
          const assigned = await getAssignedStockForBilling(
            null,
            selectedRoute,
            normalizedDate
          );
          const rowMap = new Map<string, DailyStockItem>();
          const prefilledIds = new Set<string>();
          assigned.forEach(({ product, stock: s }) => {
            rowMap.set(product.id, {
              productId: product.id,
              boxQty: s.boxQty || 0,
              pcsQty: s.pcsQty || 0,
            });
            if ((s.boxQty || 0) > 0 || (s.pcsQty || 0) > 0)
              prefilledIds.add(product.id);
          });

          const merged: Record<string, DailyStockItem> = {};
          products.forEach((product) => {
            if (dirtyProducts.has(product.id)) {
              merged[product.id] = stock[product.id];
            } else {
              merged[product.id] = rowMap.get(product.id) || {
                productId: product.id,
                boxQty: 0,
                pcsQty: 0,
              };
            }
          });

          setStock(merged);
          setPrefilledRows(prefilledIds);
          setHasExistingStock(prefilledIds.size > 0);
          setTimeout(() => {
            setPrefilledRows(new Set());
          }, 1500);
        } catch (e) {
          // Fallback to zeros if assigned stock not available
          const emptyStock: Record<string, DailyStockItem> = {};
          products.forEach((product) => {
            if (dirtyProducts.has(product.id)) {
              emptyStock[product.id] = stock[product.id];
            } else {
              emptyStock[product.id] = {
                productId: product.id,
                boxQty: 0,
                pcsQty: 0,
              };
            }
          });
          setStock(emptyStock);
        }
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

  const updateStockQuantity = (
    productId: string,
    type: "box" | "pcs",
    value: number
  ) => {
    // Mark product as dirty (manually edited)
    setDirtyProducts((prev) => new Set(prev).add(productId));

    setStock((prev) => {
      const current = prev[productId] || { productId, boxQty: 0, pcsQty: 0 };
      const newValue = Math.max(0, value);

      // Highlight the row when value changes
      setHighlightedRows((prev) => new Set(prev).add(productId));
      setTimeout(() => {
        setHighlightedRows((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }, 1000);

      return {
        ...prev,
        [productId]: {
          ...current,
          [type === "box" ? "boxQty" : "pcsQty"]: newValue,
        },
      };
    });
  };

  // Hold-to-increase functionality
  const startHoldIncrease = useCallback(
    (productId: string, type: "box" | "pcs", increment: number) => {
      const key = `${productId}-${type}`;

      // Clear any existing interval
      if (holdIntervalRef.current[key]) {
        clearInterval(holdIntervalRef.current[key]!);
      }

      // Immediate increment with highlight
      setStock((prev) => {
        const current = prev[productId] || { productId, boxQty: 0, pcsQty: 0 };
        const currentValue = type === "box" ? current.boxQty : current.pcsQty;
        const newValue = Math.max(0, currentValue + increment);

        // Highlight the row
        setHighlightedRows((prev) => new Set(prev).add(productId));
        setTimeout(() => {
          setHighlightedRows((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        }, 1000);

        return {
          ...prev,
          [productId]: {
            ...current,
            [type === "box" ? "boxQty" : "pcsQty"]: newValue,
          },
        };
      });

      // Set up interval for continuous increment using functional updates
      holdIntervalRef.current[key] = setInterval(() => {
        setStock((prev) => {
          const current = prev[productId] || {
            productId,
            boxQty: 0,
            pcsQty: 0,
          };
          const currentValue = type === "box" ? current.boxQty : current.pcsQty;
          const newValue = Math.max(0, currentValue + increment);

          return {
            ...prev,
            [productId]: {
              ...current,
              [type === "box" ? "boxQty" : "pcsQty"]: newValue,
            },
          };
        });
      }, 150);
    },
    []
  );

  const stopHoldIncrease = useCallback(
    (productId: string, type: "box" | "pcs") => {
      const key = `${productId}-${type}`;
      if (holdIntervalRef.current[key]) {
        clearInterval(holdIntervalRef.current[key]!);
        holdIntervalRef.current[key] = null;
      }
    },
    []
  );

  // Reset all quantities
  const resetAllQuantities = () => {
    const resetStock: Record<string, DailyStockItem> = {};
    products.forEach((product) => {
      resetStock[product.id] = {
        productId: product.id,
        boxQty: 0,
        pcsQty: 0,
      };
    });
    setStock(resetStock);
    setDirtyProducts(new Set()); // Clear dirty state
    setShowRouteStartedWarning(false); // Dismiss warning
    toast({
      title: "All quantities reset.",
      description: "",
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
      const existing = allRoutes.find(
        (r) =>
          String(r.name).toLowerCase() === String(nameToCheck).toLowerCase()
      );
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
      const message =
        err?.code === "23505"
          ? "A route with this name already exists. Please choose a different name."
          : err?.message || "Failed to create route";
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
      setRoutes((prev) => prev.filter((route) => route.id !== routeId));

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
        description:
          (error as { message?: string }).message ||
          "Failed to deactivate route",
        variant: "destructive",
      });
    } finally {
      setDeletingRoute(false);
    }
  };

  const handleSave = async (shouldNavigate: boolean = false) => {
    // Cooldown check
    if (saveCooldown) {
      return;
    }

    // Validation with specific warnings
    if (!selectedRoute) {
      toast({
        title: "Validation Error",
        description: "Please select a route",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTruck) {
      toast({
        title: "Validation Error",
        description: "Please select a truck",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate) {
      toast({
        title: "Validation Error",
        description: "Please choose a valid date",
        variant: "destructive",
      });
      return;
    }

    // Validate and normalize date format
    let normalizedDate: string;
    try {
      normalizedDate = new Date(selectedDate).toISOString().split("T")[0];
      // Validate the date is valid
      const dateObj = new Date(normalizedDate);
      if (isNaN(dateObj.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Please choose a valid date",
        variant: "destructive",
      });
      return;
    }

    // Check if at least one product has quantity > 0
    const hasQuantities = Object.values(stock).some(
      (item) => (item.boxQty || 0) > 0 || (item.pcsQty || 0) > 0
    );

    if (!hasQuantities) {
      toast({
        title: "Validation Error",
        description: "Please add stock quantities",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSavingDisabled(true);
    setSaveCooldown(true);

    try {
      // Convert stock map to array and filter out zero values
      const stockArray: DailyStockItem[] = Object.values(stock)
        .filter((item) => (item.boxQty || 0) > 0 || (item.pcsQty || 0) > 0)
        .map((item) => ({
          productId: item.productId,
          boxQty: item.boxQty || 0,
          pcsQty: item.pcsQty || 0,
        }));

      const payload = {
        routeId: selectedRoute,
        truckId: selectedTruck,
        date: normalizedDate,
        stock: stockArray,
      };

      try {
        await saveDailyStock(
          selectedRoute,
          selectedTruck,
          normalizedDate,
          stockArray
        );

        // Store route in localStorage for use in other pages
        localStorage.setItem("currentRoute", selectedRoute);
        localStorage.setItem("currentTruck", selectedTruck);
        localStorage.setItem("currentDate", normalizedDate);

        // Clear offline queue if this was queued
        const queueStr = localStorage.getItem("fs_start_route_offline_queue");
        if (queueStr) {
          try {
            const queue = JSON.parse(queueStr);
            const filteredQueue = queue.filter(
              (item: any) =>
                !(
                  item.routeId === selectedRoute &&
                  item.truckId === selectedTruck &&
                  item.date === normalizedDate
                )
            );
            if (filteredQueue.length === 0) {
              localStorage.removeItem("fs_start_route_offline_queue");
            } else {
              localStorage.setItem(
                "fs_start_route_offline_queue",
                JSON.stringify(filteredQueue)
              );
            }
          } catch (e) {
            // Ignore queue parsing errors
          }
        }

        if (shouldNavigate) {
          toast({
            title: "Success!",
            description: "Starting stock saved successfully!",
          });

          // Refresh stock from database
          setTimeout(async () => {
            try {
              const refreshedStock = await getDailyStockForRouteTruckDate(
                selectedRoute,
                selectedTruck,
                normalizedDate
              );
              if (refreshedStock !== null && refreshedStock.length > 0) {
                const stockMap: Record<string, DailyStockItem> = {};
                refreshedStock.forEach((item) => {
                  stockMap[item.productId] = {
                    productId: item.productId,
                    boxQty: item.boxQty || 0,
                    pcsQty: item.pcsQty || 0,
                  };
                });

                const mergedStock: Record<string, DailyStockItem> = {};
                products.forEach((product) => {
                  mergedStock[product.id] = stockMap[product.id] || {
                    productId: product.id,
                    boxQty: 0,
                    pcsQty: 0,
                  };
                });
                setStock(mergedStock);

                // Highlight all saved rows with green (same as prefilled)
                const savedProductIds = new Set<string>();
                refreshedStock.forEach((item) => {
                  if ((item.boxQty || 0) > 0 || (item.pcsQty || 0) > 0) {
                    savedProductIds.add(item.productId);
                  }
                });
                setPrefilledRows(savedProductIds);
                setTimeout(() => {
                  setPrefilledRows(new Set());
                }, 1500);
              }
            } catch (error) {
              console.error("Error refreshing stock:", error);
            }
          }, 500);

          // Navigate after a short delay
          setTimeout(() => {
            navigate("/driver/dashboard");
          }, 1500);
        } else {
          toast({
            title: "Draft saved",
            description: "Your stock has been saved as a draft.",
          });
        }

        // Disable save button for 1 second to prevent double-submit
        setTimeout(() => {
          setSavingDisabled(false);
          setSaveCooldown(false);
        }, 1000);
      } catch (error: unknown) {
        // Offline fallback
        const errorMessage =
          (error as { message?: string }).message || "Failed to save stock";

        // Check if it's a network error
        if (
          errorMessage.includes("network") ||
          errorMessage.includes("fetch") ||
          !navigator.onLine
        ) {
          // Save to offline queue
          try {
            const queueStr = localStorage.getItem(
              "fs_start_route_offline_queue"
            );
            const queue = queueStr ? JSON.parse(queueStr) : [];

            // Remove duplicate entry if exists
            const filteredQueue = queue.filter(
              (item: any) =>
                !(
                  item.routeId === selectedRoute &&
                  item.truckId === selectedTruck &&
                  item.date === normalizedDate
                )
            );

            filteredQueue.push(payload);
            localStorage.setItem(
              "fs_start_route_offline_queue",
              JSON.stringify(filteredQueue)
            );

            toast({
              title: "You're offline",
              description: "Data saved locally and will sync automatically.",
            });
          } catch (queueError) {
            console.error("Error saving to offline queue:", queueError);
            toast({
              title: "Error",
              description:
                "Failed to save stock. Please check your connection.",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
        setSavingDisabled(false);
        setSaveCooldown(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave(true); // Save & Continue
  };

  // Calculate totals (sum all non-zero rows from current state)
  const nonZeroItems = Object.values(stock).filter(
    (item) => (item.boxQty || 0) > 0 || (item.pcsQty || 0) > 0
  );

  const totalBoxes = nonZeroItems.reduce(
    (sum, item) => sum + (item.boxQty || 0),
    0
  );
  const totalPcs = nonZeroItems.reduce(
    (sum, item) => sum + (item.pcsQty || 0),
    0
  );
  const totalProductCount = nonZeroItems.length;

  // Calculate total value
  const totalValue = nonZeroItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return sum;
    const boxPrice = product.box_price || product.price || 0;
    const pcsPrice =
      product.pcs_price || boxPrice / (product.pcs_per_box || 24) || 0;
    return sum + (item.boxQty || 0) * boxPrice + (item.pcsQty || 0) * pcsPrice;
  }, 0);

  // Form validation
  const assignmentsHaveAtLeastOneValue = nonZeroItems.length > 0;

  const isFormValid =
    selectedRoute &&
    selectedTruck &&
    selectedDate &&
    assignmentsHaveAtLeastOneValue;

  // Check if selected date is not today
  const isDateNotToday =
    selectedDate &&
    format(new Date(selectedDate), "yyyy-MM-dd") !==
      format(new Date(), "yyyy-MM-dd");

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(holdIntervalRef.current).forEach((interval) => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

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
    <ErrorBoundary onRetry={fetchData}>
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary-light/10">
        {/* Header */}
        <header className="bg-white backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/driver/dashboard")}
                className="h-9 w-9 p-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-business-blue to-business-blue-dark rounded-lg sm:rounded-xl flex items-center justify-center">
                  <RouteIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">
                    Start Route
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">
                    Setup your daily inventory
                  </p>
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
              <CardTitle className="text-xl sm:text-2xl font-bold">
                Route Configuration
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Select your route and set initial stock levels
              </CardDescription>
            </CardHeader>

            <CardContent className="px-4 sm:px-6">
              {/* Route Already Started Warning */}
              {showRouteStartedWarning && hasExistingStock && (
                <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                    Route Already Started Today
                  </AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    You have already started this route today. Updating stock
                    will overwrite previous entries.
                  </AlertDescription>
                  <div className="flex gap-2 mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetAllQuantities}
                      className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                    >
                      Reset & Start Fresh
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRouteStartedWarning(false)}
                      className="text-yellow-700 hover:bg-yellow-100"
                    >
                      Keep Previous Stock
                    </Button>
                  </div>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                {/* Route Selection */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <RouteIcon className="w-4 h-4" />
                    Select Route
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {loadingRoutes ? (
                      <div className="animate-pulse bg-gray-200 h-11 w-full rounded flex-1"></div>
                    ) : (
                      <Select
                        value={selectedRoute}
                        onValueChange={setSelectedRoute}
                        required
                      >
                        <SelectTrigger className="h-11 sm:h-10 text-base flex-1 bg-white">
                          <SelectValue placeholder="Choose your route" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {routes.map((route) => {
                            const isCustomRoute = ![
                              "Route 1",
                              "Route 2",
                              "Route 3",
                            ].includes(route.displayName || route.name);
                            return (
                              <div
                                key={route.id}
                                className="flex items-center justify-between group"
                              >
                                <SelectItem
                                  value={route.id}
                                  className="text-base py-3 flex-1 min-w-0"
                                >
                                  <span className="block truncate">
                                    {route.displayName || route.name}
                                  </span>
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
                                        <AlertDialogTitle>
                                          Delete Route
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "
                                          {route.displayName || route.name}"?
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteRoute(route.id)}
                                          disabled={deletingRoute}
                                          className="bg-destructive text-white hover:bg-destructive/90"
                                        >
                                          {deletingRoute
                                            ? "Deleting..."
                                            : "Delete"}
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
                    )}

                    <Dialog
                      open={showNewRouteDialog}
                      onOpenChange={setShowNewRouteDialog}
                    >
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
                            Add a new route to your system. It will be available
                            for immediate use.
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
                                if (e.key === "Enter") {
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
                  {loadingTrucks ? (
                    <div className="animate-pulse bg-gray-200 h-11 w-full rounded"></div>
                  ) : (
                    <Select
                      value={selectedTruck}
                      onValueChange={setSelectedTruck}
                      required
                    >
                      <SelectTrigger className="h-11 sm:h-10 text-base bg-white">
                        <SelectValue placeholder="Choose your truck" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {trucks.map((truck) => (
                          <SelectItem
                            key={truck.id}
                            value={truck.id}
                            className="text-base py-3"
                          >
                            {truck.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm sm:text-base font-semibold">
                      Select Date
                    </Label>
                    {isDateNotToday && selectedRoute && selectedTruck && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyPreviousDayStock}
                        className="h-8 text-xs"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Yesterday's Stock
                      </Button>
                    )}
                  </div>
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
                    <div className="flex items-center gap-2">
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Boxes:{" "}
                        <span className="font-semibold text-primary">
                          {totalBoxes}
                        </span>
                        <span className="mx-1">|</span>
                        Pcs:{" "}
                        <span className="font-semibold text-primary">
                          {totalPcs}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetAllQuantities}
                        className="h-8 text-xs"
                        title="Reset all quantities to zero"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Reset Quantities
                      </Button>
                    </div>
                  </div>

                  {loadingProducts || loadingStock ? (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-4 py-3 text-sm font-semibold">
                                Product Name
                              </th>
                              <th className="text-center px-4 py-3 text-sm font-semibold">
                                Box Qty
                              </th>
                              <th className="text-center px-4 py-3 text-sm font-semibold">
                                Pcs Qty
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <tr key={i} className="border-t">
                                <td className="px-4 py-3">
                                  <div className="animate-pulse bg-gray-200 h-6 w-32 rounded"></div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="animate-pulse bg-gray-200 h-8 w-20 rounded mx-auto"></div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="animate-pulse bg-gray-200 h-8 w-20 rounded mx-auto"></div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-4 py-3 text-sm font-semibold">
                                Product Name
                              </th>
                              <th className="text-center px-4 py-3 text-sm font-semibold">
                                Box Qty
                              </th>
                              <th className="text-center px-4 py-3 text-sm font-semibold">
                                Pcs Qty
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((product) => {
                              const stockItem = stock[product.id] || {
                                productId: product.id,
                                boxQty: 0,
                                pcsQty: 0,
                              };
                              const isHighlighted = highlightedRows.has(
                                product.id
                              );
                              const isPrefilled = prefilledRows.has(product.id);
                              const pcsPerBox = product.pcs_per_box || 24;
                              const totalPcsForProduct =
                                (stockItem.boxQty || 0) * pcsPerBox +
                                (stockItem.pcsQty || 0);

                              return (
                                <tr
                                  key={product.id}
                                  className={`border-t hover:bg-muted/30 transition-all duration-500 ease-in-out ${
                                    isHighlighted
                                      ? "bg-blue-50 animate-pulse"
                                      : isPrefilled
                                      ? "bg-green-50"
                                      : ""
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <div className="font-medium">
                                      {product.name}
                                    </div>
                                    {(stockItem.boxQty || 0) > 0 ||
                                    (stockItem.pcsQty || 0) > 0 ? (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Total PCS: {totalPcsForProduct}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                          updateStockQuantity(
                                            product.id,
                                            "box",
                                            stockItem.boxQty - 1
                                          )
                                        }
                                        onMouseDown={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "box",
                                            -1
                                          )
                                        }
                                        onMouseUp={() =>
                                          stopHoldIncrease(product.id, "box")
                                        }
                                        onMouseLeave={() =>
                                          stopHoldIncrease(product.id, "box")
                                        }
                                        onTouchStart={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "box",
                                            -1
                                          )
                                        }
                                        onTouchEnd={() =>
                                          stopHoldIncrease(product.id, "box")
                                        }
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
                                          const value = Math.max(
                                            0,
                                            parseInt(e.target.value || "0", 10)
                                          );
                                          updateStockQuantity(
                                            product.id,
                                            "box",
                                            value
                                          );
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            updateStockQuantity(
                                              product.id,
                                              "box",
                                              stockItem.boxQty + 1
                                            );
                                          } else if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            updateStockQuantity(
                                              product.id,
                                              "box",
                                              Math.max(0, stockItem.boxQty - 1)
                                            );
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                          updateStockQuantity(
                                            product.id,
                                            "box",
                                            stockItem.boxQty + 1
                                          )
                                        }
                                        onMouseDown={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "box",
                                            1
                                          )
                                        }
                                        onMouseUp={() =>
                                          stopHoldIncrease(product.id, "box")
                                        }
                                        onMouseLeave={() =>
                                          stopHoldIncrease(product.id, "box")
                                        }
                                        onTouchStart={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "box",
                                            1
                                          )
                                        }
                                        onTouchEnd={() =>
                                          stopHoldIncrease(product.id, "box")
                                        }
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
                                        onClick={() =>
                                          updateStockQuantity(
                                            product.id,
                                            "pcs",
                                            stockItem.pcsQty - 1
                                          )
                                        }
                                        onMouseDown={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "pcs",
                                            -1
                                          )
                                        }
                                        onMouseUp={() =>
                                          stopHoldIncrease(product.id, "pcs")
                                        }
                                        onMouseLeave={() =>
                                          stopHoldIncrease(product.id, "pcs")
                                        }
                                        onTouchStart={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "pcs",
                                            -1
                                          )
                                        }
                                        onTouchEnd={() =>
                                          stopHoldIncrease(product.id, "pcs")
                                        }
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
                                          const value = Math.max(
                                            0,
                                            parseInt(e.target.value || "0", 10)
                                          );
                                          updateStockQuantity(
                                            product.id,
                                            "pcs",
                                            value
                                          );
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            updateStockQuantity(
                                              product.id,
                                              "pcs",
                                              stockItem.pcsQty + 1
                                            );
                                          } else if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            updateStockQuantity(
                                              product.id,
                                              "pcs",
                                              Math.max(0, stockItem.pcsQty - 1)
                                            );
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                          updateStockQuantity(
                                            product.id,
                                            "pcs",
                                            stockItem.pcsQty + 1
                                          )
                                        }
                                        onMouseDown={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "pcs",
                                            1
                                          )
                                        }
                                        onMouseUp={() =>
                                          stopHoldIncrease(product.id, "pcs")
                                        }
                                        onMouseLeave={() =>
                                          stopHoldIncrease(product.id, "pcs")
                                        }
                                        onTouchStart={() =>
                                          startHoldIncrease(
                                            product.id,
                                            "pcs",
                                            1
                                          )
                                        }
                                        onTouchEnd={() =>
                                          stopHoldIncrease(product.id, "pcs")
                                        }
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

                <div className="space-y-4">
                  {/* Enhanced Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          Total Boxes
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {totalBoxes}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          Total PCS
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {totalPcs}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          Products Added
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {totalProductCount}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          Total Value
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          ₹{totalValue.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Dual Save Buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold"
                      onClick={() => handleSave(false)}
                      disabled={
                        !isFormValid ||
                        loading ||
                        savingDisabled ||
                        saveCooldown
                      }
                    >
                      {loading ? "Saving..." : "Save Draft"}
                    </Button>
                    <Button
                      type="submit"
                      variant="success"
                      size="default"
                      className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation text-white"
                      disabled={
                        !isFormValid ||
                        loading ||
                        savingDisabled ||
                        saveCooldown
                      }
                    >
                      {loading ? "Saving..." : "Save & Continue"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default StartRoute;
