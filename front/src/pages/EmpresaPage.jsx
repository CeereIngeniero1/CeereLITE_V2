import { useState } from 'react';
import { useCompany } from '../auth/CompanyContext';

export default function EmpresaPage() {
  const {
    companies,
    documentoEmpresa,
    nombreComercialEmpresa,
    setEmpresa,
    catalogError,
  } = useCompany();
  const [ok, setOk] = useState('');

  function onPick(row) {
    setEmpresa(row);
    setOk('Empresa de trabajo actualizada.');
  }

  return (
    <div className="page">
      <p className="page-eyebrow">Sede</p>
      <h1>Empresa de trabajo</h1>
      <p className="muted">
        La sede activa filtra la agenda y se registra al crear citas y
        evoluciones. Clic en una fila para elegir.
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
      {catalogError ? <div className="alert alert-error">{catalogError}</div> : null}

      {catalogError ? null : companies.length === 0 ? (
        <p className="muted">No hay empresas en el catálogo.</p>
      ) : (
        <div className="card empresa-page-list">
          <div className="empresa-select-list" role="listbox" aria-label="Empresas">
            {companies.map((c) => {
              const doc = String(c.documentoEmpresa ?? '').trim();
              const selected = doc === documentoEmpresa;
              return (
                <button
                  key={doc}
                  type="button"
                  className={
                    selected
                      ? 'empresa-select-item is-selected'
                      : 'empresa-select-item'
                  }
                  onClick={() => onPick(c)}
                >
                  <span>{c.nombreComercialEmpresa || doc}</span>
                  <span className="muted td-mono">{doc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
