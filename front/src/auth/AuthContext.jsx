import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as api from '../api/client';
import { clearStoredEmpresa, clearStoredToken, getStoredToken, setStoredToken } from '../config';

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
      .catch((e) => {
        if (e.response?.status === 401) {
          clearStoredToken();
          clearStoredEmpresa();
          setUser(null);
        }
      })
      .finally(() => {
        setLoading(false);
        setHydrated(true);
      });
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    clearStoredEmpresa();
    setUser(null);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    clearStoredEmpresa();
    setStoredToken(data.token);
    try {
      const me = await api.fetchMe();
      setUser(me);
    } catch {
      setUser({
        username: data.username || username,
        userLevel: data.userLevel,
        documentoEntidad: data.documentoEntidad,
        nombreUsuario: data.nombreUsuario,
        primerNombre: '',
        segundoNombre: '',
        primerApellido: '',
        segundoApellido: '',
        email: '',
        telefono: '',
      });
    }
    return data;
  }, []);

  const applyUser = useCallback((me) => {
    setUser(me);
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
      applyUser,
      isAuthenticated: !!user,
    }),
    [user, loading, hydrated, login, logout, refreshMe, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth dentro de AuthProvider');
  return ctx;
}
