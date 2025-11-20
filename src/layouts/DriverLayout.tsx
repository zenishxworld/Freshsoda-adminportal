import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, User, Route } from 'lucide-react';

interface DriverLayoutProps {
    children: React.ReactNode;
}

export const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const user = null; // TODO: Get from auth context if needed

    const handleLogout = () => {
        try {
            localStorage.removeItem('lastLoginAt');
        } catch { }
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent-light/20">
            {/* Header */}
            <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-business-blue to-business-blue-dark rounded-lg sm:rounded-xl flex items-center justify-center">
                                <Route className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-base sm:text-xl font-bold text-foreground">Fresh Soda</h1>
                                <p className="text-xs sm:text-sm text-muted-foreground">Driver Dashboard</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="hidden sm:flex items-center gap-2 text-sm">
                                <User className="w-4 h-4" />
                                <span className="font-medium">{user?.email?.split('@')[0] || 'Driver'}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0">
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
                {children}
            </main>
        </div>
    );
};
