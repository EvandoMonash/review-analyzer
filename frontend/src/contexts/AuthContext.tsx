'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
}

interface AuthSession {
    access_token: string;
    refresh_token: string;
    user: User;
    expires_at?: number;
}

interface AuthContextType {
    user: User | null;
    session: AuthSession | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<boolean>;
    forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    resetPassword: (accessToken: string, refreshToken: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';
console.log('API_BASE_URL:', API_BASE_URL); // Debug log
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<AuthSession | null>(null);
    const [loading, setLoading] = useState(true);

    // Refs for session management
    const lastActivityRef = useRef<number>(Date.now());
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Update last activity time
    const updateActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    // Clear all timers
    const clearTimers = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
        if (sessionCheckTimerRef.current) {
            clearInterval(sessionCheckTimerRef.current);
            sessionCheckTimerRef.current = null;
        }
    }, []);

    // Auto logout function
    const autoLogout = useCallback(async (reason: string) => {
        console.log(`Auto logout triggered: ${reason}`);
        await logout();
    }, []);

    // Set up inactivity timer
    const setupInactivityTimer = useCallback(() => {
        clearTimers();

        const checkInactivity = () => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivityRef.current;

            if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
                autoLogout('inactivity timeout');
                return;
            }

            // Set up next check
            const timeUntilTimeout = INACTIVITY_TIMEOUT - timeSinceLastActivity;
            inactivityTimerRef.current = setTimeout(checkInactivity, timeUntilTimeout);
        };

        inactivityTimerRef.current = setTimeout(checkInactivity, INACTIVITY_TIMEOUT);
    }, [autoLogout, clearTimers]);

    // Login function
    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success && data.session) {
                const authSession: AuthSession = {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    user: {
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.user_metadata?.name || email.split('@')[0]
                    },
                    expires_at: data.session.expires_at
                };

                setSession(authSession);
                setUser(authSession.user);

                // Save to localStorage for persistence
                localStorage.setItem('auth_session', JSON.stringify(authSession));

                // Reset activity and start monitoring
                updateActivity();
                setupInactivityTimer();

                return { success: true };
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            return { success: false, error: 'Network error during login' };
        }
    };

    // Register function
    const register = async (email: string, password: string, name?: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            const data = await response.json();

            if (data.success) {
                // For development, auto-login after registration if session is provided
                if (data.session) {
                    const authSession: AuthSession = {
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                        user: {
                            id: data.user.id,
                            email: data.user.email,
                            name: data.user.user_metadata?.name || name || email.split('@')[0]
                        },
                        expires_at: data.session.expires_at
                    };

                    setSession(authSession);
                    setUser(authSession.user);
                    localStorage.setItem('auth_session', JSON.stringify(authSession));
                    updateActivity();
                    setupInactivityTimer();
                }

                return { success: true };
            } else {
                return { success: false, error: data.error || 'Registration failed' };
            }
        } catch (error) {
            return { success: false, error: 'Network error during registration' };
        }
    };

    // Refresh session function
    const refreshSession = async (): Promise<boolean> => {
        if (!session?.refresh_token) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: session.refresh_token })
            });

            const data = await response.json();

            if (data.success && data.session) {
                const newSession: AuthSession = {
                    ...session,
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token || session.refresh_token,
                    expires_at: data.session.expires_at
                };

                setSession(newSession);
                localStorage.setItem('auth_session', JSON.stringify(newSession));
                return true;
            }
        } catch (error) {
            console.error('Session refresh failed:', error);
        }

        return false;
    };

    // Forgot password function
    const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Failed to send reset email' };
            }
        } catch (error) {
            return { success: false, error: 'Network error during password reset' };
        }
    };

    // Reset password function
    const resetPassword = async (accessToken: string, refreshToken: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Failed to reset password' };
            }
        } catch (error) {
            return { success: false, error: 'Network error during password reset' };
        }
    };

    // Logout function
    const logout = async (): Promise<void> => {
        try {
            if (session?.access_token) {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
        } finally {
            // Clear local state regardless of API call success
            setUser(null);
            setSession(null);
            localStorage.removeItem('auth_session');
            clearTimers();
        }
    };

    // Initialize auth state from localStorage
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const savedSession = localStorage.getItem('auth_session');
                if (savedSession) {
                    const authSession: AuthSession = JSON.parse(savedSession);

                    // Check if session is expired
                    if (authSession.expires_at && Date.now() / 1000 > authSession.expires_at) {
                        // Try to refresh
                        const refreshed = await refreshSession();
                        if (!refreshed) {
                            localStorage.removeItem('auth_session');
                            return;
                        }
                    } else {
                        setSession(authSession);
                        setUser(authSession.user);
                        updateActivity();
                        setupInactivityTimer();
                    }
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                localStorage.removeItem('auth_session');
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Set up activity listeners
    useEffect(() => {
        if (!user) return;

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        events.forEach(event => {
            document.addEventListener(event, updateActivity, true);
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, updateActivity, true);
            });
        };
    }, [user, updateActivity]);

    // Set up tab close detection
    useEffect(() => {
        if (!user) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            // Log out when tab/browser is closing
            navigator.sendBeacon(`${API_BASE_URL}/auth/logout`, JSON.stringify({
                access_token: session?.access_token
            }));

            // Clear local storage
            localStorage.removeItem('auth_session');
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // Tab is being hidden/closed
                updateActivity();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, session]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimers();
        };
    }, [clearTimers]);

    const value: AuthContextType = {
        user,
        session,
        loading,
        login,
        register,
        logout,
        refreshSession,
        forgotPassword,
        resetPassword
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
} 