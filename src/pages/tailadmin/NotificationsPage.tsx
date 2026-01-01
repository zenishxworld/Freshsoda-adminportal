import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Badge } from '../../components/tailadmin/Badge';
import { Bell, Check, Trash2, Filter } from 'lucide-react';
import { Button } from '../../components/tailadmin/Button';

interface Notification {
    id: number;
    title: string;
    message: string;
    time: string;
    type: 'info' | 'warning' | 'success' | 'error';
    unread: boolean;
    category: string;
}

export const NotificationsPage: React.FC = () => {
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [notifications, setNotifications] = useState<Notification[]>([
        { id: 1, title: 'Low Stock Alert', message: 'Product A is running low on stock. Current: 50 pcs', time: '5 min ago', type: 'warning', unread: true, category: 'Stock' },
        { id: 2, title: 'New Assignment', message: 'Route 1 has been assigned to Driver A for today', time: '1 hour ago', type: 'info', unread: true, category: 'Assignment' },
        { id: 3, title: 'Sales Update', message: 'Today\'s sales have reached ₹45,678', time: '2 hours ago', type: 'success', unread: false, category: 'Sales' },
        { id: 4, title: 'Payment Received', message: 'Payment of ₹25,000 received from Shop XYZ', time: '3 hours ago', type: 'success', unread: false, category: 'Payment' },
        { id: 5, title: 'Route Completed', message: 'Driver B has completed Route 2', time: '4 hours ago', type: 'success', unread: false, category: 'Route' },
        { id: 6, title: 'Stock Added', message: '500 units of Product B added to warehouse', time: '5 hours ago', type: 'info', unread: false, category: 'Stock' },
        { id: 7, title: 'Critical Stock Alert', message: 'Product C is critically low. Only 10 pcs remaining', time: '6 hours ago', type: 'error', unread: true, category: 'Stock' },
        { id: 8, title: 'New Driver Added', message: 'Driver C has been added to the system', time: '1 day ago', type: 'info', unread: false, category: 'System' },
    ]);

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => n.unread)
        : notifications;

    const unreadCount = notifications.filter(n => n.unread).length;

    const markAsRead = (id: number) => {
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, unread: false } : n
        ));
    };

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, unread: false })));
    };

    const deleteNotification = (id: number) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'error': return 'bg-red-100 text-red-800 border-red-200';
            case 'success': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'warning': return '⚠️';
            case 'error': return '🚨';
            case 'success': return '✅';
            default: return 'ℹ️';
        }
    };

    return (
        <div className="space-y-6 bg-gray-50 min-h-screen p-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                    <p className="text-base text-gray-600 mt-1">
                        {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            onClick={markAllAsRead}
                            className="flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            Mark all as read
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <Card className="border-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Filter:</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'unread'
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Unread ({unreadCount})
                        </button>
                    </div>
                </div>
            </Card>

            {/* Notifications List */}
            <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                    <Card className="border-0">
                        <div className="py-12 text-center">
                            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">No notifications to show</p>
                        </div>
                    </Card>
                ) : (
                    filteredNotifications.map((notification) => (
                        <Card
                            key={notification.id}
                            className={`border-0 transition-all hover:shadow-md ${notification.unread ? 'bg-blue-50 border-l-4 border-l-primary' : ''
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${getTypeColor(notification.type)} border`}>
                                    {getTypeIcon(notification.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-lg">
                                                {notification.title}
                                            </h3>
                                            <Badge variant="secondary" className="mt-1">
                                                {notification.category}
                                            </Badge>
                                        </div>
                                        {notification.unread && (
                                            <span className="w-3 h-3 bg-primary rounded-full"></span>
                                        )}
                                    </div>
                                    <p className="text-gray-700 mb-3">{notification.message}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-500">{notification.time}</p>
                                        <div className="flex items-center gap-2">
                                            {notification.unread && (
                                                <button
                                                    onClick={() => markAsRead(notification.id)}
                                                    className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Mark as read
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteNotification(notification.id)}
                                                className="text-sm text-danger hover:text-red-700 font-medium flex items-center gap-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
