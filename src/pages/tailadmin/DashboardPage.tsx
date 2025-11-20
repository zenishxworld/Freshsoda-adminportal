import React from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Package, TruckIcon, DollarSign, Archive } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    change?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, change }) => {
    return (
        <Card className="hover:shadow-2 transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                    {change && (
                        <p className="text-sm text-success mt-1">
                            <span className="font-medium">{change}</span> from yesterday
                        </p>
                    )}
                </div>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${color}`}>
                    {icon}
                </div>
            </div>
        </Card>
    );
};

export const DashboardPage: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Warehouse Stock"
                    value="12,458"
                    icon={<Package className="w-7 h-7 text-white" />}
                    color="bg-primary"
                    change="+5.2%"
                />
                <StatCard
                    title="Today's Assigned Stock"
                    value="3,245"
                    icon={<TruckIcon className="w-7 h-7 text-white" />}
                    color="bg-success"
                    change="+12.5%"
                />
                <StatCard
                    title="Today's Sales"
                    value="₹45,678"
                    icon={<DollarSign className="w-7 h-7 text-white" />}
                    color="bg-warning"
                    change="+8.1%"
                />
                <StatCard
                    title="Remaining Stock"
                    value="9,213"
                    icon={<Archive className="w-7 h-7 text-white" />}
                    color="bg-danger"
                />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card header={<h3 className="text-lg font-semibold text-gray-900">Recent Stock Assignments</h3>}>
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                <div>
                                    <p className="font-medium text-gray-900">Route {item}</p>
                                    <p className="text-sm text-gray-600">Driver: John Doe</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-gray-900">250 units</p>
                                    <p className="text-sm text-gray-600">2 hours ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card header={<h3 className="text-lg font-semibold text-gray-900">Low Stock Alert</h3>}>
                    <div className="space-y-4">
                        {[
                            { name: 'Coca Cola 500ml', stock: 45 },
                            { name: 'Pepsi 1L', stock: 32 },
                            { name: 'Sprite 500ml', stock: 28 },
                            { name: 'Fanta 500ml', stock: 15 },
                        ].map((product, index) => (
                            <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                <div>
                                    <p className="font-medium text-gray-900">{product.name}</p>
                                    <p className="text-sm text-danger">Low stock warning</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-danger">{product.stock} units</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};
