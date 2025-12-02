import React, { useState, useEffect } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Modal } from '../../components/tailadmin/Modal';
import { Input } from '../../components/tailadmin/Input';
import { Badge } from '../../components/tailadmin/Badge';
import { Plus, Edit, Loader2, Trash2 } from 'lucide-react';
import { getAllRoutes, createRoute, updateRoute, deactivateRoute, type Route } from '../../lib/supabase';
import { useToast } from '../../hooks/use-toast';

export const RoutesPage: React.FC = () => {
    const { toast } = useToast();
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoute, setEditingRoute] = useState<Route | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);


    // Load routes on mount
    useEffect(() => {
        loadRoutes();
    }, []);

    const loadRoutes = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAllRoutes();
            setRoutes(data);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to load routes. Please try again.';
            setError(errorMessage);
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingRoute(null);
        setFormData({ name: '', description: '' });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (route: Route) => {
        setEditingRoute(route);
        setFormData({
            name: route.name,
            description: route.description || '',
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRoute(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Route name is required',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            if (editingRoute) {
                // Update existing route
                await updateRoute(editingRoute.id, {
                    name: formData.name,
                    description: formData.description || null,
                });
                toast({
                    title: 'Success',
                    description: `Route "${formData.name}" updated successfully`,
                });
            } else {
                // Create new route
                await createRoute({
                    name: formData.name,
                    description: formData.description || undefined,
                });
                toast({
                    title: 'Success',
                    description: `Route "${formData.name}" created successfully`,
                });
            }
            handleCloseModal();
            loadRoutes();
        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message || 'Failed to save route',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };



    const handleDeleteRoute = async (route: Route) => {
        if (!window.confirm(`Are you sure you want to delete "${route.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deactivateRoute(route.id);

            // Reload routes to reflect the change
            await loadRoutes();

            toast({
                title: 'Success',
                description: 'Route deleted successfully',
            });
        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message || 'Failed to delete route',
                variant: 'destructive',
            });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const columns = [
        {
            key: 'name',
            header: 'Route Name',
            render: (value: string) => (
                <span className="font-medium text-gray-900">{value}</span>
            ),
        },
        {
            key: 'description',
            header: 'Description',
            render: (value: string | null) => (
                <span className="text-gray-600" title={value || ''}>
                    {value ? (value.length > 50 ? `${value.substring(0, 50)}...` : value) : '-'}
                </span>
            ),
        },

        {
            key: 'created_at',
            header: 'Created',
            render: (value: string) => (
                <span className="text-sm text-gray-500">{formatDate(value)}</span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (_: any, row: Route) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleOpenEditModal(row)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Edit route"
                    >
                        <Edit className="w-4 h-4 text-primary" />
                    </button>
                    <button
                        onClick={() => handleDeleteRoute(row)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        title="Delete route"
                    >
                        <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Routes Management</h1>
                    <p className="text-gray-600 mt-1">Manage delivery routes and areas</p>
                </div>
                <Button variant="primary" onClick={handleOpenAddModal} disabled={loading}>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Route
                </Button>
            </div>



            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                    <p className="font-medium">Error loading routes</p>
                    <p className="text-sm">{error}</p>
                    <Button variant="secondary" size="sm" onClick={loadRoutes} className="mt-2">
                        Try Again
                    </Button>
                </div>
            )}

            {/* Routes Table */}
            <Card>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="ml-3 text-gray-600">Loading routes...</span>
                    </div>
                ) : routes.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No routes found</p>
                        <p className="text-gray-400 text-sm mt-1">
                            Click "Add Route" to create your first route
                        </p>
                    </div>
                ) : (
                    <Table columns={columns} data={routes} />
                )}
            </Card>

            {/* Add/Edit Route Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingRoute ? 'Edit Route' : 'Add New Route'}
                footer={
                    <>
                        <Button variant="secondary" onClick={handleCloseModal} disabled={saving}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : editingRoute ? (
                                'Update Route'
                            ) : (
                                'Add Route'
                            )}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Route Name"
                        placeholder="Enter route name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                    <Input
                        label="Description"
                        placeholder="Enter description (optional)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>
            </Modal>
        </div>
    );
};
