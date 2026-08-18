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

  const login = async (account, password) => {
    const authenticatedUser = await api.auth.login(account, password);
    setUser(authenticatedUser);
    return authenticatedUser;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    const updatedUser = await api.auth.changePassword(currentPassword, newPassword);
    setUser(updatedUser);
    return updatedUser;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      login,
      loginAdmin: login,
      logout,
      logoutAdmin: logout,
      changePassword,
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
