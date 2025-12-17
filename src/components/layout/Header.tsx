import React from 'react';
import { Menu, Bell, User } from 'lucide-react';

interface HeaderProps {
    onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
    return (
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
                {/* Left Section */}
                <div className="flex items-center gap-2">
                    {/* Mobile Menu Toggle - Larger touch target */}
                    <button
                        onClick={onMenuToggle}
                        className="lg:hidden p-2.5 rounded-md hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Toggle menu"
                    >
                        <Menu className="w-6 h-6 text-gray-600" />
                    </button>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Notifications */}
                    <button
                        className="relative p-2.5 rounded-md hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full"></span>
                    </button>

                    {/* User Profile */}
                    <div className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                        <div className="hidden md:block text-right">
                            <p className="text-sm font-medium text-gray-900">Admin User</p>
                            <p className="text-xs text-gray-500">Administrator</p>
                        </div>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};
