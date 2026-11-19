import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Selector de formatos HC con filtro por texto.
 * value = fileName o '' (texto libre).
 */
export function FormatoHcSearchSelect({
  formatos = [],
  value = '',
  disabled = false,
  onChange,
  emptyLabel = '— Texto libre (sin formato) —',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = value ? value : emptyLabel;

  useEffect(() => {
    if (!open) setQuery('');
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = String(query ?? '')
      .trim()
      .toLowerCase();
    const list = Array.isArray(formatos) ? formatos : [];
    if (!q) return list;
    return list.filter((f) =>
      String(f.fileName ?? '')
        .toLowerCase()
        .includes(q),
    );
  }, [formatos, query]);

  function pick(fileName) {
    onChange?.(fileName);
    setOpen(false);
    setQuery('');
  }

  if (disabled) {
    return (
      <div className="formato-hc-search formato-hc-search--disabled">
        <input
          type="text"
          className="formato-hc-search-input"
          value={selectedLabel}
          disabled
          readOnly
        />
      </div>
    );
  }

  return (
    <div className="formato-hc-search" ref={rootRef}>
      <div className="formato-hc-search-row">
        <input
          type="text"
          className="formato-hc-search-input"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="Escriba para buscar formato…"
          value={open ? query : selectedLabel}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = filtered[0];
              if (query.trim() === '' || query.trim() === emptyLabel) {
                pick('');
                return;
              }
              if (first) pick(first.fileName);
            }
          }}
        />
        <button
          type="button"
          className="formato-hc-search-toggle secondary"
          aria-label={open ? 'Cerrar lista' : 'Abrir lista'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▴' : '▾'}
        </button>
      </div>

      {open ? (
        <ul className="formato-hc-search-list" role="listbox">
          <li>
            <button
              type="button"
              role="option"
              className={!value ? 'active' : undefined}
              aria-selected={!value}
              onClick={() => pick('')}
            >
              {emptyLabel}
            </button>
          </li>
          {filtered.map((f) => (
            <li key={f.fileName}>
              <button
                type="button"
                role="option"
                className={value === f.fileName ? 'active' : undefined}
                aria-selected={value === f.fileName}
                onClick={() => pick(f.fileName)}
              >
                {f.fileName}
              </button>
            </li>
          ))}
          {!filtered.length ? (
            <li className="formato-hc-search-empty muted">
              Sin coincidencias para «{query}»
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
