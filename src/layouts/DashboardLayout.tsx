import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    // Start with sidebar closed for better mobile experience
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className="min-h-screen bg-body">
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

            {/* Main Content */}
            <div
                className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
                    }`}
            >
                {/* Header */}
                <Header onMenuToggle={toggleSidebar} />

                {/* Page Content */}
                <main className="p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
};
