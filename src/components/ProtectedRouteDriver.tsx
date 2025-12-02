import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteDriverProps {
    children: React.ReactNode;
}

export const ProtectedRouteDriver: React.FC<ProtectedRouteDriverProps> = ({ children }) => {
    return <>{children}</>;
};
