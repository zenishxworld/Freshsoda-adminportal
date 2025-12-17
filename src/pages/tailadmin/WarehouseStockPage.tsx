import React, { useState, useEffect } from 'react';
import { Card } from '@/components/tailadmin/Card';
import { Button } from '@/components/tailadmin/Button';
import { Input } from '@/components/tailadmin/Input';
import { Modal } from '@/components/tailadmin/Modal';
import { Badge } from '@/components/tailadmin/Badge';
import {
    getWarehouseStock,
    addWarehouseStock,
    setWarehouseStock,
    getProductsNotInWarehouse,
    getProducts,
    type WarehouseStock,
    type Product
} from '@/lib/supabase';
import { Package, Plus, Edit, RefreshCw } from 'lucide-react';

export const WarehouseStockPage: React.FC = () => {
    const [stock, setStock] = useState<WarehouseStock[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showNewProductModal, setShowNewProductModal] = useState(false);
    const [selectedStock, setSelectedStock] = useState<WarehouseStock | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [formData, setFormData] = useState({
        boxes: '',
        pcs: '',
        note: '',
    });

    // Load warehouse stock and all products
    const loadWarehouseStock = async () => {
        try {
            setLoading(true);
            const [stockData, productsData] = await Promise.all([
                getWarehouseStock(),
                getProducts()
            ]);
            setStock(stockData);
            setAllProducts(productsData);
        } catch (error) {
            console.error('Error loading warehouse stock:', error);
            alert('Failed to load warehouse stock');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWarehouseStock();
    }, []);

    // Handle form change
    const handleFormChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Reset form
    const resetForm = () => {
        setFormData({ boxes: '', pcs: '', note: '' });
        setSelectedStock(null);
        setSelectedProductId('');
    };

    // Open add modal
    const openAddModal = (stockItem: WarehouseStock) => {
        setSelectedStock(stockItem);
        setFormData({ boxes: '', pcs: '', note: '' });
        setShowAddModal(true);
    };

    // Open edit modal
    const openEditModal = (stockItem: WarehouseStock) => {
        setSelectedStock(stockItem);
        setFormData({
            boxes: String(stockItem.boxes),
            pcs: String(stockItem.pcs),
            note: '',
        });
        setShowEditModal(true);
    };

    // Handle add stock
    const handleAddStock = async () => {
        try {
            if (!selectedStock) return;

            const boxes = parseInt(formData.boxes) || 0;
            const pcs = parseInt(formData.pcs) || 0;

            if (boxes < 0 || pcs < 0) {
                alert('Cannot add negative stock');
                return;
            }

            if (boxes === 0 && pcs === 0) {
                alert('Please enter at least some stock to add');
                return;
            }

            await addWarehouseStock(
                selectedStock.product_id,
                boxes,
                pcs,
                formData.note || undefined
            );
            setShowAddModal(false);
            resetForm();
            loadWarehouseStock();
            alert('Stock added successfully!');
        } catch (error: any) {
            console.error('Error adding stock:', error);
            alert(error.message || 'Failed to add stock');
        }
    };

    // Handle add new product to warehouse
    const handleAddNewProduct = async () => {
        try {
            if (!selectedProductId) {
                alert('Please select a product');
                return;
            }

            const boxes = parseInt(formData.boxes) || 0;
            const pcs = parseInt(formData.pcs) || 0;

            if (boxes < 0 || pcs < 0) {
                alert('Stock cannot be negative');
                return;
            }

            await addWarehouseStock(
                selectedProductId,
                boxes,
                pcs,
                formData.note || undefined
            );
            setShowNewProductModal(false);
            resetForm();
            loadWarehouseStock();
            alert('Product added to warehouse successfully!');
        } catch (error: any) {
            console.error('Error adding new product to warehouse:', error);
            alert(error.message || 'Failed to add product to warehouse');
        }
    };

    // Handle edit stock
    const handleEditStock = async () => {
        try {
            if (!selectedStock) return;

            const boxes = parseInt(formData.boxes) || 0;
            const pcs = parseInt(formData.pcs) || 0;

            if (boxes < 0 || pcs < 0) {
                alert('Stock cannot be negative');
                return;
            }

            await setWarehouseStock(
                selectedStock.product_id,
                boxes,
                pcs,
                formData.note || undefined
            );
            setShowEditModal(false);
            resetForm();
            loadWarehouseStock();
            alert('Stock updated successfully!');
        } catch (error: any) {
            console.error('Error updating stock:', error);
            alert(error.message || 'Failed to update stock');
        }
    };

    // Separate stock into available and out of stock
    const availableStock = stock.filter(item => item.boxes > 0 || item.pcs > 0);
    const activeProductIds = new Set(allProducts.map(p => p.id));
    const outOfStockWarehouse = stock.filter(item => (item.boxes === 0 && item.pcs === 0) && activeProductIds.has(item.product_id));

    // Include products that exist in Manage Products but have no warehouse entry yet as out-of-stock
    const stockProductIds = new Set(stock.map(s => s.product_id));
    const missingProducts = allProducts
        .filter(p => !stockProductIds.has(p.id))
        .map(p => ({
            id: p.id,
            product_id: p.id,
            product_name: p.name,
            box_price: (p.box_price || p.price || 0),
            pcs_price: (p.pcs_price || 0),
            pcs_per_box: (p.pcs_per_box || 24),
            boxes: 0,
            pcs: 0,
            created_at: undefined,
            updated_at: undefined,
        } as WarehouseStock));

    const outOfStock = [...outOfStockWarehouse, ...missingProducts];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Warehouse Stock</h1>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage master inventory in your warehouse</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Button
                        onClick={() => {
                            resetForm();
                            setShowNewProductModal(true);
                        }}
                        variant="primary"
                        className="flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Product to Warehouse</span>
                        <span className="sm:hidden">Add Product</span>
                    </Button>
                    <Button onClick={loadWarehouseStock} variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>
            </div>


            {/* Available Stock Table */}
            <Card>
                <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-green-900">Available Stock</h2>
                        <Badge variant="success">{availableStock.length} Products</Badge>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Box Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PCS Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boxes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PCS</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : availableStock.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No products with stock</td>
                                </tr>
                            ) : (
                                availableStock.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Package className="w-5 h-5 text-gray-400 mr-3" />
                                                <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{item.box_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{item.pcs_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant="success">
                                                {item.boxes} Boxes
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant="success">
                                                {item.pcs} PCS
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => openAddModal(item)}
                                                    className="text-green-600 hover:text-green-800 p-2 rounded-md"
                                                    title="Add Stock"
                                                    aria-label="Add Stock"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="text-primary hover:text-primary-dark p-2 rounded-md"
                                                    title="Edit Stock"
                                                    aria-label="Edit Stock"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Out of Stock Table */}
            <Card>
                <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-red-900">Out of Stock</h2>
                        <Badge variant="secondary">{outOfStock.length} Products</Badge>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Box Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PCS Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boxes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PCS</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : outOfStock.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center py-4">
                                            <p className="text-green-600 font-medium">🎉 Great! All products have stock</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                outOfStock.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Package className="w-5 h-5 text-gray-400 mr-3" />
                                                <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{item.box_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{item.pcs_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant="secondary">
                                                {item.boxes} Boxes
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant="secondary">
                                                {item.pcs} PCS
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => openAddModal(item)}
                                                    className="text-green-600 hover:text-green-800 p-2 rounded-md"
                                                    title="Add Stock"
                                                    aria-label="Add Stock"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="text-primary hover:text-primary-dark p-2 rounded-md"
                                                    title="Edit Stock"
                                                    aria-label="Edit Stock"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add Stock Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    resetForm();
                }}
                title="Add Stock to Warehouse"
            >
                <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600">Product:</p>
                        <p className="text-lg font-semibold text-gray-900">{selectedStock?.product_name}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-md">
                        <p className="text-sm text-blue-600">Current Stock:</p>
                        <p className="text-base font-semibold text-blue-900">
                            {selectedStock?.boxes} Boxes | {selectedStock?.pcs} PCS
                        </p>
                    </div>
                    <Input
                        label="Add Boxes"
                        type="number"
                        value={formData.boxes}
                        onChange={(e) => handleFormChange('boxes', e.target.value)}
                        placeholder="Enter boxes to add"
                        min="0"
                    />
                    <Input
                        label="Add PCS"
                        type="number"
                        value={formData.pcs}
                        onChange={(e) => handleFormChange('pcs', e.target.value)}
                        placeholder="Enter PCS to add"
                        min="0"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Note (Optional)
                        </label>
                        <textarea
                            value={formData.note}
                            onChange={(e) => handleFormChange('note', e.target.value)}
                            placeholder="Add a note about this stock addition..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                        setShowAddModal(false);
                        resetForm();
                    }}>
                        Cancel
                    </Button>
                    <Button size="lg" onClick={handleAddStock}>
                        Add Stock
                    </Button>
                </div>
            </Modal>

            {/* Edit Stock Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    resetForm();
                }}
                title="Edit Warehouse Stock"
            >
                <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600">Product:</p>
                        <p className="text-lg font-semibold text-gray-900">{selectedStock?.product_name}</p>
                    </div>
                    <Input
                        label="Total Boxes"
                        type="number"
                        value={formData.boxes}
                        onChange={(e) => handleFormChange('boxes', e.target.value)}
                        placeholder="Enter total boxes"
                        min="0"
                    />
                    <Input
                        label="Total PCS"
                        type="number"
                        value={formData.pcs}
                        onChange={(e) => handleFormChange('pcs', e.target.value)}
                        placeholder="Enter total PCS"
                        min="0"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Note (Optional)
                        </label>
                        <textarea
                            value={formData.note}
                            onChange={(e) => handleFormChange('note', e.target.value)}
                            placeholder="Add a note about this stock adjustment..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                        setShowEditModal(false);
                        resetForm();
                    }}>
                        Cancel
                    </Button>
                    <Button size="lg" onClick={handleEditStock}>
                        Save Changes
                    </Button>
                </div>
            </Modal>

            {/* Add New Product to Warehouse Modal */}
            <Modal
                isOpen={showNewProductModal}
                onClose={() => {
                    setShowNewProductModal(false);
                    resetForm();
                }}
                title="Add Product to Warehouse"
            >
                <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-md">
                        <p className="text-sm text-blue-600">
                            Select a product to add to warehouse stock
                        </p>
                    </div>

                    {/* Product Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Product
                        </label>
                        <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            <option value="">-- Choose a product --</option>
                            {allProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Input
                        label="Initial Boxes"
                        type="number"
                        value={formData.boxes}
                        onChange={(e) => handleFormChange('boxes', e.target.value)}
                        placeholder="Enter initial boxes (optional)"
                        min="0"
                    />
                    <Input
                        label="Initial PCS"
                        type="number"
                        value={formData.pcs}
                        onChange={(e) => handleFormChange('pcs', e.target.value)}
                        placeholder="Enter initial PCS (optional)"
                        min="0"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Note (Optional)
                        </label>
                        <textarea
                            value={formData.note}
                            onChange={(e) => handleFormChange('note', e.target.value)}
                            placeholder="Add a note about this product addition..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                        setShowNewProductModal(false);
                        resetForm();
                    }}>
                        Cancel
                    </Button>
                    <Button onClick={handleAddNewProduct}>
                        Add to Warehouse
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
