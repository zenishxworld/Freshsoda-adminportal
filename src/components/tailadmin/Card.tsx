import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'sm' | 'md' | 'lg';
    header?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'md',
    header,
}) => {
    const paddingStyles = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div className={`bg-white rounded-lg shadow-card ${className}`}>
            {header && (
                <div className={`border-b border-gray-200 ${paddingStyles[padding]} pb-4`}>
                    {header}
                </div>
            )}
            <div className={paddingStyles[padding]}>{children}</div>
        </div>
    );
};
