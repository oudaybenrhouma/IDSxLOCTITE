import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Mascot } from './Mascot.jsx';

/**
 * Lightweight toast system. Success toasts carry the success pose so the mascot is
 * present in every success state; errors carry the error pose.
 */
const ToastContext = createContext({ push: () => {} });

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((toast) => {
    const id = ++seq;
    setToasts((list) => [...list, { id, tone: 'success', ttl: 5200, ...toast }]);
    return id;
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast.ttl) return undefined;
    const timer = setTimeout(() => onDismiss(toast.id), toast.ttl);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const pose = toast.tone === 'error' ? 'error' : toast.tone === 'empty' ? 'empty' : toast.tone === 'info' ? 'neutral' : 'success';
  return (
    <div className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <Mascot pose={pose} size={72} decorative className="mascot--optional" />
      <div className="toast__body">
        {toast.title ? <div className="toast__title">{toast.title}</div> : null}
        {toast.message ? <div className="toast__msg">{toast.message}</div> : null}
        {toast.action ? <div className="mt-1">{toast.action}</div> : null}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
