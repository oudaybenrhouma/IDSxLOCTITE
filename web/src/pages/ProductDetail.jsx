import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, useApi, ApiError } from '../api.js';
import { Alert, Badge, ErrorState, Loading, Reveal, Undocumented } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { useToast } from '../components/Toast.jsx';
import { SEVERITY_TEXT, SEVERITY_TONE } from '../ui-text.js';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: product, loading, error, reload } = useApi(({ signal }) => api.product(id), [id]);
  const [compareIds, setCompareIds] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ids.compare');
      setCompareIds(raw ? JSON.parse(raw) : []);
    } catch { setCompareIds([]); }
  }, []);

  if (loading) return <div className="container"><Loading label="Opening the datasheet…" /></div>;

  if (error) {
    const notDocumented = error instanceof ApiError && error.code === 'PRODUIT_REFERENCE_MAIS_NON_DOCUMENTE';
    if (notDocumented) {
      return (
        <div className="container container-narrow">
          <div className="card">
            <div className="state-block">
              <Mascot pose="error" size={150} alt="IDS robot mascot scratching its head with a snapped spanner" />
              <h1>We have no datasheet for this one</h1>
              <p>{error.payload.message}</p>
              {error.payload.hint ? <p className="small">The documentation probably means <strong>{error.payload.hint}</strong>.</p> : null}
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary" to="/catalogue">Back to products</Link>
              <Link className="btn btn-outline" to="/qualite-donnees">See open data points</Link>
            </div>
            <div className="mt-3">
              <Reveal title="Where this reference is cited" count={(error.payload.references || []).length}>
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th scope="col">Dataset</th><th scope="col">Record</th><th scope="col">Field</th><th scope="col">Context</th></tr></thead>
                    <tbody>
                      {(error.payload.references || []).map((r, i) => (
                        <tr key={i}>
                          <td className="mono small">{r.dataset}</td>
                          <td className="mono small">{r.recordId}</td>
                          <td className="mono small">{r.field}</td>
                          <td className="small muted">{r.context || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      );
    }
    return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;
  }

  if (!product) return null;

  const inCompare = compareIds.includes(product.id);
  const toggleCompare = () => {
    const next = inCompare ? compareIds.filter((x) => x !== product.id) : [...compareIds, product.id].slice(-4);
    setCompareIds(next);
    localStorage.setItem('ids.compare', JSON.stringify(next));
    toast.push({
      title: inCompare ? 'Removed from the comparison' : `${product.product_code} added to the comparison`,
      message: inCompare ? 'It is no longer in your list.' : 'Open Compare to see it side by side with the others.',
    });
  };

  return (
    <div className="container">
      <nav aria-label="Breadcrumb" className="small mb-2">
        <Link to="/catalogue">Products</Link> › <span className="muted">{product.name}</span>
      </nav>

      {/* Headline: what it is, and the two actions that matter. */}
      <div className="card card-accent mb-3">
        <div className="row-between">
          <div>
            <div className="eyebrow">{product.categoryLabel}</div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)' }}>{product.name}</h1>
            <div className="row mt-1">
              <span className="code">Code {product.product_code}</span>
              {product.strength && product.strength !== 'N/A' ? <Badge tone="blue">{product.strength}</Badge> : null}
              {product.links.warnings.length ? <Badge tone="amber">{product.links.warnings.length} warning(s)</Badge> : null}
            </div>
          </div>
          <div className="row no-print">
            <button type="button" className={`btn ${inCompare ? 'btn-dark' : 'btn-outline'} btn-sm`} onClick={toggleCompare} aria-pressed={inCompare}>
              {inCompare ? '✓ In comparison' : 'Add to compare'}
            </button>
            {compareIds.length >= 2 ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/comparer?ids=${compareIds.join(',')}`)}>
                Compare ({compareIds.length})
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Three plain answers first — the questions a technician actually asks. */}
      <div className="grid grid-3 mb-3">
        <div className="card card-tight">
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Temperature</div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{product.temp_range || <Undocumented />}</div>
        </div>
        <div className="card card-tight">
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Maximum gap</div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{product.max_gap || <Undocumented />}</div>
        </div>
        <div className="card card-tight">
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Cure time</div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{product.cure_time || <Undocumented />}</div>
        </div>
      </div>

      {product.links.warnings.length ? (
        <div className="stack mb-3" style={{ gap: 10 }}>
          {product.links.warnings.map((w) => (
            <Alert
              key={w.warning_id}
              tone={SEVERITY_TONE[w.severity] === 'critical' || SEVERITY_TONE[w.severity] === 'red' ? 'danger' : 'warn'}
              title={`${w.title} — ${SEVERITY_TEXT[w.severity] || w.severity}`}
            >
              {w.description}
            </Alert>
          ))}
        </div>
      ) : null}

      <div className="stack">
        <Reveal title="Full specifications">
          <dl className="def-list">
            <dt>Documented category</dt><dd>{product.category}</dd>
            <dt>Chemistry</dt><dd>{product.chemistry || <Undocumented />}</dd>
            <dt>Strength</dt><dd>{product.strength || <Undocumented />}</dd>
            <dt>Colour</dt><dd>{product.color || <Undocumented />}</dd>
            <dt>Viscosity</dt><dd>{product.viscosity || <Undocumented />}</dd>
            <dt>Maximum gap</dt><dd>{product.max_gap || <Undocumented />}</dd>
            <dt>Temperature range</dt><dd>{product.temp_range || <Undocumented />}</dd>
            <dt>Cure time</dt><dd>{product.cure_time || <Undocumented />}</dd>
          </dl>
          {product.undocumented_specs?.length ? (
            <p className="hint mt-2">
              Not numeric in the source ({product.undocumented_specs.join(', ')}): these fields are never compared
              automatically, and a missing value does not mean the product lacks the capability.
            </p>
          ) : null}
        </Reveal>

        <Reveal title="How to use it" hint={product.usage_instructions ? undefined : 'not documented'}>
          <p>{product.usage_instructions || <Undocumented />}</p>
          <h3 className="mt-2">Limits and exclusions</h3>
          <p>{product.limitations || <Undocumented />}</p>
        </Reveal>

        <Reveal
          title="Applications, substrates and approvals"
          count={(product.applications || []).length + (product.compatible_materials || []).length + (product.approvals || []).length}
        >
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <h3>Documented applications</h3>
              {(product.applications || []).length ? (
                <ul className="bullets">{(product.applications || []).map((v, i) => <li key={i}>{v}</li>)}</ul>
              ) : <p className="small muted"><Undocumented /></p>}
            </div>
            <div>
              <h3>Compatible substrates</h3>
              {(product.compatible_materials || []).length ? (
                <ul className="bullets">{(product.compatible_materials || []).map((v, i) => <li key={i}>{v}</li>)}</ul>
              ) : <p className="small muted"><Undocumented /></p>}
            </div>
            <div>
              <h3>Approvals and certifications</h3>
              {(product.approvals || []).length ? (
                <ul className="bullets">{(product.approvals || []).map((v, i) => <li key={i}>{v}</li>)}</ul>
              ) : <p className="small muted"><Undocumented /></p>}
            </div>
          </div>
        </Reveal>

        <Reveal title="Where it is used here" count={product.links.problems.length + product.links.applications.length}>
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <h3>Related problems</h3>
              {product.links.problems.length ? (
                <ul className="bullets">
                  {product.links.problems.map((p, i) => (
                    <li key={i}>
                      <Link to={`/problemes#${p.id}`}>{p.title}</Link>{' '}
                      <Badge tone={p.role === 'primaire' ? 'dark' : 'neutral'}>{p.role === 'primaire' ? 'primary' : 'alternative'}</Badge>
                    </li>
                  ))}
                </ul>
              ) : <p className="small muted">No documented problem cites this product.</p>}
            </div>
            <div>
              <h3>Applications</h3>
              {product.links.applications.length ? (
                <ul className="bullets">
                  {product.links.applications.map((a, i) => (
                    <li key={i}>
                      <Link to={`/catalogue?application=${a.id}`}>{a.title}</Link>
                      {a.subApplication ? <div className="small muted">{a.subApplication}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="small muted">Not listed as a featured product of an application.</p>}
            </div>
          </div>
        </Reveal>

        <Reveal title="Sources and traceability" count={product.sources.length}>
          {product.sources.length ? (
            <ul className="bullets">
              {product.sources.map((s) => (
                <li key={s.ref_id}>
                  <span className="mono">{s.source_pdf}</span> — pages {s.pages_referenced || 'not stated'}
                  <div className="muted tiny">{s.topic}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Alert tone="warn" title="No source page cites this product">
              Its values come from products.json but are not tied to a page reference. Confirm them with an IDS
              specialist before use.
            </Alert>
          )}
          {product.relatedComparisons?.length ? (
            <div className="mt-2">
              <h3>Documented comparisons</h3>
              <ul className="bullets">
                {product.relatedComparisons.map((c) => (
                  <li key={c.id}><Link to={`/comparer?ids=${c.target_products.join(',')}`}>{c.title}</Link></li>
                ))}
              </ul>
            </div>
          ) : null}
          {product.links.rules.length ? (
            <div className="mt-2">
              <h3>Selection rules that cite it</h3>
              <ul className="bullets small">
                {product.links.rules.map((r, i) => (
                  <li key={i}>
                    <span className="mono">{r.ruleId}</span> — {Object.entries(r.condition || {}).map(([k, v]) => `${k.replace(/_/g, ' ')} = ${v}`).join(' AND ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Reveal>
      </div>
    </div>
  );
}
