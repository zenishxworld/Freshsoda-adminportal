import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteAdminProps {
    children: React.ReactNode;
}

export const ProtectedRouteAdmin: React.FC<ProtectedRouteAdminProps> = ({ children }) => {
    return <>{children}</>;
};
