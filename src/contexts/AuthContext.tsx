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

    // Fetch user role from database and cache in metadata
    const fetchUserRole = async (authUser: User): Promise<UserRole> => {
        try {
            // First, check if role is cached in user metadata
            const cachedRole = authUser.user_metadata?.role;
            if (cachedRole && (cachedRole === 'admin' || cachedRole === 'driver')) {
                console.log('Using cached role from metadata:', cachedRole);
                return cachedRole as UserRole;
            }

            // Fetch from database
            const { data, error } = await supabase
                .from('users')
                .select('role, is_active')
                .eq('auth_user_id', authUser.id)
                .single();

            if (error) {
                console.error('Error fetching user role:', error);
                throw new Error('Failed to fetch user role');
            }

            if (!data) {
                throw new Error('User not found in database');
            }

            // Check if user is active
            if (!data.is_active) {
                throw new Error('Your account has been deactivated. Please contact an administrator.');
            }

            const userRole = data.role as UserRole;

            // Cache role in user metadata for faster subsequent loads
            try {
                await supabase.auth.updateUser({
                    data: { role: userRole }
                });
                console.log('Cached role in metadata:', userRole);
            } catch (metadataError) {
                console.warn('Failed to cache role in metadata:', metadataError);
                // Non-critical error, continue
            }

            return userRole;
        } catch (error: any) {
            console.error('Error in fetchUserRole:', error);
            throw error;
        }
    };

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            console.log('[AuthContext] Initializing auth...');
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('[AuthContext] Session error:', sessionError);
                    throw sessionError;
                }

                console.log('[AuthContext] Session:', session ? 'exists' : 'null');

                if (session?.user) {
                    console.log('[AuthContext] User found, fetching role...');
                    try {
                        const userRole = await fetchUserRole(session.user);

                        if (!userRole) {
                            throw new Error('Invalid user role');
                        }

                        console.log('[AuthContext] Role fetched successfully:', userRole);
                        setUser(session.user);
                        setRole(userRole);
                    } catch (roleError: any) {
                        console.error('[AuthContext] Role fetch error:', roleError);
                        console.error('[AuthContext] Error message:', roleError.message);
                        // Clear session if role fetch fails
                        await supabase.auth.signOut();
                        setUser(null);
                        setRole(null);
                    }
                } else {
                    console.log('[AuthContext] No user session');
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                setUser(null);
                setRole(null);
            } finally {
                console.log('[AuthContext] Setting loading to false');
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth state changed:', event);

                if (session?.user) {
                    try {
                        const userRole = await fetchUserRole(session.user);

                        if (!userRole) {
                            throw new Error('Invalid user role');
                        }

                        setUser(session.user);
                        setRole(userRole);
                    } catch (roleError: any) {
                        console.error('Role fetch error on auth change:', roleError);
                        setUser(null);
                        setRole(null);
                    }
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
            setLoading(true);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                const userRole = await fetchUserRole(data.user);

                if (!userRole) {
                    throw new Error('Invalid user role');
                }

                setUser(data.user);
                setRole(userRole);

                // Role-based redirect
                if (userRole === 'admin') {
                    navigate('/admin');
                } else if (userRole === 'driver') {
                    navigate('/driver/dashboard');
                } else {
                    throw new Error('Invalid user role');
                }
            }
        } catch (error: any) {
            console.error('Login error:', error);
            // Clear any partial state
            setUser(null);
            setRole(null);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Logout function with complete state clearing
    const logout = async () => {
        try {
            // Sign out from Supabase Auth
            await supabase.auth.signOut();

            // Clear all state
            setUser(null);
            setRole(null);

            // Clear any cached data
            localStorage.clear();
            sessionStorage.clear();

            // Redirect to login
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Logout error:', error);
            // Force clear state and redirect even on error
            setUser(null);
            setRole(null);
            navigate('/login', { replace: true });
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
