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

    // Enhanced styling for date inputs
    const isDateInput = type === 'date';
    const dateInputClasses = isDateInput
        ? 'cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:transition-opacity'
        : '';

    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}
            <input
                type={type}
                className={`w-full px-4 py-2.5 border-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-4 focus:border-transparent transition-all duration-200 shadow-sm ${error
                        ? 'border-danger focus:ring-danger/20 bg-red-50'
                        : isDateInput
                            ? 'border-primary/30 hover:border-primary/50 focus:border-primary focus:ring-primary/20 hover:shadow-md bg-gradient-to-r from-white to-primary/5'
                            : 'border-gray-300 hover:border-gray-400 focus:ring-primary/20 focus:border-primary hover:shadow-md'
                    } ${dateInputClasses} ${className}`}
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
