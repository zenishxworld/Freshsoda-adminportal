import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteDriverProps {
    children: React.ReactNode;
}

export const ProtectedRouteDriver: React.FC<ProtectedRouteDriverProps> = ({ children }) => {
    // TEMPORARY: Authentication disabled for testing
    return <>{children}</>;

    /*
    const { user, role, loading } = useAuth();

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Redirect to admin portal if user is an admin
    if (role === 'admin') {
        return <Navigate to="/admin" replace />;
    }

    // Redirect to login if role is not set or invalid
    if (role !== 'driver') {
        return <Navigate to="/login" replace />;
    }

    // User is authenticated and is a driver
    return <>{children}</>;
    */
};
