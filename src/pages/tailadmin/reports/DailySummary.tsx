import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../../../components/tailadmin/Card';
import { Table } from '../../../components/tailadmin/Table';
import { Button } from '../../../components/tailadmin/Button';
import { Input } from '../../../components/tailadmin/Input';
import { Badge } from '../../../components/tailadmin/Badge';
import { DatePicker } from '../../../components/tailadmin/DatePicker';
import { RefreshCw, Download } from 'lucide-react';
import { buildDailySummary, exportCsv, type DailySummaryRow } from '../../../lib/reports';

export const DailySummary: React.FC = () => {
  const [from, setFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [to, setTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<DailySummaryRow[]>([]);



  const columns = useMemo(() => ([
    { key: 'date', header: 'Date' },
    { key: 'route_name', header: 'Route' },
    { key: 'driver_name', header: 'Driver' },
    { key: 'assigned_summary', header: 'Assigned', render: (_: any, r: any) => `${r.assigned_boxes} BOX | ${r.assigned_extra_pcs} PCS` },
    { key: 'sold_summary', header: 'Sold', render: (_: any, r: any) => `${r.sold_boxes} BOX | ${r.sold_extra_pcs} PCS` },
    { key: 'returned_summary', header: 'Returned', render: (_: any, r: any) => `${r.returned_boxes} BOX | ${r.returned_extra_pcs} PCS` },
    { key: 'revenue', header: 'Revenue' },
  ]), []);

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await buildDailySummary({ from, to });
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => { setFrom(''); setTo(''); setRows([]); };

  const onExport = () => {
    const headers = ['Date', 'Route', 'Driver', 'AssignedPCS', 'SoldPCS', 'ReturnedPCS', 'Revenue'];
    const csv = exportCsv(headers, rows.map(r => ({
      Date: r.date,
      Route: r.route_name,
      Driver: r.driver_name,
      AssignedPCS: r.assigned_pcs,
      SoldPCS: r.sold_pcs,
      ReturnedPCS: r.returned_pcs,
      Revenue: r.revenue,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daily_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const assigned = rows.reduce((s, r) => ({ boxes: s.boxes + r.assigned_boxes, pcs: s.pcs + r.assigned_extra_pcs }), { boxes: 0, pcs: 0 });
    const sold = rows.reduce((s, r) => ({ boxes: s.boxes + r.sold_boxes, pcs: s.pcs + r.sold_extra_pcs }), { boxes: 0, pcs: 0 });
    const returned = rows.reduce((s, r) => ({ boxes: s.boxes + r.returned_boxes, pcs: s.pcs + r.returned_extra_pcs }), { boxes: 0, pcs: 0 });
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
        <Card><p className="text-sm text-gray-600 mb-1">Total Assigned</p><h3 className="text-2xl font-bold text-gray-900">{totals.assigned.boxes} BOX | {totals.assigned.pcs} PCS</h3></Card>
        <Card><p className="text-sm text-gray-600 mb-1">Total Sold</p><h3 className="text-2xl font-bold text-success">{totals.sold.boxes} BOX | {totals.sold.pcs} PCS</h3></Card>
        <Card><p className="text-sm text-gray-600 mb-1">Total Returned</p><h3 className="text-2xl font-bold text-danger">{totals.returned.boxes} BOX | {totals.returned.pcs} PCS</h3></Card>
        <Card><p className="text-sm text-gray-600 mb-1">Total Revenue</p><h3 className="text-2xl font-bold text-primary">{totals.revenue.toFixed(2)}</h3></Card>
      </div>

      <Card>
        <Table columns={columns} data={rows} />
      </Card>
    </div>
  );
};

