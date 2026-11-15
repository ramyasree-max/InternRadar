import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken, type UserProfile } from '../lib/api.ts';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  includeDemoData: boolean;
  setIncludeDemoData: (val: boolean) => void;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Record<string, any>) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeDemoData, setIncludeDemoData] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      setUser(data.user);
      if (data.user.isDemo) {
        setIncludeDemoData(true);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getStoredToken()) {
      refreshUser();
    } else {
      // Also check cookie session cleanly
      refreshUser();
    }
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    if (data.user.isDemo) setIncludeDemoData(true);
  };

  const register = async (payload: Record<string, any>) => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(data.token);
    setUser(data.user);
  };

  const loginAsDemo = async () => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/demo', {
      method: 'POST',
    });
    setStoredToken(data.token);
    setUser(data.user);
    setIncludeDemoData(true);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        includeDemoData,
        setIncludeDemoData,
        refreshUser,
        login,
        register,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
