import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteAdminProps {
    children: React.ReactNode;
}

export const ProtectedRouteAdmin: React.FC<ProtectedRouteAdminProps> = ({ children }) => {
    const { role, loading } = useAuth();
    if (loading) return null;
    if (role !== 'admin') return <Navigate to="/login" replace />;
    return <>{children}</>;
};
