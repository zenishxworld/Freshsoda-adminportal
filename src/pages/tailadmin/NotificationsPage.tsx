import React, { useState, useEffect } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Badge } from '../../components/tailadmin/Badge';
import { Bell, Check, Trash2, Filter, Loader2 } from 'lucide-react';
import { Button } from '../../components/tailadmin/Button';
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteNotification as deleteNotificationApi, deleteAllNotifications, type Notification } from '../../lib/supabase';
import { useToast } from '../../hooks/use-toast';

export const NotificationsPage: React.FC = () => {
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadNotifications = async () => {
        try {
            // setLoading(true); // Don't block UI on refresh if possible, or handle gracefully
            const data = await getNotifications();
            setNotifications(data);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to load notifications', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => n.unread)
        : notifications;

    const unreadCount = notifications.filter(n => n.unread).length;

    const markAsRead = async (id: number) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, unread: false } : n
            ));
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to mark as read', variant: 'destructive' });
        }
    };

    const markAllAsRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications(notifications.map(n => ({ ...n, unread: false })));
            toast({ title: 'Success', description: 'All notifications marked as read' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to mark all as read', variant: 'destructive' });
        }
    };

    const deleteNotification = async (id: number) => {
        try {
            await deleteNotificationApi(id);
            setNotifications(notifications.filter(n => n.id !== id));
            toast({ title: 'Success', description: 'Notification deleted' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete notification', variant: 'destructive' });
        }
    };

    const deleteAll = async () => {
        if (!window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
            return;
        }
        try {
            await deleteAllNotifications();
            setNotifications([]);
            toast({ title: 'Success', description: 'All notifications deleted' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete all notifications', variant: 'destructive' });
        }
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            onClick={markAllAsRead}
                            className="flex items-center gap-2 justify-center"
                        >
                            <Check className="w-4 h-4" />
                            Mark all as read
                        </Button>
                    )}
                    {notifications.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={deleteAll}
                            className="flex items-center gap-2 justify-center text-danger hover:bg-red-50 hover:border-red-300"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete all
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
                                        <p className="text-sm text-gray-500">{new Date(notification.created_at).toLocaleString()}</p>
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
