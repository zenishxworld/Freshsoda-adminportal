import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Button } from '../../components/tailadmin/Button';
import { Input } from '../../components/tailadmin/Input';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile, updateUserProfile, type UserProfile } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('profile');
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<{ firstName: string; lastName: string; email: string; phone: string }>({ firstName: '', lastName: '', email: '', phone: '' });

    useEffect(() => {
        const load = async () => {
            if (!user?.id) return;
            setLoading(true);
            try {
                const p = await getUserProfile(user.id);
                const fullName = (p?.name || '').trim();
                const [firstName, ...rest] = fullName.split(' ');
                const lastName = rest.join(' ');
                setProfile({
                    firstName: firstName || '',
                    lastName: lastName || '',
                    email: p?.email || user.email || '',
                    phone: p?.phone || '',
                });
            } catch (e: unknown) {
                // Silent fail, keep defaults
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.id, user?.email]);

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'password', label: 'Change Password' },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-1">Manage your account and application settings</p>
            </div>

            {/* Tabs */}
            <Card>
                <div className="border-b border-gray-200">
                    <nav className="flex gap-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === 'profile' && (
                        <div className="space-y-6 max-w-2xl">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                                    <span className="text-white text-2xl font-bold">AD</span>
                                </div>
                                <div>
                                    <Button variant="primary" size="sm">
                                        Change Photo
                                    </Button>
                                    <p className="text-sm text-gray-500 mt-1">JPG, PNG. Max size 2MB</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="First Name" placeholder="Enter first name" value={profile.firstName} onChange={(e) => setProfile(p => ({ ...p, firstName: e.target.value }))} />
                                <Input label="Last Name" placeholder="Enter last name" value={profile.lastName} onChange={(e) => setProfile(p => ({ ...p, lastName: e.target.value }))} />
                            </div>

                            <Input
                                label="Email Address"
                                type="email"
                                placeholder="email"
                                value={profile.email}
                                onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                                disabled
                            />

                            <Input
                                label="Phone Number"
                                type="tel"
                                placeholder="Phone number"
                                value={profile.phone}
                                onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                            />

                            <div className="flex justify-end">
                                <Button variant="primary" onClick={async () => {
                                    if (!user?.id) return;
                                    setSaving(true);
                                    try {
                                        const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
                                        await updateUserProfile(user.id, { name, phone: profile.phone || null });
                                        toast({ title: 'Saved', description: 'Profile updated successfully' });
                                    } catch (e: unknown) {
                                        const msg = e instanceof Error ? e.message : 'Failed to save profile';
                                        toast({ title: 'Error', description: msg, variant: 'destructive' });
                                    } finally {
                                        setSaving(false);
                                    }
                                }} disabled={saving || loading}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'password' && (
                        <div className="space-y-6 max-w-2xl">
                            <Input label="Current Password" type="password" placeholder="Enter current password" />
                            <Input label="New Password" type="password" placeholder="Enter new password" />
                            <Input label="Confirm New Password" type="password" placeholder="Confirm new password" />

                            <div className="flex justify-end">
                                <Button variant="primary">Update Password</Button>
                            </div>
                        </div>
                    )}

                    
                </div>
            </Card>
        </div>
    );
};
