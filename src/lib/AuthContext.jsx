import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(null);
  const [user, setUser] = useState(null);

  const setAuthUser = (nextUser) => {
    setUser(nextUser ?? null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingAuth(true);
      try {
        const me = await base44.auth.me();
        if (!cancelled) setAuthUser(me);
      } finally {
        if (!cancelled) setIsLoadingAuth(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAuthenticated = !!user;

  const logout = () => {
    base44.auth.logout();
    setAuthUser(null);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin();
  };

  const checkAppState = () => {};

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    appPublicSettings: {},
    setAuthUser,
    logout,
    navigateToLogin,
    checkAppState,
  }), [user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

