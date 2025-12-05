import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { getActiveRoutes, getRouteAssignedStock, subscribeAssignedStockForRouteDate, getProducts, type AssignedStockRow, type Product } from "../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { mapRouteName } from "../../lib/routeUtils";
import { ArrowLeft, Route as RouteIcon, RefreshCw, Package } from "lucide-react";

const StartRouteAssigned = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [routes, setRoutes] = useState<Array<{ id: string; name: string; displayName?: string }>>([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [assigned, setAssigned] = useState<AssignedStockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const subRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [rs, ps] = await Promise.all([getActiveRoutes(), getProducts()]);
        const mapped = rs.map(r => ({ id: r.id, name: r.name, displayName: mapRouteName(r.name) }));
        setRoutes(mapped);
        setProducts(ps);
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message || "Failed to load routes";
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [toast]);

  const loadAssigned = useCallback(async () => {
    try {
      if (!selectedRoute || !selectedDate) { setAssigned([]); return; }
      const rows = await getRouteAssignedStock(selectedRoute, selectedDate);
      setAssigned(rows);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || "Failed to load assigned stock";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }, [selectedRoute, selectedDate, toast]);

  useEffect(() => { loadAssigned(); }, [loadAssigned]);

  useEffect(() => {
    let mounted = true;
    const sub = async () => {
      if (!selectedRoute || !selectedDate || !mounted) return;
      subRef.current?.unsubscribe?.();
      subRef.current = subscribeAssignedStockForRouteDate(selectedRoute, selectedDate, loadAssigned);
    };
    sub();
    return () => { mounted = false; subRef.current?.unsubscribe?.(); };
  }, [selectedRoute, selectedDate, loadAssigned]);

  const totals = useMemo(() => {
    const pmap = new Map(products.map(p => [p.id, p]));
    let assignedBoxes = 0, assignedPcs = 0, remainingBoxes = 0, remainingPcs = 0;
    assigned.forEach(r => {
      const p = pmap.get(r.product_id);
      const per = p?.pcs_per_box || 24;
      const a = r.qty_assigned || 0;
      const rem = r.qty_remaining || 0;
      assignedBoxes += Math.floor(a / per);
      assignedPcs += a % per;
      remainingBoxes += Math.floor(rem / per);
      remainingPcs += rem % per;
    });
    return { assignedBoxes, assignedPcs, remainingBoxes, remainingPcs };
  }, [assigned, products]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary-light/10">
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
                <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block">Assigned stock for today</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadAssigned} className="h-9 w-9 p-0" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
        <Card className="border-0 shadow-strong">
          <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold">Route</CardTitle>
            <CardDescription className="text-sm sm:text-base">Select route and view assigned stock</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base font-semibold">Select Route</Label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                <SelectTrigger className="h-11 sm:h-10 text-base">
                  <SelectValue placeholder="Choose your route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map(r => (
                    <SelectItem key={r.id} value={r.id} className="text-base py-3">
                      {r.displayName || r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base font-semibold">Select Date</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-11 sm:h-10 text-base" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base sm:text-lg font-semibold flex items-center gap-2"><Package className="w-4 h-4 sm:w-5 sm:h-5" />Assigned Stock</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">Assigned: {totals.assignedBoxes} Box | {totals.assignedPcs} pcs • Remaining: {totals.remainingBoxes} Box | {totals.remainingPcs} pcs</div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold">Product Name</th>
                        <th className="text-center px-4 py-3 text-sm font-semibold">Assigned</th>
                        <th className="text-center px-4 py-3 text-sm font-semibold">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigned.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No assigned stock</td></tr>
                      ) : (
                        assigned.map(row => (
                          <tr key={row.product_id} className="border-t">
                            <td className="px-4 py-3">
                              <div className="font-medium">{row.product_name}</div>
                            </td>
                            <td className="px-4 py-3 text-center">{row.qty_assigned}</td>
                            <td className="px-4 py-3 text-center">{row.qty_remaining}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => { localStorage.setItem('currentRoute', selectedRoute); localStorage.setItem('currentDate', selectedDate); navigate('/driver/shop-billing'); }}>Start Route</Button>
        </div>
      </main>
    </div>
  );
};

export default StartRouteAssigned;
