import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/tailadmin/Card';
import { Button } from '../../components/tailadmin/Button';
import { Modal } from '../../components/tailadmin/Modal';
import { Input } from '../../components/tailadmin/Input';
import { CustomDropdown } from '../../components/tailadmin/CustomDropdown';
import { Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllShops, createShop, updateShop, getActiveRoutes, syncMissingShops, type Shop, type RouteOption } from '@/lib/supabase';

export const ShopsPage: React.FC = () => {
    const { toast } = useToast();
    const [searchParams] = useSearchParams();
    const [shops, setShops] = useState<Shop[]>([]);
    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');
    const [villageFilter, setVillageFilter] = useState('');
    const [routeFilter, setRouteFilter] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editing, setEditing] = useState<Shop | null>(null);

    const [form, setForm] = useState({
        name: '',
        phone: '',
        village: '',
        address: '',
        route_id: '',
    });

    const villages = useMemo(() => {
        const set = new Set<string>();
        shops.forEach(s => { if (s.village) set.add(s.village); });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [shops]);

    const routeName = (id?: string | null) => routes.find(r => r.id === id)?.name || '';

    const load = async () => {
        setLoading(true);
        try {
            const [list, rs] = await Promise.all([
                getAllShops(search, villageFilter, routeFilter),
                getActiveRoutes(),
            ]);
            setShops(list);
            setRoutes(rs);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to load shops', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [search, villageFilter, routeFilter]);
    useEffect(() => {
        const q = searchParams.get('q') || '';
        if (q && q !== search) setSearch(q);
    }, [searchParams]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Shop Directory</h1>
                    <p className="text-gray-600 mt-1">Manage shops and customer information</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            setSyncing(true);
                            try {
                                const { total, fixed } = await syncMissingShops();
                                toast({ title: 'Sync Complete', description: `Scanned ${total} sales. Linked/Created ${fixed} shops.` });
                                load();
                            } catch (e: any) {
                                toast({ title: 'Sync Failed', description: e.message, variant: 'destructive' });
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        disabled={syncing}
                    >
                        <RefreshCw className={`w-5 h-5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync from Sales'}
                    </Button>
                    <Button variant="primary" onClick={() => { setForm({ name: '', phone: '', village: '', address: '', route_id: '' }); setIsAddOpen(true); }}>
                        <Plus className="w-5 h-5 mr-2" />
                        Add Shop
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input placeholder="Search (name/phone/village)" value={search} onChange={e => setSearch(e.target.value)} />
                    <CustomDropdown
                        options={[{ value: '', label: 'All Villages' }, ...villages.map(v => ({ value: v, label: v }))]}
                        value={villageFilter}
                        onChange={setVillageFilter}
                        placeholder="All Villages"
                    />
                    <CustomDropdown
                        options={[{ value: '', label: 'All Routes' }, ...routes.map(r => ({ value: r.id, label: r.name }))]}
                        value={routeFilter}
                        onChange={setRouteFilter}
                        placeholder="All Routes"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setSearch(''); setVillageFilter(''); setRouteFilter(''); toast({ title: 'Info', description: 'Showing all shops' }); }}>Show All</Button>
                        <Button variant="outline" onClick={() => { setVillageFilter(''); setRouteFilter(''); }}>Clear Filters</Button>
                    </div>
                </div>
            </Card>

            {/* Shops Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Village</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
                            ) : shops.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No shops found</td></tr>
                            ) : (
                                shops.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="w-5 h-5 bg-primary rounded mr-3" /><div className="text-sm font-medium text-gray-900">{s.name}</div></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.phone || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.village || s.address || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{routeName(s.route_id) || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Button variant="outline" onClick={() => { setEditing(s); setForm({ name: s.name || '', phone: s.phone || '', village: s.village || '', address: s.address || '', route_id: s.route_id || '' }); setIsEditOpen(true); }}>Edit</Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add Shop Modal */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title="Add New Shop"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsAddOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={async () => {
                            try {
                                if (!form.name.trim()) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return; }
                                const exists = (await getAllShops(form.name)).find(s => s.name.toLowerCase() === form.name.trim().toLowerCase());
                                if (exists) { toast({ title: 'Error', description: 'Duplicate shop name not allowed', variant: 'destructive' }); return; }
                                await createShop(form);
                                toast({ title: 'Success', description: 'Shop added successfully' });
                                setIsAddOpen(false);
                                setForm({ name: '', phone: '', village: '', address: '', route_id: '' });
                                load();
                            } catch (e: any) {
                                toast({ title: 'Failed', description: e.message || 'Error adding shop', variant: 'destructive' });
                            }
                        }}>Add Shop</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Shop Name" placeholder="Enter shop name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                    <Input label="Phone" placeholder="Enter phone number" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                    <Input label="Village" placeholder="Enter village" value={form.village} onChange={(e) => setForm(f => ({ ...f, village: e.target.value }))} />
                    <Input label="Address" placeholder="Enter address" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Route</label>
                        <CustomDropdown
                            options={[{ value: '', label: '-- Optional --' }, ...routes.map(r => ({ value: r.id, label: r.name }))]}
                            value={form.route_id}
                            onChange={(value) => setForm(f => ({ ...f, route_id: value }))}
                            placeholder="-- Optional --"
                        />
                    </div>
                </div>
            </Modal>

            {/* Edit Shop Modal */}
            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title="Edit Shop"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={async () => {
                            try {
                                if (!editing) return;
                                if (!form.name.trim()) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return; }
                                const dup = shops.find(s => s.id !== editing.id && s.name.toLowerCase() === form.name.trim().toLowerCase());
                                if (dup) { toast({ title: 'Error', description: 'Duplicate shop name not allowed', variant: 'destructive' }); return; }
                                await updateShop(editing.id, { name: form.name, phone: form.phone || null, village: form.village || null, address: form.address || null, route_id: form.route_id || null });
                                toast({ title: 'Success', description: 'Shop updated successfully' });
                                setIsEditOpen(false);
                                setEditing(null);
                                load();
                            } catch (e: any) {
                                toast({ title: 'Failed', description: e.message || 'Error updating shop', variant: 'destructive' });
                            }
                        }}>Save Changes</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Shop Name" placeholder="Enter shop name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                    <Input label="Phone" placeholder="Enter phone number" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                    <Input label="Village" placeholder="Enter village" value={form.village} onChange={(e) => setForm(f => ({ ...f, village: e.target.value }))} />
                    <Input label="Address" placeholder="Enter address" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Route</label>
                        <CustomDropdown
                            options={[{ value: '', label: '-- Optional --' }, ...routes.map(r => ({ value: r.id, label: r.name }))]}
                            value={form.route_id}
                            onChange={(value) => setForm(f => ({ ...f, route_id: value }))}
                            placeholder="-- Optional --"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};
