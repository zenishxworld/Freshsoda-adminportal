import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Modal } from '../../components/tailadmin/Modal';
import { Input } from '../../components/tailadmin/Input';
import { Plus, Edit, Eye } from 'lucide-react';

export const ShopsPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const columns = [
        { key: 'name', header: 'Shop Name' },
        { key: 'phone', header: 'Phone' },
        { key: 'village', header: 'Village' },
        { key: 'totalBills', header: 'Total Bills' },
        { key: 'lastVisited', header: 'Last Visited' },
        {
            key: 'actions',
            header: 'Actions',
            render: () => (
                <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="View">
                        <Eye className="w-4 h-4 text-primary" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Edit">
                        <Edit className="w-4 h-4 text-primary" />
                    </button>
                </div>
            ),
        },
    ];

    const data = [
        {
            name: 'Raj General Store',
            phone: '+91 98765 43210',
            village: 'Rajpur',
            totalBills: 145,
            lastVisited: '2 days ago',
        },
        {
            name: 'Sharma Kirana',
            phone: '+91 98765 43211',
            village: 'Rampur',
            totalBills: 98,
            lastVisited: '1 day ago',
        },
        {
            name: 'Patel Store',
            phone: '+91 98765 43212',
            village: 'Laxmipur',
            totalBills: 203,
            lastVisited: 'Today',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Shop Directory</h1>
                    <p className="text-gray-600 mt-1">Manage shops and customer information</p>
                </div>
                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Shop
                </Button>
            </div>

            {/* Search Filters */}
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input placeholder="Search by shop name..." />
                    <Input placeholder="Search by village..." />
                    <Button variant="primary">Search</Button>
                </div>
            </Card>

            {/* Shops Table */}
            <Card>
                <Table columns={columns} data={data} />
            </Card>

            {/* Add Shop Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Shop"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary">Add Shop</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Shop Name" placeholder="Enter shop name" />
                    <Input label="Owner Name" placeholder="Enter owner name" />
                    <Input label="Phone Number" type="tel" placeholder="+91 98765 43210" />
                    <Input label="Village" placeholder="Enter village name" />
                    <Input label="Address" placeholder="Enter full address" />
                </div>
            </Modal>
        </div>
    );
};
