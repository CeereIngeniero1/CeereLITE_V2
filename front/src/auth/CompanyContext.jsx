import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchCompanies } from '../api/client';
import {
  clearStoredEmpresa,
  getStoredEmpresa,
  setStoredEmpresa,
} from '../config';
import { useAuth } from './AuthContext';

const CompanyContext = createContext(null);

function normalizeEmpresa(row) {
  const documentoEmpresa = String(row?.documentoEmpresa ?? '').trim();
  if (!documentoEmpresa) return null;
  return {
    documentoEmpresa,
    nombreComercialEmpresa: String(row?.nombreComercialEmpresa ?? '').trim(),
  };
}

export function CompanyProvider({ children }) {
  const { isAuthenticated, hydrated } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [empresa, setEmpresaState] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return undefined;
    if (!isAuthenticated) {
      setCompanies([]);
      setEmpresaState(null);
      setReady(true);
      return undefined;
    }

    let cancel = false;
    setReady(false);
    (async () => {
      try {
        const rows = await fetchCompanies();
        const list = Array.isArray(rows) ? rows : [];
        if (cancel) return;
        setCompanies(list);
        const stored = getStoredEmpresa();
        const match = stored
          ? list.find(
              (c) =>
                String(c.documentoEmpresa ?? '').trim() ===
                stored.documentoEmpresa,
            )
          : null;
        if (match) {
          const next = normalizeEmpresa(match);
          setEmpresaState(next);
          if (next) setStoredEmpresa(next);
        } else if (list.length === 1) {
          const next = normalizeEmpresa(list[0]);
          setEmpresaState(next);
          if (next) setStoredEmpresa(next);
        } else {
          setEmpresaState(null);
        }
      } catch {
        if (!cancel) {
          setCompanies([]);
          setEmpresaState(null);
        }
      } finally {
        if (!cancel) setReady(true);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [hydrated, isAuthenticated]);

  const setEmpresa = useCallback((row) => {
    const next = normalizeEmpresa(row);
    if (!next) {
      clearStoredEmpresa();
      setEmpresaState(null);
      return;
    }
    setStoredEmpresa(next);
    setEmpresaState(next);
  }, []);

  const documentoEmpresa = empresa?.documentoEmpresa ?? '';
  const needsPick = isAuthenticated && ready && !documentoEmpresa;

  const value = useMemo(
    () => ({
      companies,
      documentoEmpresa,
      nombreComercialEmpresa: empresa?.nombreComercialEmpresa ?? '',
      setEmpresa,
      ready,
      needsPick,
    }),
    [companies, documentoEmpresa, empresa, setEmpresa, ready, needsPick],
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany dentro de CompanyProvider');
  return ctx;
}
