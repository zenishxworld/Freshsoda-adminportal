import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
    label,
    error,
    options,
    className = '',
    ...props
}) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}
            <select
                className={`w-full px-4 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors bg-white ${error
                    ? 'border-danger focus:ring-danger'
                    : 'border-gray-300 hover:border-gray-400'
                    } ${className}`}
                {...props}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        </div>
    );
};
