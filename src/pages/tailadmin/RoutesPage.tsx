import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Modal } from '../../components/tailadmin/Modal';
import { Input } from '../../components/tailadmin/Input';
import { Badge } from '../../components/tailadmin/Badge';
import { Plus, Edit, Trash2 } from 'lucide-react';

export const RoutesPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const columns = [
        { key: 'name', header: 'Route Name' },
        { key: 'area', header: 'Area/Region' },
        { key: 'totalShops', header: 'Total Shops' },
        {
            key: 'status',
            header: 'Status',
            render: (value: string) => (
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={value === 'active'} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: () => (
                <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                        <Edit className="w-4 h-4 text-primary" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-danger" />
                    </button>
                </div>
            ),
        },
    ];

    const data = [
        { name: 'Route 1 - North', area: 'North District', totalShops: 45, status: 'active' },
        { name: 'Route 2 - South', area: 'South District', totalShops: 38, status: 'active' },
        { name: 'Route 3 - East', area: 'East District', totalShops: 52, status: 'inactive' },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Routes Management</h1>
                    <p className="text-gray-600 mt-1">Manage delivery routes and areas</p>
                </div>
                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Route
                </Button>
            </div>

            {/* Routes Table */}
            <Card>
                <Table columns={columns} data={data} />
            </Card>

            {/* Add Route Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Route"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary">Add Route</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Route Name" placeholder="Enter route name" />
                    <Input label="Area/Region" placeholder="Enter area or region" />
                    <Input label="Description" placeholder="Enter description (optional)" />
                </div>
            </Modal>
        </div>
    );
};
