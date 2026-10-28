import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Badge, EmptyState, ErrorState, Loading } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';

function useDebounced(value, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const EXAMPLES = ['243', 'bearing', 'stainless', 'leak', 'pump', 'WRAS', 'high temperature'];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [application, setApplication] = useState(params.get('application') || '');
  const debounced = useDebounced(query);
  const results = useApi(
    () => api.search({ q: debounced, category, application }),
    [debounced, category, application],
  );
  const apps = useApi(() => api.applications(), []);
  const categories = useMemo(() => {
    const set = new Map();
    (results.data?.results || []).forEach((r) => set.set(r.category, r.categoryLabel || r.category));
    return [...set.entries()];
  }, [results.data]);

  useEffect(() => {
    const np = new URLSearchParams();
    if (query) np.set('q', query);
    if (category) np.set('category', category);
    if (application) np.set('application', application);
    setParams(np, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, application]);

  const inputRef = useRef(null);
  useEffect(() => {
    // On a tablet the keyboard should open straight away only if the user came here to type.
    if (!params.get('q')) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Search</div>
          <h1>What are you looking for?</h1>
          <p className="lead">A name, a code, a surface, a problem or an approval — all of it works.</p>
        </div>
        <Mascot pose="neutral" size={96} decorative className="mascot--optional no-print" />
      </div>

      <div className="card mb-3">
        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <label htmlFor="search-input" className="visually-hidden">Search products</label>
            <input
              id="search-input"
              ref={inputRef}
              className="input search-input"
              placeholder="e.g. 243, bearing, stainless, leak…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              type="search"
            />
          </div>
          <select
            className="select"
            style={{ maxWidth: 260 }}
            aria-label="Filter by application"
            value={application}
            onChange={(e) => setApplication(e.target.value)}
          >
            <option value="">All applications</option>
            {(apps.data?.applications || []).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>

        <div className="chips mt-2">
          <span className="small muted" style={{ alignSelf: 'center' }}>Try:</span>
          {EXAMPLES.map((e) => <button key={e} type="button" className="chip" onClick={() => setQuery(e)}>{e}</button>)}
          {category ? <button type="button" className="chip" aria-pressed onClick={() => setCategory('')}>{categories.find(([k]) => k === category)?.[1] || category} ✕</button> : null}
        </div>

        {categories.length > 1 ? (
          <div className="chips mt-2">
            <span className="small muted" style={{ alignSelf: 'center' }}>Narrow:</span>
            {categories.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-pressed={category === key}
                onClick={() => setCategory(category === key ? '' : key)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {results.loading ? <Loading label="Searching the documented products…" /> : null}
      {results.error ? <ErrorState error={results.error} onRetry={results.reload} /> : null}

      {results.data ? (
        <>
          {results.data.count === 0 ? (
            <EmptyState
              title="Nothing found for that"
              action={<Link className="btn btn-primary" to="/selection">Let the guide find it</Link>}
            >
              Try a shorter word or a product code such as “243”. The guide can also narrow it down from what you are
              fixing.
            </EmptyState>
          ) : (
            <>
              <p className="small muted">
                {results.data.count} result{results.data.count === 1 ? '' : 's'}
                {debounced ? ` for “${debounced}”` : ''}
              </p>
              <div className="grid grid-3">
                {results.data.results.map((r) => (
                  <Link key={r.id} to={`/produits/${encodeURIComponent(r.id)}`} className="product-card">
                    <div>
                      <div className="product-name">{r.name}</div>
                      <div className="product-code">{r.code}</div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <Badge tone="blue">{r.categoryLabel || r.category}</Badge>
                      {r.approvals.slice(0, 1).map((a) => <Badge key={a} tone="green">{a}</Badge>)}
                    </div>
                    {r.problemsTitles.length ? <div className="small muted">{r.problemsTitles[0]}</div> : null}
                    <div className="spacer" />
                    <span className="tile__cta">Open datasheet →</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
