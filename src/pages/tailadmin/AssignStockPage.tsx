import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Card } from '@/components/tailadmin/Card';
import { Button } from '@/components/tailadmin/Button';
import { Input } from '@/components/tailadmin/Input';
import { Package, Truck, User, Calendar, AlertCircle } from 'lucide-react';
import {
    getDrivers,
    getActiveRoutes,
    getTrucks,
    getAssignableProducts,
    getDailyStockForDriverRouteDate,
    saveAssignedStock,
    type DriverOption,
    type RouteOption,
    type TruckOption,
    type AssignableProductRow,
    type DailyStockPayload,
} from '@/lib/supabase';
import { getAssignmentsForDate, subscribeAssignmentsForDate, type AssignmentLogEntry } from '@/lib/supabase';

interface AssignmentQuantity {
    boxQty: number;
    pcsQty: number;
}

export const AssignStockPage: React.FC = () => {
    // Dropdown data
    const [drivers, setDrivers] = useState<DriverOption[]>([]);
    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [trucks, setTrucks] = useState<TruckOption[]>([]);
    const [products, setProducts] = useState<AssignableProductRow[]>([]);

    // Selections
    const [selectedDriver, setSelectedDriver] = useState<string>('');
    const [selectedRoute, setSelectedRoute] = useState<string>('');
    const [selectedTruck, setSelectedTruck] = useState<string>('');
    // Default date to today (YYYY-MM-DD format)
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // Assignments: Map<productId, {boxQty, pcsQty}>
    const [assignments, setAssignments] = useState<Map<string, AssignmentQuantity>>(new Map());

    // UI state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>('');
    const [logLoading, setLogLoading] = useState(false);
    const [assignmentLog, setAssignmentLog] = useState<AssignmentLogEntry[]>([]);
    const subscriptionRef = useRef<RealtimeChannel | null>(null);

    // Load initial data
    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setError('');
            const [driversData, routesData, trucksData, productsData] = await Promise.all([
                getDrivers(),
                getActiveRoutes(),
                getTrucks(),
                getAssignableProducts(),
            ]);
            setDrivers(driversData);
            setRoutes(routesData);
            setTrucks(trucksData);
            setProducts(productsData);
        } catch (err: unknown) {
            console.error('Error loading data:', err);
            const msg = err instanceof Error ? err.message : 'Failed to load data';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Load existing stock when selections change
    const loadExistingStock = useCallback(async () => {
        try {
            if (!((selectedDriver || selectedRoute) && selectedDate)) {
                setAssignments(new Map());
                return;
            }
            const existingStock = await getDailyStockForDriverRouteDate(
                selectedDriver || null,
                selectedRoute || null,
                selectedTruck || null,
                selectedDate
            );

            if (existingStock) {
                const newAssignments = new Map<string, AssignmentQuantity>();
                existingStock.forEach(item => {
                    newAssignments.set(item.productId, {
                        boxQty: item.boxQty,
                        pcsQty: item.pcsQty,
                    });
                });
                setAssignments(newAssignments);
            } else {
                setAssignments(new Map());
            }
        } catch (err: unknown) {
            console.error('Error loading existing stock:', err);
            setAssignments(new Map());
        }
    }, [selectedDriver, selectedRoute, selectedTruck, selectedDate]);

    useEffect(() => {
        loadExistingStock();
    }, [loadExistingStock]);

    useEffect(() => {
        const loadLog = async () => {
            try {
                setLogLoading(true);
                const entries = await getAssignmentsForDate(selectedDate);
                setAssignmentLog(entries);
            } catch (err) {
                console.error('Error loading assignment log:', err);
            } finally {
                setLogLoading(false);
            }
        };

        loadLog();

        subscriptionRef.current?.unsubscribe?.();
        subscriptionRef.current = subscribeAssignmentsForDate(selectedDate, loadLog);

        return () => {
            subscriptionRef.current?.unsubscribe?.();
        };
    }, [selectedDate]);

    

    // Update assignment quantity
    const updateAssignment = (productId: string, field: 'boxQty' | 'pcsQty', value: number) => {
        const newAssignments = new Map(assignments);
        const current = newAssignments.get(productId) || { boxQty: 0, pcsQty: 0 };
        newAssignments.set(productId, {
            ...current,
            [field]: value,
        });
        setAssignments(newAssignments);
    };

    // Get assignment for a product
    const getAssignment = (productId: string): AssignmentQuantity => {
        return assignments.get(productId) || { boxQty: 0, pcsQty: 0 };
    };

    // Calculate subtotal for a product
    const calculateSubtotal = (product: AssignableProductRow): number => {
        const assignment = getAssignment(product.product_id);
        return assignment.boxQty * product.box_price + assignment.pcsQty * product.pcs_price;
    };

    // Calculate summary
    const calculateSummary = () => {
        let totalItems = 0;
        let totalBoxes = 0;
        let totalPcs = 0;
        let totalValue = 0;

        products.forEach(product => {
            const assignment = getAssignment(product.product_id);
            if (assignment.boxQty > 0 || assignment.pcsQty > 0) {
                totalItems++;
                totalBoxes += assignment.boxQty;
                totalPcs += assignment.pcsQty;
                totalValue += calculateSubtotal(product);
            }
        });

        return { totalItems, totalBoxes, totalPcs, totalValue };
    };

    // Handle assign stock
    const handleAssignStock = async () => {
        try {
            // Validate selections - need at least driver OR route, plus date
            if ((!selectedDriver && !selectedRoute) || !selectedDate) {
                alert('Please select at least a driver or route, and a date');
                return;
            }

            // Build payload
            const payload: DailyStockPayload = [];
            products.forEach(product => {
                const assignment = getAssignment(product.product_id);
                if (assignment.boxQty > 0 || assignment.pcsQty > 0) {
                    payload.push({
                        productId: product.product_id,
                        boxQty: assignment.boxQty,
                        pcsQty: assignment.pcsQty,
                    });
                }
            });

            if (payload.length === 0) {
                alert('Please assign at least some stock');
                return;
            }

            setSaving(true);
            setError('');

            await saveAssignedStock(
                selectedDriver || null,
                selectedRoute || null,
                selectedTruck || null,
                selectedDate,
                payload
            );

            // Success
            const driver = drivers.find(d => d.id === selectedDriver);
            const route = routes.find(r => r.id === selectedRoute);
            const assignmentTarget = driver?.name || route?.name || 'selected target';
            alert(`Stock successfully assigned to ${assignmentTarget} on ${selectedDate}`);

            // Refresh assignment log immediately
            try {
                setLogLoading(true);
                const entries = await getAssignmentsForDate(selectedDate);
                setAssignmentLog(entries);
            } finally {
                setLogLoading(false);
            }

            // Reload products to show updated warehouse stock
            const updatedProducts = await getAssignableProducts();
            setProducts(updatedProducts);
        } catch (err: unknown) {
            console.error('Error assigning stock:', err);
            const msg = err instanceof Error ? err.message : 'Failed to assign stock';
            setError(msg);
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const summary = calculateSummary();
    const selectedDriverName = drivers.find(d => d.id === selectedDriver)?.name || 'Not selected';
    const selectedRouteName = routes.find(r => r.id === selectedRoute)?.name || 'Not selected';

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Assign Stock</h1>
                <p className="text-gray-600 mt-1">Assign warehouse stock to drivers or routes (select at least one)</p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Selection Card */}
                    <Card>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Driver Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <User className="w-4 h-4 inline mr-1" />
                                    Select Driver (Optional)
                                </label>
                                <select
                                    value={selectedDriver}
                                    onChange={(e) => setSelectedDriver(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    disabled={loading}
                                >
                                    <option value="">Choose driver</option>
                                    {drivers.map(driver => (
                                        <option key={driver.id} value={driver.id}>
                                            {driver.name} {driver.phone ? `(${driver.phone})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Route Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Package className="w-4 h-4 inline mr-1" />
                                    Select Route (Optional)
                                </label>
                                <select
                                    value={selectedRoute}
                                    onChange={(e) => setSelectedRoute(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    disabled={loading}
                                >
                                    <option value="">Choose route</option>
                                    {routes.map(route => (
                                        <option key={route.id} value={route.id}>
                                            {route.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Truck Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Truck className="w-4 h-4 inline mr-1" />
                                    Select Truck (Optional)
                                </label>
                                <select
                                    value={selectedTruck}
                                    onChange={(e) => setSelectedTruck(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    disabled={loading}
                                >
                                    <option value="">Choose truck</option>
                                    {trucks.map(truck => (
                                        <option key={truck.id} value={truck.id}>
                                            {truck.name} {truck.license_plate ? `(${truck.license_plate})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    Date *
                                </label>
                                <Input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Assignment Log</h3>
                            <p className="text-sm text-gray-600 mt-1">Live updates for {selectedDate}</p>
                        </div>
                        <div className="p-6">
                            {logLoading ? (
                                <div className="text-gray-500">Loading log...</div>
                            ) : assignmentLog.length === 0 ? (
                                <div className="text-gray-500">No assignments recorded for this date.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver / Route</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Truck</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Boxes</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">PCS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {assignmentLog.map((entry) => (
                                                <tr key={entry.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                                        {entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">{entry.driver_name || '-'}</div>
                                                        <div className="text-xs text-gray-500">{entry.route_name || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{entry.truck_name || '-'}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-semibold text-gray-900">{entry.total_boxes}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-semibold text-gray-900">{entry.total_pcs}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Stock Assignment Table */}
                    <Card>
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Stock Assignment</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Assign quantities from warehouse stock (select at least driver or route)
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Product
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Available Stock
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Assign Boxes
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Assign PCS
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Subtotal
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                Loading products...
                                            </td>
                                        </tr>
                                    ) : products.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                No products available in warehouse
                                            </td>
                                        </tr>
                                    ) : (
                                        products.map(product => {
                                            const assignment = getAssignment(product.product_id);
                                            const subtotal = calculateSubtotal(product);
                                            return (
                                                <tr key={product.product_id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {product.product_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            ₹{product.box_price}/box • ₹{product.pcs_price}/pcs
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {product.boxes} boxes
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {product.pcs} pcs
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={product.boxes}
                                                            value={assignment.boxQty}
                                                            onChange={(e) =>
                                                                updateAssignment(
                                                                    product.product_id,
                                                                    'boxQty',
                                                                    parseInt(e.target.value) || 0
                                                                )
                                                            }
                                                            className="max-w-24"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={product.pcs}
                                                            value={assignment.pcsQty}
                                                            onChange={(e) =>
                                                                updateAssignment(
                                                                    product.product_id,
                                                                    'pcsQty',
                                                                    parseInt(e.target.value) || 0
                                                                )
                                                            }
                                                            className="max-w-24"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <span className="text-sm font-medium text-gray-900">
                                                            ₹{subtotal.toFixed(2)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleAssignStock}
                            disabled={saving || loading || (!selectedDriver && !selectedRoute) || !selectedDate}
                        >
                            {saving ? 'Assigning...' : 'Assign Stock'}
                        </Button>
                    </div>
                </div>

                {/* Summary Sidebar */}
                <div>
                    <Card>
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Assignment Summary</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Selection Info */}
                            <div className="space-y-2 pb-4 border-b border-gray-200">
                                <div>
                                    <span className="text-xs text-gray-500">Driver:</span>
                                    <p className="text-sm font-medium text-gray-900">{selectedDriverName}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500">Route:</span>
                                    <p className="text-sm font-medium text-gray-900">{selectedRouteName}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500">Date:</span>
                                    <p className="text-sm font-medium text-gray-900">
                                        {selectedDate || 'Not selected'}
                                    </p>
                                </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Total Items:</span>
                                <span className="font-semibold text-gray-900">{summary.totalItems}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Total Boxes:</span>
                                <span className="font-semibold text-gray-900">{summary.totalBoxes}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Total PCS:</span>
                                <span className="font-semibold text-gray-900">{summary.totalPcs}</span>
                            </div>
                            <div className="flex justify-between py-2 pt-2">
                                <span className="text-lg font-semibold text-gray-900">Total Value:</span>
                                <span className="text-lg font-bold text-primary">
                                    ₹{summary.totalValue.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
