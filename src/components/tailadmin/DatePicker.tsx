import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
    label,
    value,
    onChange,
    placeholder = 'Select date',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    // Close calendar when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        return { daysInMonth, startingDayOfWeek, year, month };
    };

    const handleDateClick = (day: number) => {
        const { year, month } = getDaysInMonth(currentMonth);
        // Format date as YYYY-MM-DD without timezone conversion
        const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(formattedDate);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Parse selected date without timezone conversion
    let selectedDate = null;
    let selectedDay = null;
    let selectedMonth = null;
    let selectedYear = null;

    if (value) {
        const parts = value.split('-');
        selectedYear = parseInt(parts[0]);
        selectedMonth = parseInt(parts[1]) - 1; // Month is 0-indexed
        selectedDay = parseInt(parts[2]);
        selectedDate = new Date(selectedYear, selectedMonth, selectedDay);
    }

    const isSelectedMonth = selectedDate && selectedMonth === month && selectedYear === year;

    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}

            {/* Input Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 bg-white rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group"
            >
                <span className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                    {value ? formatDate(value) : placeholder}
                </span>
                <CalendarIcon className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
            </button>

            {/* Calendar Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border-0 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 w-80">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <h3 className="text-sm font-semibold text-gray-900">{monthName}</h3>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="p-4">
                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* Empty cells for days before month starts */}
                            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                                <div key={`empty-${index}`} className="aspect-square" />
                            ))}

                            {/* Days of the month */}
                            {Array.from({ length: daysInMonth }).map((_, index) => {
                                const day = index + 1;
                                const isSelected = isSelectedMonth && selectedDay === day;
                                const isToday = isCurrentMonth && today.getDate() === day;

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => handleDateClick(day)}
                                        className={`aspect-square rounded-lg text-sm font-medium transition-all duration-150 ${isSelected
                                            ? 'bg-primary text-white shadow-md scale-105'
                                            : isToday
                                                ? 'bg-primary/10 text-primary font-bold'
                                                : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
                        <button
                            type="button"
                            onClick={() => {
                                const now = new Date();
                                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                onChange(today);
                                setIsOpen(false);
                            }}
                            className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
