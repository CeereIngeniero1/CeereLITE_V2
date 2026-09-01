import { useId, useState } from 'react';

/** Módulo plegable estilo panel de HC (cabecera + cuerpo). */
export function HcAccordionSection({
  title,
  subtitle,
  icon,
  headerExtra,
  defaultOpen = true,
  onOpenChange,
  children,
  className = '',
}) {
  const uid = useId().replace(/:/g, '');
  const headId = `hc-acc-h-${uid}`;
  const panelId = `hc-acc-p-${uid}`;
  const [open, setOpen] = useState(defaultOpen);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      onOpenChange?.(next);
      return next;
    });
  }

  return (
    <section
      className={`hc-module ${open ? 'hc-module--open' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        id={headId}
        className="hc-module-head"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="hc-module-head-main">
          {icon != null && icon !== '' && (
            <span className="hc-module-icon" aria-hidden>
              {icon}
            </span>
          )}
          <span className="hc-module-titles">
            <span className="hc-module-title">{title}</span>
            {subtitle ? (
              <span className="hc-module-subtitle">{subtitle}</span>
            ) : null}
          </span>
        </span>
        {headerExtra ? (
          <span className="hc-module-head-extra">{headerExtra}</span>
        ) : null}
        <span className="hc-module-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headId}
        className="hc-module-body"
        hidden={!open}
      >
        {children}
      </div>
    </section>
  );
}
