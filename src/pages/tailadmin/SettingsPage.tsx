import React, { useState } from 'react';
import { Card } from '../../components/tailadmin/Card';
import { Button } from '../../components/tailadmin/Button';
import { Input } from '../../components/tailadmin/Input';

export const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('profile');

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'password', label: 'Change Password' },
        { id: 'config', label: 'App Configuration' },
        { id: 'billing', label: 'Billing Address' },
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
                                <Input label="First Name" placeholder="Enter first name" defaultValue="Admin" />
                                <Input label="Last Name" placeholder="Enter last name" defaultValue="User" />
                            </div>

                            <Input
                                label="Email Address"
                                type="email"
                                placeholder="admin@freshsoda.com"
                                defaultValue="admin@freshsoda.com"
                            />

                            <Input
                                label="Phone Number"
                                type="tel"
                                placeholder="+91 98765 43210"
                                defaultValue="+91 98765 43210"
                            />

                            <div className="flex justify-end">
                                <Button variant="primary">Save Changes</Button>
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

                    {activeTab === 'config' && (
                        <div className="space-y-6 max-w-2xl">
                            <Input label="Company Name" placeholder="FreshSoda Distributors" defaultValue="FreshSoda" />
                            <Input label="GST Number" placeholder="Enter GST number" />
                            <Input label="Currency" placeholder="INR" defaultValue="INR" />

                            <div className="flex justify-end">
                                <Button variant="primary">Save Configuration</Button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="space-y-6 max-w-2xl">
                            <Input label="Business Name" placeholder="Enter business name" />
                            <Input label="Address Line 1" placeholder="Enter address" />
                            <Input label="Address Line 2" placeholder="Enter address (optional)" />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input label="City" placeholder="Enter city" />
                                <Input label="State" placeholder="Enter state" />
                                <Input label="PIN Code" placeholder="Enter PIN code" />
                            </div>

                            <div className="flex justify-end">
                                <Button variant="primary">Save Billing Address</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
