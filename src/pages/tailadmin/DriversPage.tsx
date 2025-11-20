import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Modal } from '../../components/tailadmin/Modal';
import { Input } from '../../components/tailadmin/Input';
import { Select } from '../../components/tailadmin/Select';
import { Plus, Edit, Key, Trash2 } from 'lucide-react';

export const DriversPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const columns = [
        { key: 'name', header: 'Name' },
        { key: 'phone', header: 'Phone' },
        { key: 'route', header: 'Assigned Route' },
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
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Edit">
                        <Edit className="w-4 h-4 text-primary" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Reset Password">
                        <Key className="w-4 h-4 text-warning" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4 text-danger" />
                    </button>
                </div>
            ),
        },
    ];

    const data = [
        { name: 'John Doe', phone: '+91 98765 43210', route: 'Route 1 - North', status: 'active' },
        { name: 'Jane Smith', phone: '+91 98765 43211', route: 'Route 2 - South', status: 'active' },
        { name: 'Mike Johnson', phone: '+91 98765 43212', route: 'Route 3 - East', status: 'inactive' },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Driver Management</h1>
                    <p className="text-gray-600 mt-1">Manage drivers and their assignments</p>
                </div>
                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Driver
                </Button>
            </div>

            {/* Drivers Table */}
            <Card>
                <Table columns={columns} data={data} />
            </Card>

            {/* Add Driver Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Driver"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary">Add Driver</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Driver Name" placeholder="Enter driver name" />
                    <Input label="Phone Number" type="tel" placeholder="+91 98765 43210" />
                    <Input label="Email" type="email" placeholder="driver@example.com" />
                    <Select
                        label="Assign Route"
                        options={[
                            { value: '', label: 'Select route' },
                            { value: '1', label: 'Route 1 - North' },
                            { value: '2', label: 'Route 2 - South' },
                        ]}
                    />
                    <Input label="Password" type="password" placeholder="Enter password" />
                </div>
            </Modal>
        </div>
    );
};
