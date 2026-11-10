import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* ----------------------------- Toasts ----------------------------- */
const ToastCtx = createContext({ push: () => {} });
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ----------------------------- Layout ----------------------------- */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p className="muted small">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p className="muted small">{subtitle}</p> : null}
          </div>
          {actions ? <div className="card-actions">{actions}</div> : null}
        </div>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Spinner({ label }) {
  return (
    <div className="spinner-wrap">
      <span className="spinner" />
      {label ? <span className="muted small">{label}</span> : null}
    </div>
  );
}

export function Empty({ children = 'Nothing to show yet.' }) {
  return <div className="empty">{children}</div>;
}

export function Btn({ children, variant = 'primary', size = '', type = 'button', ...rest }) {
  return (
    <button type={type} className={`btn ${variant} ${size}`} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Table({ columns, rows, empty = 'No records.', rowKey }) {
  if (!rows || rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row, i) : row[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(loader)
      .then((data) => live && setState({ loading: false, data, error: null }))
      .catch((error) => live && setState({ loading: false, data: null, error }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
