import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    TruckIcon,
    Route,
    Users,
    Store,
    Receipt,
    FileText,
    Settings,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

interface MenuItem {
    path: string;
    label: string;
    icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/warehouse', label: 'Warehouse Stock', icon: <Package className="w-5 h-5" /> },
    { path: '/assign-stock', label: 'Assign Stock', icon: <TruckIcon className="w-5 h-5" /> },
    { path: '/routes', label: 'Routes', icon: <Route className="w-5 h-5" /> },
    { path: '/drivers', label: 'Drivers', icon: <Users className="w-5 h-5" /> },
    { path: '/shops', label: 'Shops', icon: <Store className="w-5 h-5" /> },
    { path: '/expenses', label: 'Expenses', icon: <Receipt className="w-5 h-5" /> },
    { path: '/reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> },
    { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
    const location = useLocation();

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={onToggle}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 h-screen bg-sidebar transition-all duration-300 ${isOpen ? 'w-64' : 'w-0 lg:w-20'
                    } overflow-hidden`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-light">
                        <div className={`flex items-center gap-3 ${!isOpen && 'lg:hidden'}`}>
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">FS</span>
                            </div>
                            <span className="text-white font-semibold text-lg">FreshSoda</span>
                        </div>
                        <button
                            onClick={onToggle}
                            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-md hover:bg-sidebar-light text-white transition-colors"
                        >
                            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-6 overflow-y-auto">
                        <ul className="space-y-1">
                            {menuItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <li key={item.path}>
                                        <Link
                                            to={item.path}
                                            className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors group ${isActive
                                                    ? 'bg-primary text-white'
                                                    : 'text-gray-300 hover:bg-sidebar-light hover:text-white'
                                                }`}
                                            title={!isOpen ? item.label : ''}
                                        >
                                            <span className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}>
                                                {item.icon}
                                            </span>
                                            <span className={`text-sm font-medium ${!isOpen && 'lg:hidden'}`}>
                                                {item.label}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* Footer */}
                    <div className={`p-4 border-t border-sidebar-light ${!isOpen && 'lg:hidden'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">AD</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-white text-sm font-medium">Admin User</p>
                                <p className="text-gray-400 text-xs">admin@freshsoda.com</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};
