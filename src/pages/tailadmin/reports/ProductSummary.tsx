import React, { useMemo, useState } from 'react';
import { Card } from '../../../components/tailadmin/Card';
import { Table } from '../../../components/tailadmin/Table';
import { Button } from '../../../components/tailadmin/Button';
import { Input } from '../../../components/tailadmin/Input';
import { DatePicker } from '../../../components/tailadmin/DatePicker';
import { RefreshCw, Download } from 'lucide-react';
import { buildProductSummary, exportCsv, type ProductSummaryRow } from '../../../lib/reports';

export const ProductSummary: React.FC = () => {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<ProductSummaryRow[]>([]);

  const columns = useMemo(() => ([
    { key: 'product_name', header: 'Product' },
    { key: 'assigned_pcs', header: 'Assigned (PCS)' },
    { key: 'sold_pcs', header: 'Sold (PCS)' },
    { key: 'returned_pcs', header: 'Returned (PCS)' },
    { key: 'revenue', header: 'Revenue' },
    { key: 'avg_unit_price', header: 'Avg Unit Price' },
  ]), []);

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await buildProductSummary({ from, to });
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFrom(''); setTo(''); setRows([]); };

  const onExport = () => {
    const headers = ['Product', 'AssignedPCS', 'SoldPCS', 'ReturnedPCS', 'Revenue', 'AvgUnitPrice'];
    const csv = exportCsv(headers, rows.map(r => ({
      Product: r.product_name,
      AssignedPCS: r.assigned_pcs,
      SoldPCS: r.sold_pcs,
      ReturnedPCS: r.returned_pcs,
      Revenue: r.revenue,
      AvgUnitPrice: r.avg_unit_price,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const assigned = rows.reduce((s, r) => s + r.assigned_pcs, 0);
    const sold = rows.reduce((s, r) => s + r.sold_pcs, 0);
    const returned = rows.reduce((s, r) => s + r.returned_pcs, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    return { assigned, sold, returned, revenue };
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DatePicker label="From Date" value={from} onChange={setFrom} />
          <DatePicker label="To Date" value={to} onChange={setTo} />
          <div className="flex items-end gap-2">
            <Button variant="primary" onClick={load} disabled={!from || !to || loading}>{loading ? 'Loading...' : 'Filter'}</Button>
            <Button variant="outline" onClick={onExport} disabled={rows.length === 0}><Download className="w-4 h-4 mr-2" />Export</Button>
            <Button variant="secondary" onClick={reset}><RefreshCw className="w-4 h-4 mr-2" />Reset</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><p className="text-sm text-gray-600 mb-1">Total Assigned</p><h3 className="text-2xl font-bold text-gray-900">{totals.assigned}</h3></Card>
        <Card><p className="text-sm text-gray-600 mb-1">Total Sold</p><h3 className="text-2xl font-bold text-success">{totals.sold}</h3></Card>
        <Card><p className="text-sm text-gray-600 mb-1">Total Returned</p><h3 className="text-2xl font-bold text-danger">{totals.returned}</h3></Card>
        <Card><p className="text-sm text-gray-600 mb-1">Total Revenue</p><h3 className="text-2xl font-bold text-primary">{totals.revenue.toFixed(2)}</h3></Card>
      </div>

      <Card>
        <Table columns={columns} data={rows} />
      </Card>
    </div>
  );
};

