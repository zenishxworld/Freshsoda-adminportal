import React from 'react';
import { Menu, Search, Bell, User } from 'lucide-react';

interface HeaderProps {
    onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
    return (
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={onMenuToggle}
                        className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
                    >
                        <Menu className="w-6 h-6 text-gray-600" />
                    </button>

                    {/* Search Bar */}
                    <div className="hidden md:flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-md w-80">
                        <Search className="w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-full"
                        />
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-4">
                    {/* Notifications */}
                    <button className="relative p-2 rounded-md hover:bg-gray-100 transition-colors">
                        <Bell className="w-6 h-6 text-gray-600" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full"></span>
                    </button>

                    {/* User Profile */}
                    <div className="flex items-center gap-3 cursor-pointer">
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-gray-900">Admin User</p>
                            <p className="text-xs text-gray-500">Administrator</p>
                        </div>
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};
