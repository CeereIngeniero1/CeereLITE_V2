import { useRef } from 'react';

export function Tabs({ tabs, value, onChange, ariaLabel, idPrefix = 'ui' }) {
  const listRef = useRef(null);

  function focusTab(id) {
    const btn = listRef.current?.querySelector(`[data-tab-id="${id}"]`);
    btn?.focus();
  }

  function onKeyDown(e) {
    const ids = tabs.map((t) => t.id);
    const i = ids.indexOf(value);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (i + 1) % ids.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (i - 1 + ids.length) % ids.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = ids.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    onChange(ids[next]);
    requestAnimationFrame(() => focusTab(ids[next]));
  }

  return (
    <div
      ref={listRef}
      className="ui-tabs"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab-id={t.id}
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-tabpanel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'ui-tab is-active' : 'ui-tab'}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, value, children, idPrefix = 'ui' }) {
  const selected = value === id;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-tabpanel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      hidden={!selected}
      className="ui-tab-panel"
    >
      {children}
    </div>
  );
}
