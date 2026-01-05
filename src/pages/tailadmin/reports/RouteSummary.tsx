import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/tailadmin/Card';
import { Table } from '../../../components/tailadmin/Table';
import { Button } from '../../../components/tailadmin/Button';
import { Input } from '../../../components/tailadmin/Input';
import { DatePicker } from '../../../components/tailadmin/DatePicker';
import { RefreshCw, Download } from 'lucide-react';
import { buildRouteSummary, exportCsv, type RouteSummaryRow } from '../../../lib/reports';
import { getActiveRoutes, type RouteOption } from '../../../lib/supabase';

export const RouteSummary: React.FC = () => {
  const [from, setFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [to, setTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<RouteSummaryRow[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeId, setRouteId] = useState<string>('');

  const columns = useMemo(() => ([
    { key: 'route_name', header: 'Route' },
    { key: 'assigned_summary', header: 'Assigned', render: (_: any, r: any) => `${r.assigned_boxes} BOX | ${r.assigned_extra_pcs} PCS` },
    { key: 'sold_summary', header: 'Sold', render: (_: any, r: any) => `${r.sold_boxes} BOX | ${r.sold_extra_pcs} PCS` },
    { key: 'returned_summary', header: 'Returned', render: (_: any, r: any) => `${r.returned_boxes} BOX | ${r.returned_extra_pcs} PCS` },
    { key: 'revenue', header: 'Revenue' },
    { key: 'unique_drivers', header: 'Drivers' },
    { key: 'invoices', header: 'Invoices' },
  ]), []);

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await buildRouteSummary({ from, to });
      const filtered = routeId ? data.filter(r => r.route_id === routeId) : data;
      setRows(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => { setFrom(''); setTo(''); setRouteId(''); setRows([]); };

  const onExport = () => {
    const headers = ['Route', 'AssignedPCS', 'SoldPCS', 'ReturnedPCS', 'Revenue', 'Drivers', 'Invoices'];
    const csv = exportCsv(headers, rows.map(r => ({
      Route: r.route_name,
      AssignedPCS: r.assigned_pcs,
      SoldPCS: r.sold_pcs,
      ReturnedPCS: r.returned_pcs,
      Revenue: r.revenue,
      Drivers: r.unique_drivers,
      Invoices: r.invoices,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'route_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const assigned = rows.reduce((s, r) => ({ boxes: s.boxes + r.assigned_boxes, pcs: s.pcs + r.assigned_extra_pcs }), { boxes: 0, pcs: 0 });
    const sold = rows.reduce((s, r) => ({ boxes: s.boxes + r.sold_boxes, pcs: s.pcs + r.sold_extra_pcs }), { boxes: 0, pcs: 0 });
    const returned = rows.reduce((s, r) => ({ boxes: s.boxes + r.returned_boxes, pcs: s.pcs + r.returned_extra_pcs }), { boxes: 0, pcs: 0 });
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const invoices = rows.reduce((s, r) => s + r.invoices, 0);
    return { assigned, sold, returned, revenue, invoices };
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <DatePicker label="From Date" value={from} onChange={setFrom} />
          <DatePicker label="To Date" value={to} onChange={setTo} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route</label>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
              <option value="">All Routes</option>
              {routes.map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          </div>
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
