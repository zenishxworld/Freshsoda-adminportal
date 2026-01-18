import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../../../components/tailadmin/Card';
import { Table } from '../../../components/tailadmin/Table';
import { Button } from '../../../components/tailadmin/Button';
import { Badge } from '../../../components/tailadmin/Badge';
import { DatePicker } from '../../../components/tailadmin/DatePicker';
import { RefreshCw, Download, ChevronDown, ChevronRight, TrendingDown } from 'lucide-react';
import { buildDiscountedSalesReport, exportCsv, type DiscountedSalesRow, type DiscountedSaleItem } from '../../../lib/reports';

export const DiscountedSales: React.FC = () => {
    const [from, setFrom] = useState<string>(new Date().toISOString().split('T')[0]);
    const [to, setTo] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState<boolean>(false);
    const [rows, setRows] = useState<DiscountedSalesRow[]>([]);
    const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

    const load = async () => {
        if (!from || !to) return;
        setLoading(true);
        try {
            const data = await buildDiscountedSalesReport({ from, to });
            setRows(data);
            // Auto-expand first route if data exists
            if (data.length > 0) {
                setExpandedRoutes(new Set([data[0].route_id]));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const reset = () => {
        setFrom('');
        setTo('');
        setRows([]);
        setExpandedRoutes(new Set());
    };

    const toggleRoute = (routeId: string) => {
        const newExpanded = new Set(expandedRoutes);
        if (newExpanded.has(routeId)) {
            newExpanded.delete(routeId);
        } else {
            newExpanded.add(routeId);
        }
        setExpandedRoutes(newExpanded);
    };

    const onExport = () => {
        const headers = ['Route', 'Product', 'Unit', 'Default Price', 'Sold Price', 'Discount/Unit', 'Quantity', 'Total Discount', 'Date', 'Shop'];
        const flatData = rows.flatMap(r =>
            r.items.map(item => ({
                Route: r.route_name,
                Product: item.product_name,
                Unit: item.unit,
                'Default Price': item.default_price.toFixed(2),
                'Sold Price': item.sold_price.toFixed(2),
                'Discount/Unit': item.discount_per_unit.toFixed(2),
                Quantity: item.quantity_sold,
                'Total Discount': item.total_discount.toFixed(2),
                Date: item.sale_date,
                Shop: item.shop_name,
            }))
        );
        const csv = exportCsv(headers, flatData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'discounted_sales.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const totals = useMemo(() => {
        const totalDiscount = rows.reduce((s, r) => s + r.total_discount, 0);
        const totalItems = rows.reduce((s, r) => s + r.items.length, 0);
        const totalRoutes = rows.length;
        return { totalDiscount, totalItems, totalRoutes };
    }, [rows]);

    return (
        <div className="space-y-6">
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <DatePicker label="From Date" value={from} onChange={setFrom} />
                    <DatePicker label="To Date" value={to} onChange={setTo} />
                    <div className="flex items-end gap-2">
                        <Button variant="primary" onClick={load} disabled={!from || !to || loading}>
                            {loading ? 'Loading...' : 'Filter'}
                        </Button>
                        <Button variant="outline" onClick={onExport} disabled={rows.length === 0}>
                            <Download className="w-4 h-4 mr-2" />Export
                        </Button>
                        <Button variant="secondary" onClick={reset}>
                            <RefreshCw className="w-4 h-4 mr-2" />Reset
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <p className="text-sm text-gray-600 mb-1">Total Discount Given</p>
                    <h3 className="text-2xl font-bold text-red-600">₹{totals.totalDiscount.toFixed(2)}</h3>
                </Card>
                <Card>
                    <p className="text-sm text-gray-600 mb-1">Discounted Items</p>
                    <h3 className="text-2xl font-bold text-gray-900">{totals.totalItems}</h3>
                </Card>
                <Card>
                    <p className="text-sm text-gray-600 mb-1">Routes with Discounts</p>
                    <h3 className="text-2xl font-bold text-gray-900">{totals.totalRoutes}</h3>
                </Card>
            </div>

            <Card>
                {rows.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <TrendingDown className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">No discounted sales found</p>
                        <p className="text-sm mt-2">Select a date range and click Filter to view discounted sales</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {rows.map((route) => (
                            <div key={route.route_id} className="border rounded-lg overflow-hidden">
                                {/* Route Header */}
                                <div
                                    className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                                    onClick={() => toggleRoute(route.route_id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedRoutes.has(route.route_id) ? (
                                            <ChevronDown className="w-5 h-5 text-gray-600" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-gray-600" />
                                        )}
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {route.route_name || 'Unknown Route'}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {route.items.length} discounted item{route.items.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">Total Discount</p>
                                        <p className="text-xl font-bold text-red-600">₹{route.total_discount.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Route Details */}
                                {expandedRoutes.has(route.route_id) && (
                                    <div className="p-4 bg-white">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-gray-50">
                                                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Product</th>
                                                        <th className="text-center py-3 px-3 font-semibold text-gray-700">Unit</th>
                                                        <th className="text-right py-3 px-3 font-semibold text-gray-700">Default Price</th>
                                                        <th className="text-right py-3 px-3 font-semibold text-gray-700">Sold Price</th>
                                                        <th className="text-right py-3 px-3 font-semibold text-gray-700">Discount/Unit</th>
                                                        <th className="text-center py-3 px-3 font-semibold text-gray-700">Qty</th>
                                                        <th className="text-right py-3 px-3 font-semibold text-gray-700">Total Discount</th>
                                                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Shop</th>
                                                        <th className="text-center py-3 px-3 font-semibold text-gray-700">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {route.items.map((item, idx) => (
                                                        <tr key={idx} className="border-b hover:bg-gray-50">
                                                            <td className="py-3 px-3 font-medium text-gray-900">{item.product_name}</td>
                                                            <td className="py-3 px-3 text-center">
                                                                <Badge variant={item.unit === 'box' ? 'primary' : 'secondary'}>
                                                                    {item.unit.toUpperCase()}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-gray-700">₹{item.default_price.toFixed(2)}</td>
                                                            <td className="py-3 px-3 text-right text-gray-700">₹{item.sold_price.toFixed(2)}</td>
                                                            <td className="py-3 px-3 text-right text-orange-600 font-semibold">
                                                                ₹{item.discount_per_unit.toFixed(2)}
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-medium">{item.quantity_sold}</td>
                                                            <td className="py-3 px-3 text-right text-red-600 font-bold">
                                                                ₹{item.total_discount.toFixed(2)}
                                                            </td>
                                                            <td className="py-3 px-3 text-gray-600">{item.shop_name}</td>
                                                            <td className="py-3 px-3 text-center text-gray-600 text-xs">
                                                                {new Date(item.sale_date).toLocaleDateString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
