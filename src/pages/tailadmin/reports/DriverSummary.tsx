import React, { useMemo, useState } from 'react';
import { Card } from '../../../components/tailadmin/Card';
import { Table } from '../../../components/tailadmin/Table';
import { Button } from '../../../components/tailadmin/Button';
import { Input } from '../../../components/tailadmin/Input';
import { RefreshCw, Download } from 'lucide-react';
import { buildDriverSummary, exportCsv, type DriverSummaryRow } from '../../../lib/reports';

export const DriverSummary: React.FC = () => {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<DriverSummaryRow[]>([]);

  const columns = useMemo(() => ([
    { key: 'driver_name', header: 'Driver' },
    { key: 'routes', header: 'Routes' },
    { key: 'assigned_pcs', header: 'Assigned (PCS)' },
    { key: 'sold_pcs', header: 'Sold (PCS)' },
    { key: 'returned_pcs', header: 'Returned (PCS)' },
    { key: 'revenue', header: 'Revenue' },
    { key: 'bills', header: 'Bills' },
  ]), []);

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await buildDriverSummary({ from, to });
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFrom(''); setTo(''); setRows([]); };

  const onExport = () => {
    const headers = ['Driver','Routes','AssignedPCS','SoldPCS','ReturnedPCS','Revenue','Bills'];
    const csv = exportCsv(headers, rows.map(r => ({
      Driver: r.driver_name,
      Routes: r.routes.join(' | '),
      AssignedPCS: r.assigned_pcs,
      SoldPCS: r.sold_pcs,
      ReturnedPCS: r.returned_pcs,
      Revenue: r.revenue,
      Bills: r.bills,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'driver_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const assigned = rows.reduce((s, r) => s + r.assigned_pcs, 0);
    const sold = rows.reduce((s, r) => s + r.sold_pcs, 0);
    const returned = rows.reduce((s, r) => s + r.returned_pcs, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const bills = rows.reduce((s, r) => s + r.bills, 0);
    return { assigned, sold, returned, revenue, bills };
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="From Date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To Date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
        <Table columns={columns} data={rows.map(r => ({...r, routes: r.routes.join(', ')}))} />
      </Card>
    </div>
  );
};

