import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Badge, EmptyState, ErrorState, Reveal, SkeletonCards } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';

export default function Catalogue() {
  const [params] = useSearchParams();
  const [category, setCategory] = useState(params.get('categorie') || '');
  const [query, setQuery] = useState('');
  const [application, setApplication] = useState(params.get('application') || '');
  const products = useApi(() => api.products(), []);
  const apps = useApi(() => api.applications(), []);
  const status = useApi(() => api.datasetStatus(), []);

  const all = products.data?.products || [];
  const categories = useMemo(() => {
    const map = new Map();
    all.forEach((p) => map.set(p.category, (map.get(p.category) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) => {
      if (category && p.category !== category) return false;
      if (application && !p.links.applications.some((a) => a.id === application)) return false;
      if (!q) return true;
      const hay = [p.name, p.product_code, p.category, p.chemistry, p.viscosity, p.strength,
        p.max_gap, p.temp_range, p.limitations, ...(p.approvals || []), ...(p.compatible_materials || []), ...(p.applications || [])]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [all, category, application, query]);

  const missingProducts = status.data?.issues?.missingProducts || [];

  if (products.loading) return <div className="container"><SkeletonCards count={6} /></div>;
  if (products.error) return <div className="container"><ErrorState error={products.error} onRetry={products.reload} /></div>;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Products</div>
          <h1>All {all.length} products</h1>
          <p className="lead">Tap a product for its datasheet. Everything shown here comes from the supplied documentation.</p>
        </div>
        <Mascot pose="neutral" size={96} decorative className="mascot--optional no-print" />
      </div>

      <div className="card mb-3">
        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              className="input search-input"
              placeholder="Filter by name, code or property…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter the catalogue"
            />
          </div>
          <select
            className="select"
            style={{ maxWidth: 300 }}
            aria-label="Filter by application"
            value={application}
            onChange={(e) => setApplication(e.target.value)}
          >
            <option value="">All applications</option>
            {(apps.data?.applications || []).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <div className="chips mt-2">
          <button type="button" className="chip" aria-pressed={category === ''} onClick={() => setCategory('')}>
            All ({all.length})
          </button>
          {categories.map(([cat, n]) => (
            <button
              key={cat}
              type="button"
              className="chip"
              aria-pressed={category === cat}
              onClick={() => setCategory(category === cat ? '' : cat)}
            >
              {cat} ({n})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing matches that filter"
          action={<button type="button" className="btn btn-primary" onClick={() => { setQuery(''); setCategory(''); setApplication(''); }}>Clear filters</button>}
        >
          Try a shorter name, a product code such as “243”, or clear the category chips.
        </EmptyState>
      ) : (
        <div className="grid grid-3">
          {filtered.map((p) => (
            <Link key={p.id} to={`/produits/${encodeURIComponent(p.id)}`} className="product-card">
              <div>
                <div className="product-name">{p.name}</div>
                <div className="product-code">{p.product_code}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Badge tone="blue">{p.categoryLabel}</Badge>
                {p.links.warnings.length ? <Badge tone="amber">{p.links.warnings.length} warning(s)</Badge> : null}
              </div>
              <dl className="product-specs">
                <dt>Strength</dt><dd>{p.strength && p.strength !== 'N/A' ? p.strength : <em className="muted">not documented</em>}</dd>
                <dt>Temperature</dt><dd>{p.temp_range || <em className="muted">not documented</em>}</dd>
              </dl>
              <div className="spacer" />
              <span className="tile__cta">Open datasheet →</span>
            </Link>
          ))}
        </div>
      )}

      {missingProducts.length ? (
        <div className="mt-3">
          <Reveal title="References with no datasheet" count={missingProducts.length} hint="cited by the documentation">
            <p className="small muted" style={{ marginTop: 0 }}>
              These references appear in the documentation but have no record in products.json. They can never be
              shown as a confirmed match.
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th scope="col">Reference</th><th scope="col">Likely designation</th><th scope="col">Cited by</th></tr></thead>
                <tbody>
                  {missingProducts.map((m) => (
                    <tr key={m.productId}>
                      <td className="mono">{m.productId}</td>
                      <td className="small">{m.productId === 'PROD_SI5699' ? 'Loctite SI 5699' : m.productId === 'PROD_PC7226_rebuild' ? 'Loctite PC 7226' : '—'}</td>
                      <td className="small muted">{m.references.map((r) => r.dataset).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      ) : null}
    </div>
  );
}
