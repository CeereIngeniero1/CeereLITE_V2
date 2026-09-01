export function BrandLockup({
  mark = false,
  white = false,
  subtitle,
  meta,
  onMetaClick,
  size = 'md',
}) {
  const src = mark
    ? white
      ? '/logo-mark-white.png'
      : '/logo-mark.png'
    : white
      ? '/logo-ceere-white.png'
      : '/logo-ceere.png';

  return (
    <div
      className={`brand-lockup brand-lockup-${size}${mark ? ' brand-lockup-mark' : ''}${white ? ' brand-lockup-white' : ''}`}
    >
      <img
        className="brand-logo-img"
        src={src}
        alt="ceere"
      />
      {subtitle || meta ? (
        <div className="brand-lockup-copy">
          {subtitle ? <span className="brand-subtitle">{subtitle}</span> : null}
          {meta ? (
            onMetaClick ? (
              <button
                type="button"
                className="brand-meta brand-meta-btn"
                title="Consultar / editar perfil"
                onClick={onMetaClick}
              >
                {meta}
              </button>
            ) : (
              <span className="brand-meta">{meta}</span>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
