import React from 'react';

interface Column {
    key: string;
    header: string;
    render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
    columns: Column[];
    data: any[];
    className?: string;
}

export const Table: React.FC<TableProps> = ({ columns, data, className = '' }) => {
    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                className="px-6 py-4 text-left text-sm font-semibold text-gray-700"
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-6 py-8 text-center text-gray-500"
                            >
                                No data available
                            </td>
                        </tr>
                    ) : (
                        data.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                {columns.map((column) => (
                                    <td key={column.key} className="px-6 py-4 text-sm text-gray-900">
                                        {column.render
                                            ? column.render(row[column.key], row)
                                            : row[column.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
