import { useCallback, useEffect, useState } from 'react';
import {
  fetchRdaCatalog1888,
  fetchRdaCatalogFixed,
  fetchRdaClaves1888,
} from '../api/client';

const FIJOS = [
  { id: 'egreso-remision', label: 'Egreso y remisión' },
  { id: 'factor-riesgo', label: 'Factor de riesgo' },
  { id: 'tipo-tecnologia-salud', label: 'Tipo tecnología en salud' },
];

/** Misma lógica que la antigua página RDA; pensado para vivir dentro de Evolución (HC). */
export function RdaCatalogosPanel({
  namePrefix = 'rda',
  evaluacionId = null,
  /** Sin título propio: va dentro de un acordeón */
  hideTitle = false,
  /** Sin tarjeta anidada alrededor de la barra de herramientas */
  flatToolbar = false,
}) {
  const radioName = `${namePrefix}CatModo`;
  const [modo, setModo] = useState('fijo');
  const [fijoId, setFijoId] = useState('egreso-remision');
  const [clave1888, setClave1888] = useState('');
  const [claves1888, setClaves1888] = useState([]);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRdaClaves1888()
      .then((d) => {
        const arr = Array.isArray(d?.claves) ? d.claves : [];
        setClaves1888(arr);
        setClave1888((prev) => prev || arr[0] || '');
      })
      .catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let data;
      if (modo === 'fijo') {
        data = await fetchRdaCatalogFixed(fijoId, q.trim() || undefined);
      } else {
        if (!clave1888) {
          setRows([]);
          setLoading(false);
          return;
        }
        data = await fetchRdaCatalog1888(clave1888, q.trim() || undefined);
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          (typeof e.response?.data === 'object'
            ? JSON.stringify(e.response.data)
            : null) ??
          e.message ??
          'Error al consultar',
      );
    } finally {
      setLoading(false);
    }
  }, [modo, fijoId, clave1888, q]);

  useEffect(() => {
    void buscar();
     
  }, [modo, fijoId, clave1888]);

  return (
    <>
      {!hideTitle && (
        <h3 className="rda-panel-title">RDA — catálogos Res. 1888</h3>
      )}
      <p className="muted rda-panel-hint">
        Misma base que el Relacionador; úsalos junto con la nota clínica y, cuando
        exista registro guardado, con RIPS (
        {evaluacionId != null
          ? `evolución #${evaluacionId}).`
          : 'guardá la evolución para asociar RIPS).'}
      </p>

      <div
        className={
          flatToolbar
            ? 'rda-cat-toolbar rda-cat-toolbar--embed rda-cat-toolbar--flat'
            : 'card rda-cat-toolbar rda-cat-toolbar--embed'
        }
      >
        <div className="rda-cat-modo">
          <label className="rips-radio">
            <input
              type="radio"
              name={radioName}
              checked={modo === 'fijo'}
              onChange={() => setModo('fijo')}
            />
            Catálogo fijo
          </label>
          <label className="rips-radio">
            <input
              type="radio"
              name={radioName}
              checked={modo === '1888'}
              onChange={() => setModo('1888')}
            />
            Catálogo genérico 1888
          </label>
        </div>
        {modo === 'fijo' ? (
          <label>
            Lista
            <select
              value={fijoId}
              onChange={(e) => setFijoId(e.target.value)}
            >
              {FIJOS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Clave
            <select
              value={clave1888}
              onChange={(e) => setClave1888(e.target.value)}
            >
              {claves1888.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Buscar (opc.)
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Descripción o código"
          />
        </label>
        <button type="button" onClick={() => void buscar()} disabled={loading}>
          {loading ? 'Consultando…' : 'Consultar'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="rda-embed-table-wrap">
        <table className="rips-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>IdEstado</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading && (
              <tr>
                <td colSpan={3} className="td-empty">
                  Sin filas.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.Codigo}-${i}`}>
                <td className="td-mono">{String(r.Codigo ?? '')}</td>
                <td>{String(r.Descripcion ?? '')}</td>
                <td>{r.IdEstado ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
