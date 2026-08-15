import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoadingAuth(false));
  }, []);

  const loginAdmin = async (account, password) => {
    try {
      const admin = await api.auth.login(account, password);
      setUser(admin);
      return true;
    } catch {
      return false;
    }
  };

  const logoutAdmin = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      loginAdmin,
      logoutAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
