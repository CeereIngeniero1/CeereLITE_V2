import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as api from '../api/client';
import { clearStoredToken, getStoredToken, setStoredToken } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setHydrated(true);
      return;
    }
    setLoading(true);
    api
      .fetchMe()
      .then((me) => setUser(me))
      .catch(() => clearStoredToken())
      .finally(() => {
        setLoading(false);
        setHydrated(true);
      });
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setStoredToken(data.token);
    setUser({
      username,
      userLevel: data.userLevel,
      documentoEntidad: data.documentoEntidad,
      nombreUsuario: data.nombreUsuario,
    });
    return data;
  }, []);

  const refreshMe = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.fetchMe();
      setUser(me);
      return me;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      hydrated,
      login,
      logout,
      refreshMe,
      isAuthenticated: !!user,
    }),
    [user, loading, hydrated, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth dentro de AuthProvider');
  return ctx;
}
