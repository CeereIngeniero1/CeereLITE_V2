import { useState } from 'react';
import { useCompany } from '../auth/CompanyContext';

export default function EmpresaPage() {
  const {
    companies,
    documentoEmpresa,
    nombreComercialEmpresa,
    setEmpresa,
  } = useCompany();
  const [picked, setPicked] = useState(documentoEmpresa);
  const [ok, setOk] = useState('');

  function onSave(e) {
    e.preventDefault();
    const row = companies.find(
      (c) => String(c.documentoEmpresa ?? '').trim() === picked,
    );
    if (!row) return;
    setEmpresa(row);
    setOk('Empresa de trabajo actualizada.');
  }

  return (
    <div className="page">
      <p className="page-eyebrow">Sede</p>
      <h1>Empresa de trabajo</h1>
      <p className="muted">
        La sede activa filtra la agenda y se registra al crear citas y
        evoluciones.
      </p>

      {nombreComercialEmpresa ? (
        <p>
          Actual:{' '}
          <strong>
            {nombreComercialEmpresa}
            {documentoEmpresa ? ` · ${documentoEmpresa}` : ''}
          </strong>
        </p>
      ) : (
        <p className="muted">No hay empresa seleccionada.</p>
      )}

      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <form className="card form" onSubmit={onSave}>
        <label>
          Cambiar empresa
          <select
            value={picked}
            onChange={(e) => {
              setPicked(e.target.value);
              setOk('');
            }}
          >
            <option value="">— Selecciona —</option>
            {companies.map((c) => {
              const doc = String(c.documentoEmpresa ?? '').trim();
              return (
                <option key={doc} value={doc}>
                  {c.nombreComercialEmpresa || doc}
                </option>
              );
            })}
          </select>
        </label>
        <button type="submit" disabled={!picked || picked === documentoEmpresa}>
          Guardar
        </button>
      </form>
    </div>
  );
}
