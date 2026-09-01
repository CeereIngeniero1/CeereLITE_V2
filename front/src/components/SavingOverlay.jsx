export function SavingOverlay({ show, label = 'Guardando…' }) {
  if (!show) return null;
  return (
    <div className="saving-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="saving-overlay-card">
        <span className="saving-spinner" aria-hidden />
        <p className="saving-overlay-label">{label}</p>
      </div>
    </div>
  );
}
