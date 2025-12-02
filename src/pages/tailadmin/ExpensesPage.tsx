import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Table } from '../../components/tailadmin/Table';
import { Button } from '../../components/tailadmin/Button';
import { Input } from '../../components/tailadmin/Input';
import { Select } from '../../components/tailadmin/Select';
import { Modal } from '../../components/tailadmin/Modal';
import { Badge } from '../../components/tailadmin/Badge';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp, Edit, Trash2, PieChart, RefreshCw, Plus, Download } from 'lucide-react';
import { addExpense, deleteExpense, getExpenses, getExpenseSummary, updateExpense, getExpenseMovements, type Expense, type ExpenseMovement } from '@/lib/supabase';

const categories = ['Fuel', 'Food', 'Maintenance', 'Rent', 'Salary', 'Misc'];

export const ExpensesPage: React.FC = () => {
    const { toast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [summary, setSummary] = useState<{ today_total: number; month_total: number; month_by_category: Array<{ category: string; total: number }> }>({ today_total: 0, month_total: 0, month_by_category: [] });

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isLogsOpen, setIsLogsOpen] = useState(false);
    const [editing, setEditing] = useState<Expense | null>(null);
    const [form, setForm] = useState({ category: '', amount: '', date: '', note: '' });
    const [logs, setLogs] = useState<ExpenseMovement[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(expenses.length / pageSize)), [expenses.length]);
    const pagedExpenses = useMemo(() => {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return expenses.slice(start, end);
    }, [page, expenses]);

    const columns = [
        { key: 'date', header: 'Date' },
        { key: 'category', header: 'Category' },
        { key: 'amount', header: 'Amount' },
        { key: 'note', header: 'Note' },
        {
            key: 'actions',
            header: 'Actions',
            render: (row: Expense) => (
                <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" onClick={() => { setEditing(row); setForm({ category: row.category, amount: String(row.amount), date: row.date, note: row.note || '' }); setIsEditOpen(true); }}>
                        <Edit className="w-4 h-4 text-primary" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" onClick={() => { setEditing(row); setIsDeleteOpen(true); }}>
                        <Trash2 className="w-4 h-4 text-danger" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" onClick={async () => { setEditing(row); setIsLogsOpen(true); setLoadingLogs(true); try { const l = await getExpenseMovements(row.id, 100); setLogs(l); } catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Failed to load logs'; toast({ title: 'Error', description: msg, variant: 'destructive' }); setLogs([]); } finally { setLoadingLogs(false); } }}>
                        <PieChart className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>
            ),
        },
    ];

    const loadSummary = async () => {
        try {
            const s = await getExpenseSummary();
            setSummary(s);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to load summary', variant: 'destructive' });
        }
    };

    const loadExpenses = async () => {
        setLoading(true);
        try {
            const list = await getExpenses(dateFrom, dateTo, searchDebounced, category);
            setExpenses(list);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to load expenses', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSummary(); }, []);
    useEffect(() => { const t = setTimeout(() => setSearchDebounced(search), 300); return () => clearTimeout(t); }, [search]);
    useEffect(() => { loadExpenses(); setPage(1); }, [dateFrom, dateTo, category, searchDebounced]);

    const resetFilters = () => { setDateFrom(''); setDateTo(''); setCategory(''); setSearch(''); };

    const handleAdd = async () => {
        const amt = parseFloat(form.amount || '0');
        if (!form.category.trim()) { toast({ title: 'Error', description: 'Please select a valid category', variant: 'destructive' }); return; }
        if (!Number.isFinite(amt) || amt <= 0) { toast({ title: 'Error', description: 'Amount cannot be negative', variant: 'destructive' }); return; }
        if (!form.date.trim()) { toast({ title: 'Error', description: 'Please select a date', variant: 'destructive' }); return; }
        try {
            await addExpense({ category: form.category.trim(), amount: amt, date: form.date.trim(), note: form.note.trim() });
            toast({ title: 'Success', description: 'Expense added successfully' });
            setIsAddOpen(false);
            setForm({ category: '', amount: '', date: '', note: '' });
            loadExpenses();
            loadSummary();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to save expense, try again', variant: 'destructive' });
        }
    };

    const handleEdit = async () => {
        if (!editing) return;
        const amt = parseFloat(form.amount || '0');
        if (!form.category.trim()) { toast({ title: 'Error', description: 'Please select a valid category', variant: 'destructive' }); return; }
        if (!Number.isFinite(amt) || amt <= 0) { toast({ title: 'Error', description: 'Amount cannot be negative', variant: 'destructive' }); return; }
        if (!form.date.trim()) { toast({ title: 'Error', description: 'Please select a date', variant: 'destructive' }); return; }
        try {
            await updateExpense(editing.id, { category: form.category.trim(), amount: amt, date: form.date.trim(), note: form.note.trim() || null });
            toast({ title: 'Success', description: 'Expense updated successfully' });
            setIsEditOpen(false);
            setEditing(null);
            loadExpenses();
            loadSummary();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to save expense, try again', variant: 'destructive' });
        }
    };

    const handleDelete = async () => {
        if (!editing) return;
        try {
            await deleteExpense(editing.id);
            toast({ title: 'Deleted', description: 'Expense deleted successfully' });
            setIsDeleteOpen(false);
            setEditing(null);
            loadExpenses();
            loadSummary();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to delete expense', variant: 'destructive' });
        }
    };

    const exportCsv = () => {
        const rows = expenses.map(e => ({ Date: e.date, Category: e.category, Amount: e.amount, Note: e.note || '' }));
        const header = Object.keys(rows[0] || { Date: '', Category: '', Amount: '', Note: '' });
        const csv = [header.join(','), ...rows.map(r => header.map(h => String((r as any)[h]).replace(/"/g, '"')).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'expenses.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Expense Management</h1>
                    <p className="text-gray-600 mt-1">Track and manage business expenses</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { loadExpenses(); loadSummary(); }} className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</Button>
                    <Button variant="primary" onClick={() => { setIsAddOpen(true); setForm({ category: '', amount: '', date: new Date().toISOString().split('T')[0], note: '' }); }} className="flex items-center gap-2"><Plus className="w-4 h-4" />Add Expense</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Today’s Total</p>
                            <h3 className="text-2xl font-bold text-blue-600">₹{summary.today_total.toFixed(2)}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">This Month’s Total</p>
                            <h3 className="text-2xl font-bold text-green-600">₹{summary.month_total.toFixed(2)}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-2">Category Breakdown</p>
                            <div className="space-y-1">
                                {summary.month_by_category.slice(0, 6).map((c) => (
                                    <div key={c.category} className="flex items-center justify-between text-sm">
                                        <span>{c.category}</span>
                                        <Badge variant="warning">₹{c.total.toFixed(2)}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center">
                            <PieChart className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Input label="Date From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <Input label="Date To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    <Select label="Category" value={category} onChange={(e: any) => setCategory(e.target.value)} options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c, label: c }))]} />
                    <Input label="Search" placeholder="Search note/category" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="flex items-end gap-2">
                        <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                        <Button variant="secondary" onClick={exportCsv} className="flex items-center gap-2"><Download className="w-4 h-4" />Export CSV</Button>
                    </div>
                </div>
            </Card>

            <Card header={<div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Expenses</h3><span className="text-sm text-gray-500">{expenses.length} records</span></div>}>
                <Table columns={columns} data={pagedExpenses.map(e => ({ ...e, amount: `₹${e.amount.toFixed(2)}` }))} />

                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-700">Page {page} of {totalPages}</div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</Button>
                            <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
                        </div>
                    </div>
                )}
            </Card>

            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title="Add Expense"
                footer={<><Button variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleAdd}>Save</Button></>}
            >
                <div className="space-y-4">
                    <Select label="Category" value={form.category} onChange={(e: any) => setForm(f => ({ ...f, category: e.target.value }))} options={[{ value: '', label: 'Select category' }, ...categories.map(c => ({ value: c, label: c }))]} />
                    <Input label="Amount" type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
                    <Input label="Date" type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
                    <Input label="Note" placeholder="Enter note" value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>
            </Modal>

            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title="Edit Expense"
                footer={<><Button variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button><Button variant="primary" onClick={handleEdit}>Save</Button></>}
            >
                <div className="space-y-4">
                    <Select label="Category" value={form.category} onChange={(e: any) => setForm(f => ({ ...f, category: e.target.value }))} options={[{ value: '', label: 'Select category' }, ...categories.map(c => ({ value: c, label: c }))]} />
                    <Input label="Amount" type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
                    <Input label="Date" type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
                    <Input label="Note" placeholder="Enter note" value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>
            </Modal>

            <Modal
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                title="Delete Expense"
                footer={<><Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</Button><Button variant="danger" onClick={handleDelete}>Delete</Button></>}
            >
                <div className="space-y-2">
                    <p>Are you sure you want to delete this expense?</p>
                </div>
            </Modal>
            <Modal
                isOpen={isLogsOpen}
                onClose={() => { setIsLogsOpen(false); setLogs([]); }}
                title="Expense Logs"
                footer={<><Button variant="secondary" onClick={() => { setIsLogsOpen(false); setLogs([]); }}>Close</Button></>}
            >
                <div className="space-y-3">
                    {loadingLogs ? (
                        <div className="text-sm text-gray-600">Loading logs...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-sm text-gray-600">No logs available</div>
                    ) : (
                        <div className="max-h-80 overflow-y-auto border rounded">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Time</th>
                                        <th className="px-3 py-2 text-left">Action</th>
                                        <th className="px-3 py-2 text-left">Changes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-t">
                                            <td className="px-3 py-2">{new Date(log.created_at).toLocaleString()}</td>
                                            <td className="px-3 py-2">
                                                <Badge variant="warning">{log.action}</Badge>
                                            </td>
                                            <td className="px-3 py-2">
                                                <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(log.changes, null, 0)}</pre>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};
