import { Link } from 'react-router-dom';

export default function PlaceholderPage({ title, hint }) {
  return (
    <div className="page placeholder-page">
      <p className="page-eyebrow">Próximamente</p>
      <h1>{title}</h1>
      <div className="placeholder-card">
        <p className="muted">{hint}</p>
      </div>
      <p>
        <Link to="/principal/home" className="placeholder-back">
          ← Volver al inicio
        </Link>
      </p>
    </div>
  );
}
