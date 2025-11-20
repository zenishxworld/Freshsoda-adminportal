import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/tailadmin/Input';
import { Button } from '../../components/tailadmin/Button';

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement actual authentication
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-body flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
                        <span className="text-white font-bold text-2xl">FS</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">FreshSoda Admin</h1>
                    <p className="text-gray-600 mt-2">Sign in to your account</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-lg shadow-card p-8">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <Input
                            label="Email Address"
                            type="email"
                            placeholder="admin@freshsoda.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <Input
                            label="Password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <div className="flex items-center justify-between">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                />
                                <span className="ml-2 text-sm text-gray-600">Remember me</span>
                            </label>
                            <a href="#" className="text-sm text-primary hover:text-primary-dark">
                                Forgot password?
                            </a>
                        </div>

                        <Button type="submit" variant="primary" className="w-full">
                            Sign In
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-600 mt-6">
                    © 2025 FreshSoda. All rights reserved.
                </p>
            </div>
        </div>
    );
};
