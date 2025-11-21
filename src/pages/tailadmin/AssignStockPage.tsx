import React, { useState, useEffect } from 'react';
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
    const [selectedDate, setSelectedDate] = useState<string>('');

    // Assignments: Map<productId, {boxQty, pcsQty}>
    const [assignments, setAssignments] = useState<Map<string, AssignmentQuantity>>(new Map());

    // UI state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>('');

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
        } catch (err: any) {
            console.error('Error loading data:', err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // Load existing stock when all selections are made
    useEffect(() => {
        if (selectedDriver && selectedRoute && selectedDate) {
            loadExistingStock();
        }
    }, [selectedDriver, selectedRoute, selectedTruck, selectedDate]);

    const loadExistingStock = async () => {
        try {
            const existingStock = await getDailyStockForDriverRouteDate(
                selectedDriver,
                selectedRoute,
                selectedTruck || null,
                selectedDate
            );

            if (existingStock) {
                // Prefill assignments from existing stock
                const newAssignments = new Map<string, AssignmentQuantity>();
                existingStock.forEach(item => {
                    newAssignments.set(item.productId, {
                        boxQty: item.boxQty,
                        pcsQty: item.pcsQty,
                    });
                });
                setAssignments(newAssignments);
            } else {
                // Clear assignments if no existing stock
                setAssignments(new Map());
            }
        } catch (err: any) {
            console.error('Error loading existing stock:', err);
            // Don't show error - just start fresh
            setAssignments(new Map());
        }
    };

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
            // Validate selections
            if (!selectedDriver || !selectedRoute || !selectedDate) {
                alert('Please select driver, route, and date');
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
                selectedDriver,
                selectedRoute,
                selectedTruck || null,
                selectedDate,
                payload
            );

            // Success
            const driver = drivers.find(d => d.id === selectedDriver);
            const route = routes.find(r => r.id === selectedRoute);
            alert(`Stock successfully assigned to ${driver?.name} for ${route?.name} on ${selectedDate}`);

            // Reload products to show updated warehouse stock
            const updatedProducts = await getAssignableProducts();
            setProducts(updatedProducts);
        } catch (err: any) {
            console.error('Error assigning stock:', err);
            setError(err.message || 'Failed to assign stock');
            alert(err.message || 'Failed to assign stock');
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
                <p className="text-gray-600 mt-1">Assign warehouse stock to drivers for their routes</p>
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
                                    Select Driver *
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

                    {/* Stock Assignment Table */}
                    <Card>
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Stock Assignment</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Assign quantities from warehouse stock to the selected driver
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
                            disabled={saving || loading || !selectedDriver || !selectedRoute || !selectedDate}
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
