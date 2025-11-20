import React from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Button } from '../../components/tailadmin/Button';
import { Select } from '../../components/tailadmin/Select';
import { Input } from '../../components/tailadmin/Input';
import { Table } from '../../components/tailadmin/Table';

export const AssignStockPage: React.FC = () => {
    const columns = [
        { key: 'product', header: 'Product' },
        {
            key: 'assignBox',
            header: 'Assign in BOX',
            render: () => (
                <Input type="number" placeholder="0" className="max-w-24" />
            ),
        },
        {
            key: 'assignPcs',
            header: 'Assign in PCS',
            render: () => (
                <Input type="number" placeholder="0" className="max-w-24" />
            ),
        },
        { key: 'subtotal', header: 'Subtotal' },
    ];

    const data = [
        { product: 'Coca Cola 500ml', subtotal: '₹0' },
        { product: 'Pepsi 1L', subtotal: '₹0' },
        { product: 'Sprite 500ml', subtotal: '₹0' },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Assign Stock</h1>
                <p className="text-gray-600 mt-1">Assign stock to drivers and routes</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Selection Card */}
                    <Card>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select
                                label="Select Route"
                                options={[
                                    { value: '', label: 'Choose route' },
                                    { value: '1', label: 'Route 1 - North' },
                                    { value: '2', label: 'Route 2 - South' },
                                ]}
                            />
                            <Select
                                label="Select Driver"
                                options={[
                                    { value: '', label: 'Choose driver' },
                                    { value: '1', label: 'John Doe' },
                                    { value: '2', label: 'Jane Smith' },
                                ]}
                            />
                            <Input label="Date" type="date" />
                        </div>
                    </Card>

                    {/* Stock Assignment Table */}
                    <Card header={<h3 className="text-lg font-semibold text-gray-900">Stock Assignment</h3>}>
                        <Table columns={columns} data={data} />
                    </Card>

                    <div className="flex justify-end">
                        <Button variant="primary" size="lg">
                            Assign Stock
                        </Button>
                    </div>
                </div>

                {/* Summary Sidebar */}
                <div>
                    <Card header={<h3 className="text-lg font-semibold text-gray-900">Summary</h3>}>
                        <div className="space-y-4">
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Total Items:</span>
                                <span className="font-semibold text-gray-900">0</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Total Boxes:</span>
                                <span className="font-semibold text-gray-900">0</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-gray-600">Total PCS:</span>
                                <span className="font-semibold text-gray-900">0</span>
                            </div>
                            <div className="flex justify-between py-2 pt-2">
                                <span className="text-lg font-semibold text-gray-900">Total Value:</span>
                                <span className="text-lg font-bold text-primary">₹0</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
