import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Input } from '../../components/tailadmin/Input';
import { Download } from 'lucide-react';

export const ReportsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('daily');

    const tabs = [
        { id: 'daily', label: 'Daily Summary' },
        { id: 'route', label: 'Route Summary' },
        { id: 'driver', label: 'Driver Summary' },
        { id: 'product', label: 'Product Summary' },
        { id: 'sales', label: 'Sales Report' },
    ];

    const columns = [
        { key: 'date', header: 'Date' },
        { key: 'route', header: 'Route' },
        { key: 'driver', header: 'Driver' },
        { key: 'assigned', header: 'Assigned' },
        { key: 'sold', header: 'Sold' },
        { key: 'returned', header: 'Returned' },
        { key: 'revenue', header: 'Revenue' },
    ];

    const data = [
        {
            date: '2025-11-20',
            route: 'Route 1',
            driver: 'John Doe',
            assigned: '250',
            sold: '230',
            returned: '20',
            revenue: '₹23,000',
        },
        {
            date: '2025-11-20',
            route: 'Route 2',
            driver: 'Jane Smith',
            assigned: '180',
            sold: '175',
            returned: '5',
            revenue: '₹17,500',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
                <p className="text-gray-600 mt-1">View and analyze business reports</p>
            </div>

            {/* Tabs */}
            <Card>
                <div className="border-b border-gray-200">
                    <nav className="flex gap-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Filters */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input label="From Date" type="date" />
                    <Input label="To Date" type="date" />
                    <div className="flex items-end gap-2">
                        <Button variant="primary">Filter</Button>
                        <Button variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <p className="text-sm text-gray-600 mb-1">Total Assigned</p>
                    <h3 className="text-2xl font-bold text-gray-900">430</h3>
                </Card>
                <Card>
                    <p className="text-sm text-gray-600 mb-1">Total Sold</p>
                    <h3 className="text-2xl font-bold text-success">405</h3>
                </Card>
                <Card>
                    <p className="text-sm text-gray-600 mb-1">Total Returned</p>
                    <h3 className="text-2xl font-bold text-danger">25</h3>
                </Card>
                <Card>
                    <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                    <h3 className="text-2xl font-bold text-primary">₹40,500</h3>
                </Card>
            </div>

            {/* Report Table */}
            <Card>
                <Table columns={columns} data={data} />
            </Card>
        </div>
    );
};
