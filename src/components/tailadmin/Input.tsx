import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    className = '',
    type,
    ...props
}) => {
    // Prevent scroll wheel from changing number inputs
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
        if (type === 'number') {
            e.currentTarget.blur();
        }
    };

    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}
            <input
                type={type}
                className={`w-full px-4 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${error
                    ? 'border-danger focus:ring-danger'
                    : 'border-gray-300 hover:border-gray-400'
                    } ${className}`}
                onWheel={handleWheel}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-danger">{error}</p>}
            {helperText && !error && (
                <p className="mt-1 text-sm text-gray-500">{helperText}</p>
            )}
        </div>
    );
};
