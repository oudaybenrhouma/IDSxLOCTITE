/** Minimal API client with explicit error handling. */

const BASE = '/api';

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `HTTP error ${status}`);
    this.status = status;
    this.code = payload?.error || 'API_ERROR';
    this.payload = payload || {};
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: options.signal,
      ...options,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, {
      error: 'NETWORK_UNAVAILABLE',
      message: 'The selection service cannot be reached. Check that the IDS server is running.',
    });
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  health: () => request('/health'),
  datasetStatus: () => request('/datasets/status'),
  reloadDatasets: () => request('/datasets/reload', { method: 'POST', body: '{}' }),

  products: (params = {}) => request(`/products${qs(params)}`),
  product: (id) => request(`/products/${encodeURIComponent(id)}`),
  search: (params) => request(`/search${qs(params)}`),
  suggestions: () => request('/search/suggestions'),

  applications: () => request('/applications'),
  application: (id) => request(`/applications/${encodeURIComponent(id)}`),
  problems: () => request('/problems'),
  problem: (id) => request(`/problems/${encodeURIComponent(id)}`),
  questions: () => request('/questions'),
  nextQuestion: (body) => request('/assistant/next', { method: 'POST', body: JSON.stringify(body) }),
  recommend: (body) => request('/recommend', { method: 'POST', body: JSON.stringify(body) }),
  rules: () => request('/rules'),
  warnings: () => request('/warnings'),
  sources: () => request('/sources'),
  comparisons: () => request('/comparisons'),
  compare: (ids) => request(`/compare${qs({ ids: ids.join(',') })}`),
};

function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
}

/** Generic loading hook with cancellation and explicit states. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useApi(fn, deps = [], { skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => fnRef.current({ signal: controller.signal }))
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ data: null, loading: false, error: err });
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (skip) return undefined;
    return reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...state, reload };
}
