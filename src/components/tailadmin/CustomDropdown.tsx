import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
    value: string;
    label: string;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    disabled = false,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Dropdown Trigger */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-2.5 text-sm font-medium text-left bg-white border-2 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-between ${disabled
                        ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                        : isOpen
                            ? 'border-primary ring-4 ring-primary/20 shadow-md'
                            : 'border-gray-200 hover:border-primary/50 hover:shadow-md cursor-pointer'
                    } ${value ? 'text-gray-900' : 'text-gray-500'}`}
            >
                <span className="truncate">{selectedOption?.label || placeholder}</span>
                <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${isOpen ? 'transform rotate-180' : ''
                        }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto">
                        {options.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                                No options available
                            </div>
                        ) : (
                            options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-150 flex items-center justify-between group ${value === option.value
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'text-gray-900 hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 hover:text-primary'
                                        }`}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <div className={`w-1.5 h-1.5 rounded-full transition-colors flex-shrink-0 ${value === option.value
                                                ? 'bg-primary'
                                                : 'bg-gray-300 group-hover:bg-primary/50'
                                            }`}></div>
                                        {option.label}
                                    </span>
                                    {value === option.value && (
                                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
