import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Card } from "@/components/tailadmin/Card";
import { Button } from "@/components/tailadmin/Button";
import { Input } from "@/components/tailadmin/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Calendar,
  User,
  Route as RouteIcon,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import {
  getDrivers,
  getActiveRoutes,
  getDriverAssignedStock,
  endRouteReturnStockRPC,
  subscribeAssignedStockForDate,
  type DriverOption,
  type RouteOption,
  type AssignedStockRow,
} from "@/lib/supabase";
import { mapRouteName } from "@/lib/routeUtils";

export const EndRouteApprovalPage: React.FC = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [rows, setRows] = useState<AssignedStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const subRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [ds, rs] = await Promise.all([getDrivers(), getActiveRoutes()]);
        setDrivers(ds);
        setRoutes(rs);
      } catch (e) {
        toast({
          title: "Error",
          description: "Failed to load drivers/routes",
          variant: "destructive",
        });
      }
    };
    init();
  }, [toast]);

  const loadAssigned = useCallback(async () => {
    try {
      if (!selectedDriver || !selectedRoute || !selectedDate) {
        setRows([]);
        return;
      }
      const data = await getDriverAssignedStock(
        selectedDriver,
        selectedRoute,
        selectedDate
      );
      setRows(data);
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to load assigned stock",
        variant: "destructive",
      });
    }
  }, [selectedDriver, selectedRoute, selectedDate, toast]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  useEffect(() => {
    let mounted = true;
    const sub = async () => {
      if (!selectedDriver || !selectedRoute || !selectedDate || !mounted)
        return;
      subRef.current?.unsubscribe?.();
      subRef.current = subscribeAssignedStockForDate(
        selectedDriver,
        selectedRoute,
        selectedDate,
        loadAssigned
      );
    };
    sub();
    return () => {
      mounted = false;
      subRef.current?.unsubscribe?.();
    };
  }, [selectedDriver, selectedRoute, selectedDate, loadAssigned]);

  const totalAssigned = useMemo(
    () => rows.reduce((s, r) => s + (r.qty_assigned || 0), 0),
    [rows]
  );
  const totalRemaining = useMemo(
    () => rows.reduce((s, r) => s + (r.qty_remaining || 0), 0),
    [rows]
  );

  const approveReturn = async () => {
    if (!selectedDriver || !selectedRoute || !selectedDate) {
      toast({
        title: "Validation",
        description: "Select salesman, route and date",
        variant: "destructive",
      });
      return;
    }
    try {
      setLoading(true);
      await endRouteReturnStockRPC(selectedDriver, selectedRoute, selectedDate);
      toast({
        title: "Approved",
        description: "Remaining stock returned to warehouse",
      });
      await loadAssigned();
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to approve end route",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          End Route Approvals
        </h1>
        <p className="text-gray-600 mt-1">
          Approve and return remaining stock to warehouse
        </p>
      </div>
      <Card>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                <User className="w-4 h-4" />
                Salesman
              </label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select salesman" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name || d.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                <RouteIcon className="w-4 h-4" />
                Route
              </label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {mapRouteName(r.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-600">
              Assigned: {totalAssigned} • Remaining: {totalRemaining}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadAssigned}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="primary"
                onClick={approveReturn}
                disabled={loading || totalRemaining <= 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Return
              </Button>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden mt-4">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">
                    Product
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-semibold">
                    Assigned
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-semibold">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No assigned stock
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.product_id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          <span className="font-medium">{r.product_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.qty_assigned}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.qty_remaining}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EndRouteApprovalPage;
