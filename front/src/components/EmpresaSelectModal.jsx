import { useState } from 'react';
import { useCompany } from '../auth/CompanyContext';

export function EmpresaSelectModal() {
  const { companies, setEmpresa } = useCompany();
  const [picked, setPicked] = useState('');

  function onConfirm() {
    const row = companies.find(
      (c) => String(c.documentoEmpresa ?? '').trim() === picked,
    );
    if (row) setEmpresa(row);
  }

  return (
    <div className="modal-backdrop empresa-select-backdrop" role="presentation">
      <div
        className="modal-dialog empresa-select-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="empresa-select-title"
      >
        <div className="modal-header">
          <h2 id="empresa-select-title">Empresa de trabajo</h2>
        </div>
        <div className="modal-body">
          <p className="muted">
            Elija la sede con la que va a trabajar. Esta selección filtra la
            agenda y se usa al guardar evoluciones.
          </p>
          {companies.length === 0 ? (
            <p className="alert alert-error">
              No hay empresas disponibles para este usuario.
            </p>
          ) : (
            <label>
              Empresa
              <select
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
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
          )}
          <div className="modal-actions">
            <button type="button" disabled={!picked} onClick={onConfirm}>
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
