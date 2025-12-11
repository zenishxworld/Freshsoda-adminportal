import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './tailadmin/Button';

interface UnauthorizedPageProps {
    message?: string;
}

export const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({
    message = "You don't have permission to access this page"
}) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-body p-4">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-danger-light rounded-full mb-6">
                    <svg
                        className="w-10 h-10 text-danger"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>
                <p className="text-gray-600 mb-8">{message}</p>
                <Button
                    variant="primary"
                    onClick={() => navigate('/login', { replace: true })}
                >
                    Go to Login
                </Button>
            </div>
        </div>
    );
};
