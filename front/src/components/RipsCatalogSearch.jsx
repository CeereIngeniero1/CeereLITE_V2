import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Combobox CUPS/CIE: muestra ~10 al abrir; búsqueda por código o nombre (mín. 2 caracteres).
 * La lista se renderiza en document.body para no recortarse por overflow del acordeón.
 */
export function RipsCatalogSearch({
  label,
  value,
  onChange,
  onSearch,
  optional = false,
  disabled = false,
}) {
  const listId = useId();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [listPos, setListPos] = useState(null);

  const updateListPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const preferred = 420;
    const minVisible = 260;
    const below = window.innerHeight - r.bottom - gap;
    const above = r.top - gap;

    let top;
    let maxHeight;

    if (below >= minVisible || below >= above) {
      top = r.bottom + gap;
      maxHeight = Math.min(preferred, Math.max(minVisible, below));
    } else {
      maxHeight = Math.min(preferred, Math.max(minVisible, above));
      top = Math.max(gap, r.top - gap - maxHeight);
    }

    setListPos({
      top,
      left: r.left,
      width: r.width,
      maxHeight,
    });
  }, []);

  const runSearch = useCallback(
    async (q) => {
      setLoading(true);
      try {
        const rows = await onSearch(q);
        setOptions(Array.isArray(rows) ? rows : []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [onSearch],
  );

  useEffect(() => {
    if (!value) {
      setDisplayText('');
      return;
    }
    let cancel = false;
    (async () => {
      const rows = await onSearch(value);
      if (cancel) return;
      const hit = (Array.isArray(rows) ? rows : []).find(
        (r) => String(r.codigo) === String(value),
      );
      if (hit) {
        setDisplayText(`${hit.codigo} - ${hit.nombre}`);
      } else {
        setDisplayText(String(value));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [value, onSearch]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void runSearch(query.trim());
    }, query.trim().length >= 2 ? 280 : 0);
    return () => clearTimeout(t);
  }, [open, query, runSearch]);

  useEffect(() => {
    if (!open) {
      setListPos(null);
      return;
    }
    updateListPosition();
    const onReposition = () => updateListPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateListPosition]);

  useEffect(() => {
    function onDocClick(e) {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(item) {
    onChange(item.codigo);
    setDisplayText(`${item.codigo} - ${item.nombre}`);
    setQuery('');
    setOpen(false);
  }

  function clearSelection() {
    onChange('');
    setDisplayText('');
    setQuery('');
    setOptions([]);
  }

  const listContent =
    open && !disabled && listPos ? (
      <ul
        ref={listRef}
        id={listId}
        className="rips-catalog-search-list rips-catalog-search-list--floating"
        role="listbox"
        style={{
          position: 'fixed',
          top: listPos.top,
          left: listPos.left,
          width: listPos.width,
          maxHeight: listPos.maxHeight,
        }}
      >
        {loading ? (
          <li className="rips-catalog-search-hint muted">Buscando…</li>
        ) : null}
        {!loading && query.trim().length > 0 && query.trim().length < 2 ? (
          <li className="rips-catalog-search-hint muted">
            Escriba al menos 2 caracteres
          </li>
        ) : null}
        {!loading && options.length === 0 && query.trim().length >= 2 ? (
          <li className="rips-catalog-search-hint muted">Sin resultados</li>
        ) : null}
        {!loading
          ? options.map((o) => (
              <li key={o.codigo}>
                <button
                  type="button"
                  role="option"
                  className={
                    value === o.codigo
                      ? 'rips-catalog-search-opt active'
                      : 'rips-catalog-search-opt'
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  <span className="td-mono">{o.codigo}</span>
                  <span className="rips-catalog-search-opt-name">
                    {o.nombre}
                  </span>
                </button>
              </li>
            ))
          : null}
      </ul>
    ) : null;

  return (
    <label className="rips-code-field rips-catalog-search">
      {label}
      <div ref={wrapRef} className="rips-catalog-search-wrap">
        <input
          ref={inputRef}
          type="text"
          className="td-mono"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={
            optional
              ? 'Buscar código o nombre (opc.)…'
              : 'Buscar por código o nombre…'
          }
          value={open ? query : displayText}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            if (!e.target.value && !optional) onChange('');
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            void runSearch('');
          }}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="rips-catalog-search-clear"
            aria-label="Quitar selección"
            onClick={clearSelection}
          >
            ×
          </button>
        ) : null}
      </div>
      {listContent && typeof document !== 'undefined'
        ? createPortal(listContent, document.body)
        : null}
    </label>
  );
}
