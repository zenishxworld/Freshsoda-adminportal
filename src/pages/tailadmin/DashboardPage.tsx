import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Package, TruckIcon, DollarSign, Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAssignmentsForDate, subscribeAssignmentsForDate, getLowStockProducts, type AssignmentLogEntry, type LowStockItem } from '@/lib/supabase';
import { Table } from '@/components/tailadmin/Table';
import { Badge } from '@/components/tailadmin/Badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/tailadmin/Button';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    change?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, change }) => {
    return (
        <Card className="hover:shadow-2 transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                    {change && (
                        <p className="text-sm text-success mt-1">
                            <span className="font-medium">{change}</span> from yesterday
                        </p>
                    )}
                </div>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${color}`}>
                    {icon}
                </div>
            </div>
        </Card>
    );
};

export const DashboardPage: React.FC = () => {
    const [today, setToday] = useState<string>(new Date().toISOString().split('T')[0]);
    const [recentAssignments, setRecentAssignments] = useState<AssignmentLogEntry[]>([]);
    const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [loadingLowStock, setLoadingLowStock] = useState<boolean>(false);
    const { toast } = useToast();
    const navigate = useNavigate();
    const [lowPage, setLowPage] = useState<number>(0);

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

    const recent = useMemo(() => recentAssignments.slice(0, 8), [recentAssignments]);
    type LowRow = { name: string; boxes: number; pcs: number; threshold: number };
    const lowStockColumns = [
        { key: 'name', header: 'Product Name' },
        {
            key: 'available', header: 'Available (boxes/pcs)', render: (_: unknown, row: LowRow) => (
                <span>{row.boxes} boxes / {row.pcs} pcs</span>
            )
        },
        {
            key: 'threshold', header: 'Threshold', render: (_: unknown, row: LowRow) => (
                <span>{row.threshold} pcs</span>
            )
        },
        {
            key: 'status', header: 'Status', render: () => (
                <Badge variant="danger">Low Stock</Badge>
            )
        },
    ];

    useEffect(() => {
        const loadLow = async () => {
            setLoadingLowStock(true);
            try {
                const rows = await getLowStockProducts();
                setLowStock(rows);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Failed to load low stock';
                toast({ title: 'Error', description: msg, variant: 'destructive' });
            } finally {
                setLoadingLowStock(false);
            }
        };
        loadLow();
    }, [toast]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard
                    title="Total Warehouse Stock"
                    value="12,458"
                    icon={<Package className="w-7 h-7 text-white" />}
                    color="bg-primary"
                    change="+5.2%"
                />
                <StatCard
                    title="Today's Assigned Stock"
                    value="3,245"
                    icon={<TruckIcon className="w-7 h-7 text-white" />}
                    color="bg-success"
                    change="+12.5%"
                />
                <StatCard
                    title="Today's Sales"
                    value="₹45,678"
                    icon={<DollarSign className="w-7 h-7 text-white" />}
                    color="bg-warning"
                    change="+8.1%"
                />
                <StatCard
                    title="Remaining Stock"
                    value="9,213"
                    icon={<Archive className="w-7 h-7 text-white" />}
                    color="bg-danger"
                />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card header={<h3 className="text-lg font-semibold text-gray-900">Recent Stock Assignments</h3>}>
                    <div className="space-y-4">
                        {loadingAssignments && recent.length === 0 ? (
                            <div className="py-3 text-center text-gray-600">Loading...</div>
                        ) : recent.length === 0 ? (
                            <div className="py-3 text-center text-gray-600">No assignments yet today</div>
                        ) : (
                            recent.map((row) => {
                                const target = row.route_name || row.driver_name || row.truck_name || 'Unknown';
                                const units = `${row.total_boxes} boxes${row.total_pcs ? `, ${row.total_pcs} pcs` : ''}`;
                                const time = (() => { try { return new Date(row.created_at || '').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })();
                                return (
                                    <div key={row.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                        <div>
                                            <p className="font-medium text-gray-900">{target}</p>
                                            <p className="text-sm text-gray-600">Date: {row.date}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium text-gray-900">{units}</p>
                                            <p className="text-sm text-gray-600">{time}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>

                <Card header={<h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>}>
                    {loadingLowStock ? (
                        <div className="py-3 text-center text-gray-600">Loading...</div>
                    ) : lowStock.length === 0 ? (
                        <div className="py-3 text-center text-gray-600">All products sufficiently stocked ✔️</div>
                    ) : (
                        <div className="space-y-3">
                            <div onClick={() => navigate('/admin/warehouse')} className="cursor-pointer">
                                <Table
                                    columns={lowStockColumns}
                                    data={lowStock.slice(lowPage * 4, lowPage * 4 + 4).map((r) => ({
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
                                        onClick={() => setLowPage((p) => (p + 1 < Math.ceil(lowStock.length / 4) ? p + 1 : p))}
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
