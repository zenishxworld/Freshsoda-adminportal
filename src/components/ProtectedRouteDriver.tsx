import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { UnauthorizedPage } from './UnauthorizedPage';
import { isWithinAuthGracePeriod } from '@/lib/utils';

interface ProtectedRouteDriverProps {
    children: React.ReactNode;
}

export const ProtectedRouteDriver: React.FC<ProtectedRouteDriverProps> = ({ children }) => {
    const { user, role, loading } = useAuth();

    // STEP 1: Show loading spinner while checking auth
    if (loading) {
        return <LoadingSpinner />;
    }

    // STEP 2: Redirect to login if not authenticated
    if (!user || !role) {
        const localRole = isWithinAuthGracePeriod() ? (localStorage.getItem('fs_role') as 'admin' | 'driver' | null) : null;
        if (localRole === 'driver') {
            return <>{children}</>;
        }
        return <Navigate to="/login" replace />;
    }

    // STEP 3: Redirect to admin portal if wrong role
    if (role === 'admin') {
        return <Navigate to="/admin" replace />;
    }

    // STEP 4: Block if role is invalid
    if (role !== 'driver') {
        return <UnauthorizedPage message="Invalid user role. Please contact support." />;
    }

    // STEP 5: Render children only if driver
    return <>{children}</>;
};
