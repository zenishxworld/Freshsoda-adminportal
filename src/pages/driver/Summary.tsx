import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import {
  getActiveRoutes,
  getProducts,
  getRouteAssignedStock,
  getSalesFor,
  endRouteReturnStockRouteRPC,
  endRouteReturnStockRPC,
  clearDailyStock,
  getWarehouseMovements,
  getAssignedStockForBilling,
  getDriverRoute,
  addWarehouseStock,
  type Product,
  type DailyStockItem,
} from "../../lib/supabase";
import { mapRouteName, shouldDisplayRoute } from "../../lib/routeUtils";
import {
  ArrowLeft,
  BarChart3,
  Printer,
  Calendar as CalendarIcon,
  TrendingUp,
  Package,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "../../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";

interface RouteOption {
  id: string;
  name: string;
}

interface SummaryItem {
  productId: string;
  productName: string;
  startBox: number;
  startPcs: number;
  soldBox: number;
  soldPcs: number;
  remainingBox: number;
  remainingPcs: number;
  boxPrice: number;
  pcsPrice: number;
  totalRevenue: number;
}

type SoldItem = {
  productId: string;
  unit?: "box" | "pcs";
  quantity?: number;
  price?: number;
  total?: number;
  productName?: string;
  name?: string;
};
function normalizeSaleProducts(ps: unknown): SoldItem[] {
  if (!ps) return [];
  if (Array.isArray(ps)) return ps as SoldItem[];
  if (typeof ps === "object" && ps !== null) {
    const obj = ps as { items?: unknown };
    if (Array.isArray(obj.items)) return obj.items as SoldItem[];
  }
  if (typeof ps === "string") {
    const parsed = JSON.parse(ps);
    if (Array.isArray(parsed)) return parsed as SoldItem[];
    if (typeof parsed === "object" && parsed !== null) {
      const obj2 = parsed as { items?: unknown };
      if (Array.isArray(obj2.items)) return obj2.items as SoldItem[];
    }
  }
  return [];
}

// Determine pieces per box for a product, using configured value or
// falling back to an inferred ratio from prices or a default of 24.
function getPcsPerBoxFromProduct(product: any): number {
  const configured = product?.pcs_per_box;
  if (typeof configured === "number" && configured > 0) return configured;
  const boxPrice = product?.box_price ?? product?.price;
  const pcsPrice = product?.pcs_price ?? boxPrice / 24;
  const ratio = Math.round(boxPrice / (pcsPrice || 1));
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 24;
}

const Summary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [selectedRoute, setSelectedRoute] = useState("");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [hasAssignedStock, setHasAssignedStock] = useState(false);
  const loadOutTimerRef = useRef<number | null>(null);

  // Memoize totals calculation to avoid re-calculating on every render
  const { totals, grandTotal } = useMemo(() => {
    const t = summaryData.reduce(
      (acc, item) => {
        acc.startBox += item.startBox;
        acc.startPcs += item.startPcs;
        acc.soldBox += item.soldBox;
        acc.soldPcs += item.soldPcs;
        acc.remainingBox += item.remainingBox;
        acc.remainingPcs += item.remainingPcs;
        return acc;
      },
      {
        startBox: 0,
        startPcs: 0,
        soldBox: 0,
        soldPcs: 0,
        remainingBox: 0,
        remainingPcs: 0,
      }
    );
    const gt = summaryData.reduce((sum, item) => sum + item.totalRevenue, 0);
    return { totals: t, grandTotal: gt };
  }, [summaryData]);

  useEffect(() => {
    fetchRoutes();

    // Auto-select route and date
    const loadDefaults = async () => {
      // 1. Try to get active route for driver
      const driverRoute = await getDriverRoute();
      if (driverRoute) {
        setSelectedRoute(driverRoute.routeId);
        // setSelectedDate(driverRoute.date);
        return;
      }

      // 2. Fallback to localStorage (only for route, date should default to today)
      const savedRoute = localStorage.getItem("currentRoute");
      // const savedDate = localStorage.getItem('currentDate');
      if (savedRoute) setSelectedRoute(savedRoute);
      // if (savedDate) setSelectedDate(savedDate);
    };
    loadDefaults();
  }, []);

  const fetchRoutes = async () => {
    try {
      const data = await getActiveRoutes();
      const mappedAndFilteredRoutes = data
        .filter((route) => shouldDisplayRoute(route.name))
        .map((route) => ({
          ...route,
          name: mapRouteName(route.name),
        }));
      setRoutes(mappedAndFilteredRoutes);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load routes",
        variant: "destructive",
      });
    }
  };

  const generateSummary = async () => {
    if (!selectedRoute) {
      toast({
        title: "Error",
        description: "Please select a route",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const products = await getProducts();
      const allSales = await getSalesFor(selectedDate, selectedRoute);
      // Filter sales by current driver if logged in
      const sales = user?.id
        ? allSales.filter((s: any) => s.auth_user_id === user.id)
        : allSales;

      // Load assigned stock (both driver-specific and route-generic)
      const driverId = user?.id || null;
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

      const stockResults = await Promise.all(stockPromises);

      // Combine and deduplicate by product ID (prefer driver-assigned over route-only)
      const stockMap = new Map<string, DailyStockItem>();
      let hasStock = false;

      stockResults.forEach((stockArray, index) => {
        stockArray.forEach(({ product, stock: stockItem }) => {
          // If we have a driver ID, the first result is driver-assigned stock
          const isDriverStock = driverId && index === 0;

          const existing = stockMap.get(product.id);
          // Prefer driver-assigned stock if both exist, otherwise add new
          // Also if we haven't seen this product yet, add it
          if (!existing || isDriverStock) {
            stockMap.set(product.id, stockItem);
          }
          if ((stockItem.boxQty || 0) > 0 || (stockItem.pcsQty || 0) > 0) {
            hasStock = true;
          }
        });
      });

      setHasAssignedStock(hasStock);

      // Calculate summary with separate box and pcs units
      const summary: SummaryItem[] = [];

      if (products) {
        products.forEach((product) => {
          const ppb = getPcsPerBoxFromProduct(product);

          // Current Remaining Stock from database
          const stockItem = stockMap.get(product.id);
          const remainingBox = stockItem ? stockItem.boxQty || 0 : 0;
          const remainingPcs = stockItem ? stockItem.pcsQty || 0 : 0;
          const remainingTotalPcs = remainingBox * ppb + remainingPcs;

          // Sold per unit and revenue from sales
          let soldBox = 0;
          let soldPcs = 0;
          let totalRevenue = 0;
          const boxPrice = (product as any).box_price ?? product.price;
          const pcsPrice =
            (product as any).pcs_price ??
            ((product as any).box_price ?? product.price) / ppb;

          if (sales) {
            sales.forEach((sale) => {
              const items = normalizeSaleProducts(sale.products_sold);
              items.forEach((p) => {
                if (p.productId === product.id) {
                  const u = p.unit || "pcs";
                  const q = p.quantity || 0;
                  if (u === "box") soldBox += q;
                  else soldPcs += q;
                  // Sum revenue using saved total or fallback to price
                  const lineTotal =
                    typeof p.total === "number"
                      ? p.total
                      : q *
                        (typeof p.price === "number"
                          ? p.price
                          : u === "box"
                          ? boxPrice
                          : pcsPrice);
                  totalRevenue += lineTotal;
                }
              });
            });
          }

          const soldTotalPcs = soldBox * ppb + soldPcs;

          // Calculate Start Stock = Remaining + Sold
          const startTotalPcs = remainingTotalPcs + soldTotalPcs;
          const startBox = Math.floor(startTotalPcs / ppb);
          const startPcs = startTotalPcs % ppb;

          // Only include products that were assigned or sold
          if (startTotalPcs > 0 || soldTotalPcs > 0) {
            summary.push({
              productId: product.id,
              productName: product.name,
              startBox,
              startPcs,
              soldBox,
              soldPcs,
              remainingBox,
              remainingPcs,
              boxPrice,
              pcsPrice,
              totalRevenue,
            });
          }
        });
      }

      setSummaryData(summary);
      setShowSummary(true);

      if (summary.length === 0) {
        toast({
          title: "No Data",
          description:
            "No sales or stock data found for the selected date and route",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Summary Generation Error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLoadOut = async () => {
    try {
      console.log("LoadOut -> Calling RPC", {
        route_id: selectedRoute,
        p_work_date: selectedDate,
      });

      // Explicitly return remaining stock to warehouse
      if (summaryData.length > 0) {
        console.log("LoadOut -> Returning remaining stock to warehouse...");
        toast({
          title: "Processing Return",
          description: "Returning remaining stock to warehouse...",
        });
        
        const stockReturnPromises = summaryData.map(async (item) => {
          if (item.remainingBox > 0 || item.remainingPcs > 0) {
            await addWarehouseStock(
              item.productId,
              item.remainingBox,
              item.remainingPcs,
              `Return from Route: ${selectedRoute} (Driver Load-out)`
            );
          }
        });
        await Promise.all(stockReturnPromises);
        console.log("LoadOut -> Stock returned successfully");
      }

      // Pre-check: show remaining before
      const beforeAssigned = await getRouteAssignedStock(
        selectedRoute,
        selectedDate
      );
      const beforeRemaining = (beforeAssigned || []).reduce(
        (sum, r) => sum + (r.qty_remaining || 0),
        0
      );
      console.log(
        "LoadOut -> Before Assigned Remaining (pcs)",
        beforeRemaining,
        beforeAssigned
      );

      // Use driver-specific RPC if user is logged in, otherwise fallback to route RPC
      const driverId = user?.id || null;
      if (driverId) {
        console.log("LoadOut -> Using Driver RPC", driverId);
        await endRouteReturnStockRPC(driverId, selectedRoute, selectedDate);
      } else {
        console.log("LoadOut -> Using Route RPC (No driver)");
        await endRouteReturnStockRouteRPC(selectedRoute, selectedDate);
      }

      // Update route status by clearing daily stock
      console.log("LoadOut -> Clearing Daily Stock to update status");
      await clearDailyStock(driverId, selectedRoute, selectedDate);

      console.log("LoadOut -> RPC Success");

      // Post-check: assigned stock should be zero
      const afterAssigned = await getRouteAssignedStock(
        selectedRoute,
        selectedDate
      );
      const afterRemaining = (afterAssigned || []).reduce(
        (sum, r) => sum + (r.qty_remaining || 0),
        0
      );
      console.log(
        "LoadOut -> After Assigned Remaining (pcs)",
        afterRemaining,
        afterAssigned
      );

      // Fetch recent warehouse movements to confirm returns logged
      const movements = await getWarehouseMovements(undefined, 20);
      console.log(
        "LoadOut -> Recent Warehouse Movements",
        movements.filter((m) => m.movement_type === "RETURN")
      );

      toast({
        title: "LoadOut successful",
        description: "Remaining stock returned to warehouse.",
      });
      setSummaryData([]);
      setShowSummary(false);
      // Delay navigation so toast is visible and logs can be seen
      setTimeout(() => navigate("/driver/dashboard"), 1500);
    } catch (error: any) {
      console.log("LoadOut -> Error", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to return remaining stock",
        variant: "destructive",
      });
    }
  };

  // Auto LoadOut at midnight or when viewing a past day with remaining stock
  useEffect(() => {
    if (loadOutTimerRef.current) {
      clearTimeout(loadOutTimerRef.current);
      loadOutTimerRef.current = null;
    }
    if (!showSummary || !hasAssignedStock || !selectedRoute || !selectedDate)
      return;

    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (selectedDate < todayStr) {
      console.log("Auto LoadOut -> Past day detected, finalizing immediately", {
        route_id: selectedRoute,
        p_work_date: selectedDate,
      });
      handleLoadOut();
      return;
    }
    if (selectedDate === todayStr) {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = nextMidnight.getTime() - now.getTime();
      if (delay <= 0) {
        console.log("Auto LoadOut -> Midnight reached, finalizing now", {
          route_id: selectedRoute,
          p_work_date: selectedDate,
        });
        handleLoadOut();
      } else {
        console.log("Auto LoadOut -> Scheduled", {
          at: nextMidnight.toISOString(),
          route_id: selectedRoute,
          p_work_date: selectedDate,
          delay_ms: delay,
        });
        loadOutTimerRef.current = window.setTimeout(() => {
          handleLoadOut();
          loadOutTimerRef.current = null;
        }, delay);
      }
    }
    return () => {
      if (loadOutTimerRef.current) {
        clearTimeout(loadOutTimerRef.current);
        loadOutTimerRef.current = null;
      }
    };
  }, [showSummary, hasAssignedStock, selectedRoute, selectedDate]);

  const getRouteName = () => {
    const route = routes.find((r) => r.id === selectedRoute);
    if (!route) return "Unknown Route";

    // route names are already mapped in fetchRoutes
    return route.name;
  };

  // Helper function to build the receipt content string
  const getReceiptContent = () => {
    const t = totals;
    const grandTotalStr = grandTotal.toFixed(2);
    const generatedDate = new Date()
      .toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(",", ""); // Remove comma for cleaner output

    const routeName = getRouteName();
    // Format date as DD-MM-YYYY to match image
    const formattedDate = new Date(selectedDate)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "-");

    // 32-character width for 58mm printer
    let content = "";
    content += "================================\n";
    content += "       FRESH SODA SALES       \n"; // Centered
    content += "================================\n";
    content += `Date  : ${formattedDate}\n`;
    content += `Route : ${routeName}\n`;
    content += "--------------------------------\n";
    content += `Start : ${t.startBox}B | ${t.startPcs}p\n`;
    content += `Sold  : ${t.soldBox}B | ${t.soldPcs}p\n`;
    content += `Left  : ${t.remainingBox}B | ${t.remainingPcs}p\n`;
    content += `Total Revenue: ₹${grandTotalStr}\n`;
    content += "--------------------------------\n";
    // Header fits exactly 32 characters with vertical separators: 15 + 1 + 8 + 1 + 7
    content += `${"Item".padEnd(15, " ")}|${"S(B|p)".padEnd(
      8,
      " "
    )}|${"L(B|p)".padEnd(7, " ")}\n`;
    content += "---------------+--------+-------\n";

    summaryData.forEach((item) => {
      // Keep line width to 32 chars with separators: 15 + 1 + 8 + 1 + 7 = 32
      const name = item.productName.substring(0, 15).padEnd(15, " ");
      const sold = `${item.soldBox}|${item.soldPcs}`.padEnd(8, " ");
      const left = `${item.remainingBox}|${item.remainingPcs}`.padEnd(7, " ");
      content += `${name}|${sold}|${left}\n`;
    });

    content += "--------------------------------\n";
    content += `Totals Sold  : ${t.soldBox}B | ${t.soldPcs}p\n`;
    content += `Totals Left  : ${t.remainingBox}B | ${t.remainingPcs}p\n`;
    content += "--------------------------------\n";
    content += `Grand Total: ₹${grandTotalStr}\n`;
    content += "--------------------------------\n";
    content += `Generated: ${generatedDate}\n`;
    content += "Powered by apexdeploy.in\n";
    content += "================================\n";

    return content;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent-light/10">
      {/* Header - Hidden when printing */}
      <header className="bg-white backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10 print:hidden">
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
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-primary to-primary-dark rounded-lg sm:rounded-xl flex items-center justify-center">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground">
                  Day Summary
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">
                  View daily sales report
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
        {!showSummary ? (
          // Filter Form
          <Card className="border-0 shadow-strong">
            <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl font-bold">
                Generate Day Summary
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Select date and route to view sales report
              </CardDescription>
            </CardHeader>

            <CardContent className="px-4 sm:px-6">
              <div className="space-y-6 sm:space-y-8">
                {/* Date Selection */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Select Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-11 sm:h-10 justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                          format(new Date(selectedDate + "T00:00:00"), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(selectedDate + "T00:00:00")}
                        onSelect={(date) =>
                          date && setSelectedDate(format(date, "yyyy-MM-dd"))
                        }
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Route Selection */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Select Route
                  </Label>
                  <Select
                    value={selectedRoute}
                    onValueChange={setSelectedRoute}
                  >
                    <SelectTrigger className="h-11 sm:h-10 text-base  bg-white">
                      <SelectValue placeholder="Choose route" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {routes.map((route) => (
                        <SelectItem
                          key={route.id}
                          value={route.id}
                          className="text-base py-3"
                        >
                          {route.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={generateSummary}
                  variant="default"
                  size="default"
                  className="w-full h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation text-white"
                  disabled={loading || !selectedRoute}
                >
                  <BarChart3 className="w-5 h-5 mr-2" />
                  {loading ? "Generating..." : "Generate Summary"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Summary Report
          <div className="space-y-4">
            {/* Action Buttons - Hidden when printing */}
            <Card className="border-0 shadow-strong print:hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex gap-2 sm:gap-3">
                  <Button
                    onClick={handlePrint}
                    variant="default"
                    size="default"
                    className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold touch-manipulation text-white"
                  >
                    <Printer className="w-5 h-5 mr-2" />
                    Print Summary
                  </Button>
                  <Button
                    onClick={() => setShowSummary(false)}
                    variant="outline"
                    size="default"
                    className="h-10 sm:h-11 px-4 sm:px-6 touch-manipulation"
                  >
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Printable Summary Report */}
            <Card className="border-0 shadow-strong print:shadow-none">
              <CardContent className="p-4 sm:p-8 print:p-0">
                {/* Report Header */}
                <div className="text-center mb-6 print:hidden">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground print:text-xl">
                    Fresh Soda Sales
                  </h1>
                  <p className="text-base sm:text-lg font-semibold text-muted-foreground print:text-sm">
                    Day Summary Report
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground print:text-xs print:mt-2">
                    <p>
                      <strong>Date:</strong>{" "}
                      {new Date(selectedDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p>
                      <strong>Route:</strong> {getRouteName()}
                    </p>
                  </div>
                </div>

                {/* Stats Cards - Hidden on print */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6 print:hidden">
                  <Card className="border border-primary-dark/30 bg-primary-light/20">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <Package className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-1 text-primary-dark" />
                      <p className="text-xs sm:text-sm text-gray-700 font-medium">
                        Total Stock
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-primary-dark">
                        {totals.startBox} Box | {totals.startPcs} pcs
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-primary-dark/30 bg-primary-light/20">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <Package className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-1 text-primary-dark" />
                      <p className="text-xs sm:text-sm text-gray-700 font-medium">
                        Sold
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-primary-dark">
                        {totals.soldBox} Box | {totals.soldPcs} pcs
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-warning-dark/30 bg-warning-light/20">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <Package className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-1 text-warning-dark" />
                      <p className="text-xs sm:text-sm text-gray-700 font-medium">
                        Remaining
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-warning-dark">
                        {totals.remainingBox} Box | {totals.remainingPcs} pcs
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-success-green-dark/30 bg-success-green-light/20">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <DollarSign className="w-5 h-5 sm:w-8 sm:h-8 mx-auto mb-1 text-success-green-dark" />
                      <p className="text-xs sm:text-sm text-gray-700 font-medium">
                        Revenue
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-success-green-dark truncate max-w-full overflow-hidden">
                        ₹{grandTotal.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Summary Table (Desktop) - hidden on print */}
                <div className="mb-6 print:mb-4 overflow-x-auto hidden sm:block print:hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-foreground">
                        <th className="text-left py-2 sm:py-3 font-bold text-foreground print:text-xs print:py-1">
                          Product
                        </th>
                        <th className="text-center py-2 sm:py-3 font-bold text-foreground print:text-xs print:py-1">
                          Start (Box | pcs)
                        </th>
                        <th className="text-center py-2 sm:py-3 font-bold text-foreground print:text-xs print:py-1">
                          Sold (Box | pcs)
                        </th>
                        <th className="text-center py-2 sm:py-3 font-bold text-foreground print:text-xs print:py-1">
                          Left (Box | pcs)
                        </th>
                        <th className="text-right py-2 sm:py-3 font-bold text-foreground print:text-xs print:py-1">
                          Prices
                        </th>
                        <th className="text-right py-2 sm:py-3 font-bold text-foreground print:text-xs print:py-1">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.map((item) => (
                        <tr
                          key={item.productId}
                          className="border-b border-border"
                        >
                          <td className="py-3 text-foreground font-medium print:text-xs print:py-2">
                            {item.productName}
                          </td>
                          <td className="py-3 text-center text-muted-foreground print:text-xs print:py-2">
                            {item.startBox} Box | {item.startPcs} pcs
                          </td>
                          <td className="py-3 text-center text-primary-dark font-semibold print:text-xs print:py-2">
                            {item.soldBox} Box | {item.soldPcs} pcs
                          </td>
                          <td className="py-3 text-center text-warning-dark font-semibold print:text-xs print:py-2">
                            {item.remainingBox} Box | {item.remainingPcs} pcs
                          </td>
                          <td className="py-3 text-right text-gray-700 print:text-xs print:py-2">
                            Box ₹{item.boxPrice.toFixed(2)} | pcs ₹
                            {item.pcsPrice.toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-semibold text-success-green-dark print:text-xs print:py-2">
                            ₹{item.totalRevenue.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary List (Mobile) */}
                <div className="sm:hidden mb-6 space-y-2 print:hidden">
                  {summaryData.map((item) => (
                    <div key={item.productId} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground truncate max-w-[60%]">
                          {item.productName}
                        </span>
                        <span className="text-sm font-bold text-success-green-dark">
                          ₹{item.totalRevenue.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Start:</span>
                          <span className="ml-1 font-semibold">
                            {item.startBox} Box | {item.startPcs} pcs
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sold:</span>
                          <span className="ml-1 font-semibold text-primary-dark">
                            {item.soldBox} Box | {item.soldPcs} pcs
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-700">Left:</span>
                          <span className="ml-1 font-semibold text-warning-dark">
                            {item.remainingBox} Box | {item.remainingPcs} pcs
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Price:</span>
                          <span className="ml-1 font-medium text-muted-foreground">
                            Box ₹{item.boxPrice.toFixed(2)} | pcs ₹
                            {item.pcsPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Section */}
                <div className="border-t-2 border-foreground pt-4 print:pt-3 space-y-2 print:hidden">
                  <div className="flex justify-between items-center text-sm sm:text-base print:text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Total Items Sold:
                    </span>
                    <span className="font-bold text-primary-dark">
                      {totals.soldBox} Box | {totals.soldPcs} pcs
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm sm:text-base print:text-xs">
                    <span className="font-semibold text-gray-700">
                      Total Remaining:
                    </span>
                    <span className="font-bold text-warning-dark">
                      {totals.remainingBox} Box | {totals.remainingPcs} pcs
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed flex-wrap gap-2 sm:flex-nowrap min-w-0">
                    <span className="text-lg sm:text-xl font-bold text-foreground print:text-base">
                      GRAND TOTAL:
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold text-success-green-dark print:text-xl truncate max-w-[60%] sm:max-w-none overflow-hidden text-right">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-dashed text-center print:hidden">
                  <p className="text-sm font-semibold text-foreground print:text-xs">
                    End of Day Report
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 print:text-[10px]">
                    Generated on {new Date().toLocaleString("en-IN")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="mt-4 print:hidden">
              <Button
                onClick={handleLoadOut}
                disabled={!showSummary || !hasAssignedStock}
                className="w-full h-11 text-base font-semibold"
              >
                LoadOut / Return Remaining Stock
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Top-level print container (rendered into document.body via portal) */}
      {showSummary &&
        createPortal(
          <div
            id="print-summary-receipt"
            // These inline styles are a fallback, the @media print CSS is primary
            style={{
              whiteSpace: "pre",
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: "11px",
              lineHeight: "1.3",
              color: "#000",
              display: "none", // Hidden by default, only shown by print CSS
            }}
          >
            {getReceiptContent()}
          </div>,
          document.body
        )}

      {/* Print Styles for 58mm receipt */}
      <style>{`
        @media print {
          /* Hide everything except the receipt container */
          body > *:not(#print-summary-receipt) { display: none !important; }
          #print-summary-receipt { display: block !important; }

          @page {
            size: 58mm auto;
            margin: 2mm; /* Add a little margin */
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #fff !important;
            width: 58mm !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000 !important; /* Ensure all text is black */
            background: #fff !important; /* Ensure background is white */
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          #print-summary-receipt {
            display: block !important;
            width: 100% !important; /* Use 100% of the page width */
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important; /* Padding is on @page */
            font-family: 'Courier New', Courier, monospace !important; /* Force monospace */
            font-size: 12px !important; /* Readable size for 58mm */
            font-weight: 700 !important; /* Bold for thermal print readability */
            line-height: 1.3 !important;
            white-space: pre !important; /* CRITICAL: Respect whitespace and newlines */
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Summary;
