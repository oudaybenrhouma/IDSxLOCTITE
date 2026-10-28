import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Alert, Badge, EmptyState, ErrorState, Loading, Reveal } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { ATTRIBUTE_LABELS, SEVERITY_TEXT, SEVERITY_TONE } from '../ui-text.js';

const MAX = 4;

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const idsParam = params.get('ids') || '';
  const [selected, setSelected] = useState(() => idsParam.split(',').filter(Boolean));
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const products = useApi(() => api.products(), []);
  const comparisons = useApi(() => api.comparisons(), []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ids.compare') || '[]');
      if (!idsParam && stored.length) setSelected(stored.slice(0, MAX));
    } catch { /* ignore malformed storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setParams(selected.length ? { ids: selected.join(',') } : {}, { replace: true });
    localStorage.setItem('ids.compare', JSON.stringify(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join(',')]);

  const compare = useApi(() => api.compare(selected), [selected.join(',')], { skip: selected.length < 2 });

  const all = products.data?.products || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) => `${p.name} ${p.product_code} ${p.category}`.toLowerCase().includes(q));
  }, [all, query]);

  const toggle = (id) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? cur : [...cur, id]));
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Compare</div>
          <h1>Side by side</h1>
          <p className="lead">Pick two to four products. Differences are highlighted; a value we do not have says “not documented”.</p>
        </div>
        <Mascot pose="neutral" size={96} decorative className="mascot--optional no-print" />
      </div>

      {/* Picking stays collapsed until it is needed. */}
      <div className="card mb-3">
        <div className="row-between">
          <div className="row" style={{ gap: 8 }}>
            {selected.map((id) => {
              const p = all.find((x) => x.id === id);
              return (
                <span key={id} className="badge badge-dark">
                  {p ? p.product_code : id}
                  <button
                    type="button"
                    aria-label={`Remove ${p ? p.name : id}`}
                    onClick={() => toggle(id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-inverse)', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 900 }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            {!selected.length ? <span className="small muted">Nothing picked yet.</span> : null}
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
            {picking ? 'Done picking' : `Pick products (${selected.length}/${MAX})`}
          </button>
        </div>

        {picking ? (
          <div className="mt-2">
            <input
              className="input mb-2"
              placeholder="Filter the list…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter the products available for comparison"
            />
            <div className="chips" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  aria-pressed={selected.includes(p.id)}
                  onClick={() => toggle(p.id)}
                  disabled={!selected.includes(p.id) && selected.length >= MAX}
                  title={!selected.includes(p.id) && selected.length >= MAX ? 'Maximum reached' : undefined}
                >
                  {p.product_code} — {p.name.replace(/LOCTITE®\s?/i, '')}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {selected.length < 2 ? (
        <EmptyState
          title="Pick two products to compare"
          action={(
            <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
              Choose products
            </button>
          )}
        >
          You will see the documented differences, the warnings that apply, and which values are missing.
        </EmptyState>
      ) : compare.loading ? (
        <Loading label="Building the comparison…" />
      ) : compare.error ? (
        <ErrorState error={compare.error} onRetry={compare.reload} />
      ) : compare.data ? (
        <div className="stack">
          <div className="table-wrap">
            <table className="data">
              <caption className="visually-hidden">Technical comparison of {compare.data.products.map((p) => p.name).join(', ')}</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ minWidth: 180 }}>Attribute</th>
                  {compare.data.products.map((p) => (
                    <th key={p.id} scope="col" style={{ minWidth: 200 }}>
                      <Link to={`/produits/${encodeURIComponent(p.id)}`}>{p.name}</Link>
                      <div className="product-code">{p.product_code}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.data.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">
                      {row.label}
                      {row.differs ? <div className="tiny" style={{ color: 'var(--brand-red-dark)', fontWeight: 800 }}>differs</div> : null}
                    </th>
                    {row.values.map((v, i) => (
                      <td key={i}>
                        {v.state === 'documente' ? v.value : v.state === 'non_applicable'
                          ? <span className="muted small">{v.value} (not applicable)</span>
                          : <span className="cell-undocumented" title="Not present in the supplied datasets. This does not mean the product lacks this capability.">Not documented</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Warnings</th>
                  {compare.data.warningsByProduct.map((w) => (
                    <td key={w.id}>
                      {w.warnings.length ? w.warnings.map((x) => (
                        <div key={x.id} className="mb-1">
                          <Badge tone={SEVERITY_TONE[x.severity] === 'critical' ? 'critical' : 'amber'}>{SEVERITY_TEXT[x.severity] || x.severity}</Badge>
                          <div className="tiny">{x.title}</div>
                        </div>
                      )) : <span className="muted small">None</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="small muted" style={{ margin: 0 }}>
            “Not documented” means the value is absent from the datasets — not that the product cannot do it.
          </p>

          {compare.data.matchedComparisons?.length ? (
            <Reveal title="Documented comparison matrices" count={compare.data.matchedComparisons.length}>
              <MatrixTables comparisons={compare.data.matchedComparisons} products={compare.data.products} />
            </Reveal>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MatrixTables({ comparisons, products }) {
  return (
    <div className="stack">
      {comparisons.map((c) => {
        const attrs = Object.keys(c.comparison_matrix || {});
        return (
          <div key={c.comparison_id}>
            <h3>{c.title}</h3>
            <div className="table-wrap mt-1">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Attribute</th>
                    {products.map((p) => <th key={p.id} scope="col">{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {attrs.map((a) => (
                    <tr key={a}>
                      <th scope="row">{ATTRIBUTE_LABELS[a] || a.replace(/_/g, ' ')}</th>
                      {products.map((p) => {
                        const val = c.comparison_matrix[a]?.[p.id];
                        return (
                          <td key={p.id}>
                            {val === undefined ? <span className="cell-undocumented">Not documented</span> : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
