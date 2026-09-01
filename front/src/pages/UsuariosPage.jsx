import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchUsers } from '../api/client';
import { PatientEditModal } from '../components/PatientEditModal';

/**
 * Misma fuente de datos que CeereLite: GET /api/infousuarios → aquí GET /api/v1/users
 */
export default function UsuariosPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openMenu, setOpenMenu] = useState(null);
  const [editPatient, setEditPatient] = useState(null);

  const load = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    setError('');
    try {
      const data = await fetchUsers();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'No se pudieron cargar los usuarios',
      );
      setRows([]);
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.name ?? '').toLowerCase();
      const id = (r.id ?? '').toLowerCase();
      const id2 = (r.id2 ?? '').toLowerCase();
      const email = (r.email ?? '').toLowerCase();
      const tipo = (r.tipoentidad ?? '').toLowerCase();
      return (
        name.includes(q) ||
        id.includes(q) ||
        id2.includes(q) ||
        email.includes(q) ||
        tipo.includes(q)
      );
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageClamped = Math.min(page, totalPages);
  const slice = useMemo(() => {
    const start = (pageClamped - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, pageClamped, perPage]);

  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

  function goEvolucion(documentoPaciente) {
    navigate('/principal/evolucion', {
      state: { documentoPaciente },
    });
  }

  function openEdit(row) {
    setOpenMenu(null);
    setEditPatient({
      documento: row.id,
      nombre: row.name ?? '',
    });
  }

  function closeEdit() {
    setEditPatient(null);
  }

  async function handlePatientSaved(opts = {}) {
    if (!opts.photoOnly) closeEdit();
    await load({ silent: true });
  }

  return (
    <div className="page usuarios-page">
      <header className="usuarios-header">
        <div>
          <p className="page-eyebrow">Directorio</p>
          <h1>Usuarios (pacientes)</h1>
          <p className="muted">
            Listado desde la base — misma consulta que el sistema anterior.
          </p>
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={() =>
            window.alert(
              'El registro completo de paciente (formulario y catálogos) se migrará en un siguiente paso.',
            )
          }
        >
          + Registrar paciente
        </button>
      </header>

      {error && <div className="alert alert-error">{String(error)}</div>}

      <div className="usuarios-toolbar">
        <input
          type="search"
          className="usuarios-search"
          placeholder="Buscar por nombre, documento, correo o tipo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filtrar usuarios"
        />
        <label className="muted usuarios-perpage">
          Filas por página
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <p className="muted usuarios-count">
        {loading
          ? 'Cargando…'
          : `Mostrando ${slice.length} de ${filtered.length} · Total en base: ${rows.length}`}
      </p>

      <div className="table-wrap">
        <table className="usuarios-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Edad</th>
              <th>Tipo</th>
              <th>Correo</th>
              <th>Estado</th>
              <th className="th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!loading && slice.length === 0 && (
              <tr>
                <td colSpan={8} className="td-empty">
                  No hay pacientes para mostrar.
                </td>
              </tr>
            )}
            {slice.map((r) => {
              const key = `${r.id2}-${r.id}`;
              return (
                <tr key={key}>
                  <td>
                    <img
                      className="usuarios-avatar"
                      src={r.avatar}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                    />
                  </td>
                  <td className="td-strong">{r.name}</td>
                  <td>
                    <span className="td-mono">{r.id2 || r.id}</span>
                    {r.id2 && r.id && r.id2 !== r.id && (
                      <span className="muted td-sub"> ({r.id})</span>
                    )}
                  </td>
                  <td>{r.age ?? '—'}</td>
                  <td>{r.tipoentidad}</td>
                  <td className="td-email">{r.email ?? '—'}</td>
                  <td>{r.status}</td>
                  <td className="td-actions">
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() =>
                          setOpenMenu(openMenu === key ? null : key)
                        }
                        aria-expanded={openMenu === key}
                      >
                        ⋮
                      </button>
                      {openMenu === key && (
                        <div className="actions-menu" role="menu">
                          <button
                            type="button"
                            className="actions-menu-item"
                            onClick={() => openEdit(r)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="actions-menu-item"
                            onClick={() => {
                              setOpenMenu(null);
                              goEvolucion(r.id);
                            }}
                          >
                            Evolucionar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="usuarios-pagination">
        <button
          type="button"
          className="btn-outline"
          disabled={pageClamped <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </button>
        <span className="muted">
          Página {pageClamped} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-outline"
          disabled={pageClamped >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Siguiente
        </button>
      </div>

      <p className="muted">
        <Link to="/principal/home">← Inicio</Link>
      </p>

      {editPatient && (
        <PatientEditModal
          documentoPaciente={editPatient.documento}
          nombrePaciente={editPatient.nombre}
          onClose={closeEdit}
          onSaved={(opts) => void handlePatientSaved(opts)}
        />
      )}
    </div>
  );
}
