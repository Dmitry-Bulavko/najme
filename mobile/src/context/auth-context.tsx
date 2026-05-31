import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authStore } from '@/lib/auth-store';

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authStore.isAuthenticated().then((auth) => {
      setIsAuthenticated(auth);
      setIsLoading(false);
    });
  }, []);

  async function signIn(token: string) {
    await authStore.setToken(token);
    setIsAuthenticated(true);
  }

  async function signOut() {
    await authStore.clearToken();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
