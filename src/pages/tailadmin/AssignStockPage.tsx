import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Card } from '@/components/tailadmin/Card';
import { Button } from '@/components/tailadmin/Button';
import { Input } from '@/components/tailadmin/Input';
import { Package, Calendar, AlertCircle, ChevronDown, Check } from 'lucide-react';
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

// Custom Route Dropdown Component
interface CustomRouteDropdownProps {
    routes: RouteOption[];
    selectedRoute: string;
    onSelectRoute: (routeId: string) => void;
    disabled?: boolean;
}

const CustomRouteDropdown: React.FC<CustomRouteDropdownProps> = ({
    routes,
    selectedRoute,
    onSelectRoute,
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedRouteName = routes.find(r => r.id === selectedRoute)?.name;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Dropdown Trigger */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-3.5 text-base font-medium text-left bg-white border-2 rounded-xl shadow-sm transition-all duration-200 flex items-center justify-between ${disabled
                    ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                    : isOpen
                        ? 'border-primary ring-4 ring-primary/20 shadow-md'
                        : 'border-gray-200 hover:border-primary/50 hover:shadow-md cursor-pointer'
                    } ${selectedRoute ? 'text-gray-900' : 'text-gray-500'}`}
            >
                <span>{selectedRouteName || 'Choose a route to assign stock...'}</span>
                <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''
                        }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-80 overflow-y-auto">
                        {/* Placeholder option */}
                        <button
                            type="button"
                            onClick={() => {
                                onSelectRoute('');
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-base transition-colors duration-150 flex items-center justify-between ${!selectedRoute
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <span>Choose a route to assign stock...</span>
                            {!selectedRoute && <Check className="w-5 h-5 text-primary" />}
                        </button>

                        {/* Divider */}
                        <div className="border-t border-gray-200"></div>

                        {/* Route options */}
                        {routes.length === 0 ? (
                            <div className="px-4 py-6 text-center text-gray-500">
                                No routes available
                            </div>
                        ) : (
                            routes.map((route) => (
                                <button
                                    key={route.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectRoute(route.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left text-base transition-all duration-150 flex items-center justify-between group ${selectedRoute === route.id
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : 'text-gray-900 hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 hover:text-primary'
                                        }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full transition-colors ${selectedRoute === route.id
                                            ? 'bg-primary'
                                            : 'bg-gray-300 group-hover:bg-primary/50'
                                            }`}></div>
                                        {route.name}
                                    </span>
                                    {selectedRoute === route.id && (
                                        <Check className="w-5 h-5 text-primary" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


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
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
                alert("Route is already started you can't assign stock now");
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
                        <div className="p-6">
                            {/* Route Selection */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-base font-semibold text-gray-800">
                                    <div className="p-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                                        <Package className="w-5 h-5 text-primary" />
                                    </div>
                                    <span>Select Route</span>
                                    <span className="text-red-500">*</span>
                                </label>
                                <CustomRouteDropdown
                                    routes={routes}
                                    selectedRoute={selectedRoute}
                                    onSelectRoute={setSelectedRoute}
                                    disabled={loading}
                                />
                                {selectedRoute && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-medium text-green-800">
                                            Route selected: {routes.find(r => r.id === selectedRoute)?.name}
                                        </span>
                                    </div>
                                )}
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
                                                            ₹{product.box_price.toFixed(2)}/box • ₹{product.pcs_price.toFixed(2)}/pcs
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
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" colSpan={2}>Initially Assigned</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" colSpan={2}>Remaining Stock</th>
                                    </tr>
                                    <tr className="bg-gray-100">
                                        <th colSpan={3}></th>
                                        <th className="px-4 py-1.5 text-right text-xs font-medium text-blue-600">Boxes</th>
                                        <th className="px-4 py-1.5 text-right text-xs font-medium text-blue-600">PCS</th>
                                        <th className="px-4 py-1.5 text-right text-xs font-medium text-green-600">Boxes</th>
                                        <th className="px-4 py-1.5 text-right text-xs font-medium text-green-600">PCS</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {assignmentLog.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                {entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{entry.route_name || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {entry.route_status === 'route is ended' ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        route is ended
                                                    </span>
                                                ) : entry.route_status === 'started' ? (
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
                                            {/* Initially Assigned */}
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                                                    {entry.initial_boxes ?? entry.total_boxes}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                                                    {entry.initial_pcs ?? entry.total_pcs}
                                                </div>
                                            </td>
                                            {/* Remaining Stock */}
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
                                                    {entry.total_boxes}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
                                                    {entry.total_pcs}
                                                </div>
                                            </td>
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
