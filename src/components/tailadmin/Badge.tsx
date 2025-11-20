import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'warning' | 'danger' | 'primary' | 'secondary';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'primary',
    className = '',
}) => {
    const variantStyles = {
        success: 'bg-success-light text-success-dark',
        warning: 'bg-warning-light text-warning-dark',
        danger: 'bg-danger-light text-danger-dark',
        primary: 'bg-primary-light text-primary-dark',
        secondary: 'bg-gray-200 text-gray-700',
    };

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
        >
            {children}
        </span>
    );
};
