import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasPermission as sharedHasPermission } from '@smartstock/shared';
import type { Permission, Role, User } from '../types';
import {
  authService,
  clearSession,
  getAccessToken,
  readStoredUser,
  setSession,
} from '../services/api';
import { queryClient } from '../lib/queryClient';
import { getErrorStatus } from '../lib/errors';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<User | null>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    getAccessToken() ? readStoredUser() : null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(getAccessToken()));

  const persistUser = useCallback((next: User | null) => {
    setUser(next);
    if (next) localStorage.setItem('user', JSON.stringify(next));
    else localStorage.removeItem('user');
  }, []);

  const reloadUser = useCallback(async (): Promise<User | null> => {
    if (!getAccessToken()) {
      persistUser(null);
      return null;
    }
    try {
      const me = await authService.me();
      persistUser(me);
      return me;
    } catch (error) {
      if (getErrorStatus(error) === 401 || getErrorStatus(error) === 403) {
        clearSession();
        persistUser(null);
      }
      return null;
    }
  }, [persistUser]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!getAccessToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authService.me();
        if (!cancelled) {
          persistUser(me);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          if (getErrorStatus(error) === 401 || getErrorStatus(error) === 403) {
            clearSession();
            persistUser(null);
          }
          setIsLoading(false);
        }
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [persistUser]);

  useEffect(() => {
    const onExpired = () => {
      clearSession();
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const session = await authService.login(email, password);
      setSession(session);
      setUser(session.user);
      queryClient.clear();
      return session.user;
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch {
      // The session may already be revoked; local cleanup still has to happen.
    } finally {
      clearSession();
      setUser(null);
      queryClient.clear();
    }
  }, []);

  const hasPermission = useCallback(
    (permission: Permission): boolean => (user ? sharedHasPermission(user.role, permission) : false),
    [user],
  );

  const hasRole = useCallback(
    (roles: Role[]): boolean => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      reloadUser,
      hasPermission,
      hasRole,
    }),
    [user, isLoading, login, logout, reloadUser, hasPermission, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
