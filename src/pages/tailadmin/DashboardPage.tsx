import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/tailadmin/Card";
import {
  Package,
  TruckIcon,
  DollarSign,
  Archive,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  getAssignmentsForDate,
  subscribeAssignmentsForDate,
  getLowStockProducts,
  getWarehouseStock,
  getSalesFor,
  type AssignmentLogEntry,
  type LowStockItem,
} from "@/lib/supabase";
import { Table } from "@/components/tailadmin/Table";
import { Badge } from "@/components/tailadmin/Badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/tailadmin/Button";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
  change?: number;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  gradient,
  change,
  loading,
}) => {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-0">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
          ) : (
            <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          )}
        </div>
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${gradient} shadow-md`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
};

export const DashboardPage: React.FC = () => {
  const [today, setToday] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [recentAssignments, setRecentAssignments] = useState<
    AssignmentLogEntry[]
  >([]);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loadingLowStock, setLoadingLowStock] = useState<boolean>(false);
  const [stats, setStats] = useState({
    warehouseStock: 0,
    assignedStock: 0,
    sales: 0,
    remainingStock: 0,
    warehouseChange: 0,
    assignedChange: 0,
    salesChange: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lowPage, setLowPage] = useState<number>(0);

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        // Get warehouse stock
        const warehouseData = await getWarehouseStock();
        const totalWarehouse = warehouseData.reduce((sum, item) => {
          return sum + item.boxes;
        }, 0);

        // Get today's assignments
        const todayAssignments = await getAssignmentsForDate(today);
        const totalAssigned = todayAssignments.reduce((sum, assignment) => {
          return sum + (assignment.initial_boxes || assignment.total_boxes);
        }, 0);

        // Calculate remaining stock from actual remaining in assignments
        const remaining = todayAssignments.reduce((sum, assignment) => {
          return sum + assignment.total_boxes;
        }, 0);

        // Get today's sales
        const todaySales = await getSalesFor(today);
        const totalSalesAmount = todaySales.reduce(
          (sum, sale) => sum + (sale.total_amount || 0),
          0
        );

        // Helper to normalize products
        const normalizeSaleProducts = (ps: unknown): any[] => {
          if (!ps) return [];
          if (Array.isArray(ps)) return ps;
          if (typeof ps === "string") {
            try {
              const parsed = JSON.parse(ps);
              if (Array.isArray(parsed)) return parsed;
              if (parsed && Array.isArray(parsed.items)) return parsed.items;
            } catch (e) { return []; }
          }
          if (typeof ps === "object" && ps !== null) {
            const obj = ps as { items?: unknown };
            if (Array.isArray(obj.items)) return obj.items;
          }
          return [];
        };

        // Get yesterday's data for comparison
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().split("T")[0];

        const yesterdayAssignments = await getAssignmentsForDate(yesterdayDate);
        const yesterdayAssigned = yesterdayAssignments.reduce((sum, assignment) => {
          return sum + (assignment.initial_boxes || assignment.total_boxes);
        }, 0);

        const yesterdaySales = await getSalesFor(yesterdayDate);
        const yesterdaySalesAmount = yesterdaySales.reduce(
          (sum, sale) => sum + (sale.total_amount || 0),
          0
        );

        const assignedChange =
          yesterdayAssigned > 0
            ? ((totalAssigned - yesterdayAssigned) / yesterdayAssigned) * 100
            : 0;
        const salesChange =
          yesterdaySalesAmount > 0
            ? ((totalSalesAmount - yesterdaySalesAmount) / yesterdaySalesAmount) * 100
            : 0;

        setStats({
          warehouseStock: totalWarehouse,
          assignedStock: totalAssigned,
          sales: totalSalesAmount,
          remainingStock: remaining,
          warehouseChange: 0,
          assignedChange,
          salesChange,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [today]);

  useEffect(() => {
    const load = async () => {
      setLoadingAssignments(true);
      try {
        const rows = await getAssignmentsForDate(today);
        setRecentAssignments(rows);
      } finally {
        setLoadingAssignments(false);
      }
    };
    load();

    const channel = subscribeAssignmentsForDate(today, () => {
      load();
    });
    return () => {
      channel.unsubscribe();
    };
  }, [today]);

  const recent = useMemo(
    () => recentAssignments.slice(0, 8),
    [recentAssignments]
  );
  type LowRow = { name: string; boxes: number; pcs: number; threshold: number };
  const lowStockColumns = [
    {
      key: "name",
      header: "Product Name",
      render: (_: unknown, row: LowRow) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      )
    },
    {
      key: "available",
      header: "Available (boxes/pcs)",
      render: (_: unknown, row: LowRow) => (
        <div className="flex items-center gap-2">
          <span className="bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded text-sm whitespace-nowrap border border-blue-100">
            {row.boxes} Boxes
          </span>
          <span className="bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded text-sm whitespace-nowrap border border-blue-100">
            {row.pcs} PCS
          </span>
        </div>
      ),
    },
    {
      key: "threshold",
      header: "Threshold",
      render: (_: unknown, row: LowRow) => <span className="font-semibold text-gray-700">{row.threshold} pcs</span>,
    },
    {
      key: "status",
      header: "Status",
      render: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Low Stock
        </span>
      ),
    },
  ];

  useEffect(() => {
    const loadLow = async () => {
      setLoadingLowStock(true);
      try {
        const rows = await getLowStockProducts();
        setLowStock(rows);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load low stock";
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setLoadingLowStock(false);
      }
    };
    loadLow();
  }, [toast]);

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="text-base text-gray-600 mt-1">
          Welcome back! Here's what's happening today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Warehouse Stock"
          value={stats.warehouseStock.toLocaleString()}
          icon={<Package className="w-8 h-8 text-white" />}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          change={stats.warehouseChange}
          loading={loadingStats}
        />
        <StatCard
          title="Today's Assigned Stock"
          value={stats.assignedStock.toLocaleString()}
          icon={<TruckIcon className="w-8 h-8 text-white" />}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
          change={stats.assignedChange}
          loading={loadingStats}
        />
        <StatCard
          title="Today's Sales"
          value={`₹${stats.sales.toLocaleString()}`}
          icon={<DollarSign className="w-8 h-8 text-white" />}
          gradient="bg-gradient-to-br from-amber-500 to-amber-600"
          change={stats.salesChange}
          loading={loadingStats}
        />
        <StatCard
          title="Remaining Stock"
          value={stats.remainingStock.toLocaleString()}
          icon={<Archive className="w-8 h-8 text-white" />}
          gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          loading={loadingStats}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className="border-0"
          header={
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Stock Assignments
            </h3>
          }
        >
          <div className="space-y-3">
            {loadingAssignments && recent.length === 0 ? (
              <div className="py-8 text-center text-gray-600">Loading...</div>
            ) : recent.length === 0 ? (
              <div className="py-8 text-center text-gray-600">
                No assignments yet today
              </div>
            ) : (
              recent.map((row) => {
                const target =
                  row.route_name ||
                  row.driver_name ||
                  row.truck_name ||
                  "Unknown";
                const units = `${row.initial_boxes || row.total_boxes} boxes${row.initial_pcs !== undefined && row.initial_pcs !== null ? `, ${row.initial_pcs} pcs` : ""
                  }`;
                const time = (() => {
                  try {
                    return new Date(row.created_at || "").toLocaleTimeString(
                      "en-IN",
                      { hour: "2-digit", minute: "2-digit" }
                    );
                  } catch {
                    return "";
                  }
                })();
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{target}</p>
                      <p className="text-sm text-gray-600">Date: {row.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{units}</p>
                      <p className="text-sm text-gray-600">{time}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card
          className="border-0"
          header={
            <h3 className="text-lg font-semibold text-gray-900">
              Low Stock Alerts
            </h3>
          }
        >
          {loadingLowStock ? (
            <div className="py-8 text-center text-gray-600">Loading...</div>
          ) : lowStock.length === 0 ? (
            <div className="py-8 text-center text-gray-600">
              All products sufficiently stocked ✔️
            </div>
          ) : (
            <div className="space-y-3">
              <div
                onClick={() => navigate("/admin/warehouse")}
                className="cursor-pointer"
              >
                <Table
                  columns={lowStockColumns}
                  data={lowStock
                    .slice(lowPage * 4, lowPage * 4 + 4)
                    .map((r) => ({
                      name: r.name,
                      boxes: r.boxes,
                      pcs: r.pcs,
                      threshold: r.threshold,
                    }))}
                />
              </div>
              {lowStock.length > 4 && (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setLowPage((p) => Math.max(0, p - 1))}
                    className="flex items-center gap-2"
                    disabled={lowPage <= 0}
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setLowPage((p) =>
                        p + 1 < Math.ceil(lowStock.length / 4) ? p + 1 : p
                      )
                    }
                    className="flex items-center gap-2"
                    disabled={lowPage + 1 >= Math.ceil(lowStock.length / 4)}
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
