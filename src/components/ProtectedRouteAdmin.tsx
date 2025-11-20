import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteAdminProps {
    children: React.ReactNode;
}

export const ProtectedRouteAdmin: React.FC<ProtectedRouteAdminProps> = ({ children }) => {
    // TEMPORARY: Authentication disabled for testing
    return <>{children}</>;

    /*
    const { user, role, loading } = useAuth();

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-body">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Redirect to driver portal if user is a driver
    if (role === 'driver') {
        return <Navigate to="/driver/start-route" replace />;
    }

    // Redirect to login if role is not set or invalid
    if (role !== 'admin') {
        return <Navigate to="/login" replace />;
    }

    // User is authenticated and is an admin
    return <>{children}</>;
    */
};
