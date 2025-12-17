import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeStyles = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative bg-white sm:rounded-lg shadow-6 w-full h-full sm:h-auto ${sizeStyles[size]} sm:max-h-[90vh] flex flex-col`}
            >
                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>

                {/* Footer */}
                {footer && (
                    <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
