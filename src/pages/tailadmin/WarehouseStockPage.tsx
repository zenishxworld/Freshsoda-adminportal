import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Modal } from '../../components/tailadmin/Modal';
import { Input } from '../../components/tailadmin/Input';
import { Badge } from '../../components/tailadmin/Badge';
import { Plus, Edit, Trash2 } from 'lucide-react';

export const WarehouseStockPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const columns = [
        { key: 'name', header: 'Product Name' },
        { key: 'boxPrice', header: 'Box Price' },
        { key: 'pcsPrice', header: 'PCS Price' },
        { key: 'totalBoxes', header: 'Total Boxes' },
        { key: 'totalPcs', header: 'Total PCS' },
        {
            key: 'status',
            header: 'Status',
            render: (value: string) => (
                <Badge variant={value === 'active' ? 'success' : 'secondary'}>
                    {value}
                </Badge>
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
        {
            name: 'Coca Cola 500ml',
            boxPrice: '₹480',
            pcsPrice: '₹20',
            totalBoxes: 150,
            totalPcs: 3600,
            status: 'active',
        },
        {
            name: 'Pepsi 1L',
            boxPrice: '₹720',
            pcsPrice: '₹40',
            totalBoxes: 80,
            totalPcs: 1920,
            status: 'active',
        },
        {
            name: 'Sprite 500ml',
            boxPrice: '₹480',
            pcsPrice: '₹20',
            totalBoxes: 45,
            totalPcs: 1080,
            status: 'active',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Warehouse Stock</h1>
                    <p className="text-gray-600 mt-1">Manage your inventory and stock levels</p>
                </div>
                <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Stock
                </Button>
            </div>

            {/* Stock Table */}
            <Card>
                <Table columns={columns} data={data} />
            </Card>

            {/* Add Stock Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Stock"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary">Add Stock</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Product Name" placeholder="Enter product name" />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Box Price" type="number" placeholder="0" />
                        <Input label="PCS Price" type="number" placeholder="0" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Total Boxes" type="number" placeholder="0" />
                        <Input label="Total PCS" type="number" placeholder="0" />
                    </div>
                </div>
            </Modal>
        </div>
    );
};
