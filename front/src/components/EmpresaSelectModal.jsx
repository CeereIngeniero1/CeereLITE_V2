import { useCompany } from '../auth/CompanyContext';

export function EmpresaSelectModal() {
  const { companies, setEmpresa, catalogError } = useCompany();

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
          {catalogError ? (
            <p className="alert alert-error">{catalogError}</p>
          ) : companies.length === 0 ? (
            <p className="alert alert-error">
              No hay empresas disponibles para este usuario.
            </p>
          ) : (
            <div className="empresa-select-list" role="listbox" aria-label="Empresas">
              {companies.map((c) => {
                const doc = String(c.documentoEmpresa ?? '').trim();
                return (
                  <button
                    key={doc}
                    type="button"
                    className="empresa-select-item"
                    onClick={() => setEmpresa(c)}
                  >
                    <span>{c.nombreComercialEmpresa || doc}</span>
                    <span className="muted td-mono">{doc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
