import React, { useState, useEffect } from 'react';
import { Card } from '@/components/tailadmin/Card';
import { Button } from '@/components/tailadmin/Button';
import { Input } from '@/components/tailadmin/Input';
import { Modal } from '@/components/tailadmin/Modal';
import { getProducts, upsertProduct, softDeleteProduct, type Product } from '@/lib/supabase';
import { Package, Plus, Edit, RefreshCw, Search, Trash2 } from 'lucide-react';

export const ManageProductsPage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        box_price: '',
        pcs_per_box: '',
        description: '',
    });

    const itemsPerPage = 10;

    // Fetch products
    const fetchProducts = async () => {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
            setFilteredProducts(data);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Search filter
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredProducts(products);
        } else {
            const filtered = products.filter(product =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredProducts(filtered);
        }
        setCurrentPage(1);
    }, [searchQuery, products]);

    // Pagination
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentProducts = filteredProducts.slice(startIndex, endIndex);

    // Auto-calculate PCS price
    const calculatePcsPrice = (boxPrice: string, pcsPerBox: string): number => {
        const box = parseFloat(boxPrice);
        const pcs = parseFloat(pcsPerBox);
        if (box > 0 && pcs > 0) {
            return box / pcs;
        }
        return 0;
    };

    // Handle form change
    const handleFormChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            name: '',
            box_price: '',
            pcs_per_box: '',
            description: '',
        });
        setSelectedProduct(null);
    };

    // Add product
    const handleAddProduct = async () => {
        try {
            const boxPrice = parseFloat(formData.box_price);
            const pcsPerBox = parseFloat(formData.pcs_per_box);

            if (!formData.name || !boxPrice || !pcsPerBox) {
                alert('Please fill all required fields');
                return;
            }

            const pcsPrice = calculatePcsPrice(formData.box_price, formData.pcs_per_box);

            await upsertProduct({
                name: formData.name,
                price: boxPrice,
                box_price: boxPrice,
                pcs_price: pcsPrice,
                pcs_per_box: pcsPerBox,
                description: formData.description,
            });

            setShowAddModal(false);
            resetForm();
            fetchProducts();
        } catch (error) {
            console.error('Error adding product:', error);
            alert('Failed to add product');
        }
    };

    // Edit product
    const handleEditProduct = async () => {
        try {
            if (!selectedProduct) return;

            const boxPrice = parseFloat(formData.box_price);
            const pcsPerBox = parseFloat(formData.pcs_per_box);

            if (!formData.name || !boxPrice || !pcsPerBox) {
                alert('Please fill all required fields');
                return;
            }

            const pcsPrice = calculatePcsPrice(formData.box_price, formData.pcs_per_box);

            await upsertProduct({
                id: selectedProduct.id,
                name: formData.name,
                price: boxPrice,
                box_price: boxPrice,
                pcs_price: pcsPrice,
                pcs_per_box: pcsPerBox,
                description: formData.description,
            });

            setShowEditModal(false);
            resetForm();
            fetchProducts();
        } catch (error) {
            console.error('Error updating product:', error);
            alert('Failed to update product');
        }
    };

    // Delete product
    const handleDeleteProduct = async (product: Product) => {
        if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
            return;
        }

        try {
            await softDeleteProduct(product.id);
            fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Failed to delete product');
        }
    };

    // Open edit modal
    const openEditModal = (product: Product) => {
        setSelectedProduct(product);
        setFormData({
            name: product.name,
            box_price: String(product.box_price || product.price),
            pcs_per_box: String(product.pcs_per_box || 24),
            description: product.description || '',
        });
        setShowEditModal(true);
    };



    const pcsPrice = calculatePcsPrice(formData.box_price, formData.pcs_per_box);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manage Products</h1>
                    <p className="text-sm text-gray-600 mt-1">Add, edit, and manage your product inventory</p>
                </div>
                <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Product
                </Button>
            </div>

            {/* Search and Refresh */}
            <Card>
                <div className="p-4 flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search products by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <Button variant="outline" onClick={fetchProducts} className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>
            </Card>

            {/* Products Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Box Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PCS Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PCS per Box</th>

                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : currentProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No products found</td>
                                </tr>
                            ) : (
                                currentProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Package className="w-5 h-5 text-gray-400 mr-3" />
                                                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{(product.box_price || product.price).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{(product.pcs_price || 0).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {product.pcs_per_box || 24}
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(product)}
                                                    className="text-primary hover:text-primary-dark"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteProduct(product)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                            Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-gray-700">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Add Product Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    resetForm();
                }}
                title="Add New Product"
            >
                <div className="space-y-4">
                    <Input
                        label="Product Name"
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        placeholder="Enter product name"
                        required
                    />
                    <Input
                        label="Box Price (₹)"
                        type="number"
                        value={formData.box_price}
                        onChange={(e) => handleFormChange('box_price', e.target.value)}
                        placeholder="Enter box price"
                        required
                    />
                    <Input
                        label="PCS per Box"
                        type="number"
                        value={formData.pcs_per_box}
                        onChange={(e) => handleFormChange('pcs_per_box', e.target.value)}
                        placeholder="Enter pieces per box"
                        required
                    />
                    <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600">PCS Price (Auto-calculated):</p>
                        <p className="text-lg font-semibold text-gray-900">₹{pcsPrice.toFixed(2)}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleFormChange('description', e.target.value)}
                            placeholder="Enter product description (optional)"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
                    <Button onClick={handleAddProduct}>
                        Add Product
                    </Button>
                </div>
            </Modal>

            {/* Edit Product Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    resetForm();
                }}
                title="Edit Product"
            >
                <div className="space-y-4">
                    <Input
                        label="Product Name"
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        placeholder="Enter product name"
                        required
                    />
                    <Input
                        label="Box Price (₹)"
                        type="number"
                        value={formData.box_price}
                        onChange={(e) => handleFormChange('box_price', e.target.value)}
                        placeholder="Enter box price"
                        required
                    />
                    <Input
                        label="PCS per Box"
                        type="number"
                        value={formData.pcs_per_box}
                        onChange={(e) => handleFormChange('pcs_per_box', e.target.value)}
                        placeholder="Enter pieces per box"
                        required
                    />
                    <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600">PCS Price (Auto-calculated):</p>
                        <p className="text-lg font-semibold text-gray-900">₹{pcsPrice.toFixed(2)}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleFormChange('description', e.target.value)}
                            placeholder="Enter product description (optional)"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
                    <Button onClick={handleEditProduct}>
                        Save Changes
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
