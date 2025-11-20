import React from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Input } from '../../components/tailadmin/Input';
import { Select } from '../../components/tailadmin/Select';
import { DollarSign, TrendingUp, Edit, Trash2 } from 'lucide-react';

export const ExpensesPage: React.FC = () => {
    const columns = [
        { key: 'date', header: 'Date' },
        { key: 'category', header: 'Category' },
        { key: 'amount', header: 'Amount' },
        { key: 'remarks', header: 'Remarks' },
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
            date: '2025-11-20',
            category: 'Fuel',
            amount: '₹2,500',
            remarks: 'Truck fuel for Route 1',
        },
        {
            date: '2025-11-19',
            category: 'Maintenance',
            amount: '₹1,200',
            remarks: 'Vehicle servicing',
        },
        {
            date: '2025-11-18',
            category: 'Salary',
            amount: '₹15,000',
            remarks: 'Driver salary advance',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Expense Management</h1>
                <p className="text-gray-600 mt-1">Track and manage business expenses</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Daily Total</p>
                            <h3 className="text-2xl font-bold text-gray-900">₹2,500</h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-warning" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Monthly Total</p>
                            <h3 className="text-2xl font-bold text-gray-900">₹45,700</h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Add Expense Form */}
            <Card header={<h3 className="text-lg font-semibold text-gray-900">Add New Expense</h3>}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Select
                        label="Category"
                        options={[
                            { value: '', label: 'Select category' },
                            { value: 'fuel', label: 'Fuel' },
                            { value: 'maintenance', label: 'Maintenance' },
                            { value: 'salary', label: 'Salary' },
                            { value: 'other', label: 'Other' },
                        ]}
                    />
                    <Input label="Amount" type="number" placeholder="0" />
                    <Input label="Date" type="date" />
                    <div className="flex items-end">
                        <Button variant="primary" className="w-full">
                            Add Expense
                        </Button>
                    </div>
                </div>
                <div className="mt-4">
                    <Input label="Note/Remarks" placeholder="Enter remarks (optional)" />
                </div>
            </Card>

            {/* Expense Table */}
            <Card
                header={
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Expense History</h3>
                        <div className="flex gap-2">
                            <Input type="date" className="max-w-40" />
                            <span className="text-gray-500 self-center">to</span>
                            <Input type="date" className="max-w-40" />
                        </div>
                    </div>
                }
            >
                <Table columns={columns} data={data} />
            </Card>
        </div>
    );
};
