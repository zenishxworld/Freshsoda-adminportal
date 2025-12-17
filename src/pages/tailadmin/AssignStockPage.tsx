import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Card } from '@/components/tailadmin/Card';
import { Button } from '@/components/tailadmin/Button';
import { Input } from '@/components/tailadmin/Input';
import { Package, Calendar, AlertCircle } from 'lucide-react';
import {
    getDrivers,
    getActiveRoutes,
    getAssignableProducts,
    getDailyStockForDriverRouteDate,
    saveAssignedStock,
    isRouteStarted,
    type DriverOption,
    type RouteOption,
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
    const [products, setProducts] = useState<AssignableProductRow[]>([]);

    // Selections
    const [selectedRoute, setSelectedRoute] = useState<string>('');
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
    const [isCurrentRouteStarted, setIsCurrentRouteStarted] = useState(false);
    const subscriptionRef = useRef<RealtimeChannel | null>(null);

    // Load initial data
    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setError('');
            const [driversData, routesData, productsData] = await Promise.all([
                getDrivers(),
                getActiveRoutes(),
                getAssignableProducts(),
            ]);
            setDrivers(driversData);
            setRoutes(routesData);
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
    useEffect(() => {
        const loadExistingStock = async () => {
            setAssignments(new Map());
            if (!selectedRoute || !selectedDate) return;

            try {
                // Fetch existing assigned stock from daily_stock (which is the source of truth for current assignment)
                // Passing null for driverId as we are admin assigning to route
                const existingStock = await getDailyStockForDriverRouteDate(null, selectedRoute, null, selectedDate);

                if (existingStock && existingStock.length > 0) {
                    const newAssignments = new Map<string, AssignmentQuantity>();
                    existingStock.forEach(item => {
                        if (item.boxQty > 0 || item.pcsQty > 0) {
                            newAssignments.set(item.productId, {
                                boxQty: item.boxQty,
                                pcsQty: item.pcsQty
                            });
                        }
                    });
                    setAssignments(newAssignments);
                }
            } catch (err) {
                console.error('Error loading existing stock:', err);
                // Non-blocking error, just log it
            }
        };

        loadExistingStock();
    }, [selectedRoute, selectedDate]);

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

    // Check if selected route has been started
    useEffect(() => {
        const checkRouteStatus = async () => {
            if (!selectedRoute || !selectedDate) {
                setIsCurrentRouteStarted(false);
                return;
            }
            try {
                const started = await isRouteStarted(selectedRoute, selectedDate);
                setIsCurrentRouteStarted(started);
            } catch (err) {
                console.error('Error checking route status:', err);
                setIsCurrentRouteStarted(false);
            }
        };
        checkRouteStatus();
    }, [selectedRoute, selectedDate, assignmentLog]);



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

    const sanitizeNumber = (raw: string): number => {
        const digits = raw.replace(/\D+/g, '');
        if (!digits) return 0;
        return parseInt(digits, 10);
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
            // Validate selections - need route and date
            if (!selectedRoute || !selectedDate) {
                alert('Please select a route and a date');
                return;
            }

            // Check if route has been started
            if (isCurrentRouteStarted) {
                alert('Cannot assign stock to a route that has already been started by the driver.');
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

            // Save assignment with delta-based warehouse deduction
            // This function handles: fetching existing assignments, calculating deltas,
            // upserting daily_stock, and updating warehouse stock based on delta only
            await saveAssignedStock(
                null,
                selectedRoute,
                null,
                selectedDate,
                payload
            );

            // Success
            const route = routes.find(r => r.id === selectedRoute);
            const assignmentTarget = route?.name || 'selected route';
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
    const selectedRouteName = routes.find(r => r.id === selectedRoute)?.name || 'Not selected';

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Assign Stock</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">Assign warehouse stock to a route (driver and truck not required)</p>
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

            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
                {/* Summary Sidebar - Show first on mobile */}
                <div className="lg:order-2">
                    <Card>
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Assignment Summary</h3>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4">
                            {/* Selection Info */}
                            <div className="space-y-2 pb-4 border-b border-gray-200">
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
                                <span className="text-base sm:text-lg font-semibold text-gray-900">Total Value:</span>
                                <span className="text-base sm:text-lg font-bold text-primary">
                                    ₹{summary.totalValue.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Main Form */}
                <div className="lg:col-span-2 lg:order-1 space-y-6">
                    {/* Selection Card */}
                    <Card>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Route Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Package className="w-4 h-4 inline mr-1" />
                                    Select Route *
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

                            {/* Spacer */}
                            <div></div>

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


                    {/* Stock Assignment Table */}
                    <Card>
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Stock Assignment</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Assign quantities from warehouse stock to the selected route
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
                                                            value={assignment.boxQty === 0 ? '' : String(assignment.boxQty)}
                                                            onChange={(e) => {
                                                                const v = Math.min(product.boxes, sanitizeNumber(e.target.value));
                                                                updateAssignment(product.product_id, 'boxQty', v);
                                                            }}
                                                            className="max-w-24"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={product.pcs}
                                                            value={assignment.pcsQty === 0 ? '' : String(assignment.pcsQty)}
                                                            onChange={(e) => {
                                                                const v = Math.min(product.pcs, sanitizeNumber(e.target.value));
                                                                updateAssignment(product.product_id, 'pcsQty', v);
                                                            }}
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
                            disabled={saving || loading || !selectedRoute || !selectedDate || isCurrentRouteStarted}
                            className="w-full sm:w-auto"
                        >
                            {saving ? 'Assigning...' : 'Assign Stock'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Assignment Log moved to bottom */}
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
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route Status</th>
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
                                                <div className="text-sm font-medium text-gray-900">{entry.route_name || '-'}</div>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {entry.route_status === 'started' ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                        Route Started
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        Not Started
                                                    </span>
                                                )}
                                            </td>
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
        </div>
    );
};
