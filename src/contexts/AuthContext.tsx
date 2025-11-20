import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type UserRole = 'admin' | 'driver' | null;

interface AuthContextType {
    user: User | null;
    role: UserRole;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Fetch user role from database
    const fetchUserRole = async (userId: string): Promise<UserRole> => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching user role:', error);
                return null;
            }

            return (data?.role as UserRole) || null;
        } catch (error) {
            console.error('Error fetching user role:', error);
            return null;
        }
    };

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    setUser(session.user);
                    const userRole = await fetchUserRole(session.user.id);
                    setRole(userRole);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    setUser(session.user);
                    const userRole = await fetchUserRole(session.user.id);
                    setRole(userRole);
                } else {
                    setUser(null);
                    setRole(null);
                }
                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Login function with role-based redirect
    const login = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                const userRole = await fetchUserRole(data.user.id);
                setUser(data.user);
                setRole(userRole);

                // Role-based redirect
                if (userRole === 'admin') {
                    navigate('/admin');
                } else if (userRole === 'driver') {
                    navigate('/driver/start-route');
                } else {
                    // Default fallback
                    navigate('/');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    // Logout function
    const logout = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
