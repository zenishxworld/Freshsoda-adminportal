import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../../../components/tailadmin/Card';
import { Table } from '../../../components/tailadmin/Table';
import { Button } from '../../../components/tailadmin/Button';
import { Input } from '../../../components/tailadmin/Input';
import { DatePicker } from '../../../components/tailadmin/DatePicker';
import { RefreshCw, Download } from 'lucide-react';
import { buildSalesReport, exportCsv, type SalesReportRow } from '../../../lib/reports';

export const SalesReport: React.FC = () => {
  const [from, setFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [to, setTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<SalesReportRow[]>([]);

  const columns = useMemo(() => ([
    { key: 'date', header: 'Date' },
    { key: 'driver_name', header: 'Driver' },
    { key: 'route_name', header: 'Route' },
    { key: 'shop_name', header: 'Shop Name' },
    { key: 'id', header: 'Invoice ID' },
    { key: 'sold_summary', header: 'Sold', render: (_: any, r: any) => `${r.total_sold_boxes} BOX | ${r.total_sold_extra_pcs} PCS` },
    { key: 'returned_pcs', header: 'Returned (PCS)' },
    { key: 'amount', header: 'Amount' },
  ]), []);

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await buildSalesReport({ from, to });
      const formatted = data.map(r => ({
        ...r,
        date: r.date ? new Date(r.date).toLocaleString() : r.date,
      }));
      setRows(formatted);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => { setFrom(''); setTo(''); setRows([]); };

  const onExport = () => {
    const headers = ['Date', 'Driver', 'Route', 'Shop', 'InvoiceID', 'SoldPCS', 'ReturnedPCS', 'Amount'];
    const csv = exportCsv(headers, rows.map(r => ({
      Date: r.date,
      Driver: r.driver_name,
      Route: r.route_name,
      Shop: r.shop_name,
      InvoiceID: r.id,
      SoldPCS: r.total_sold_pcs,
      ReturnedPCS: r.returned_pcs,
      Amount: r.amount,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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

      <Card>
        <Table columns={columns} data={rows.map(r => ({ ...r, amount: r.amount.toFixed(2) }))} />
      </Card>
    </div>
  );
};
