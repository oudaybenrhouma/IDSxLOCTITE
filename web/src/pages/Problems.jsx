import React from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Alert, Badge, ErrorState, Loading, Reveal } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { SEVERITY_TEXT, SEVERITY_TONE } from '../ui-text.js';

export default function Problems() {
  const { data, loading, error, reload } = useApi(() => api.problems(), []);
  const warnings = useApi(() => api.warnings(), []);
  const sources = useApi(() => api.sources(), []);

  if (loading) return <div className="container"><Loading label="Loading the documented problems…" /></div>;
  if (error) return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;

  const problems = data?.problems || [];

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Problems</div>
          <h1>What are you fixing?</h1>
          <p className="lead">Each problem comes with its documented cause, the recommended product and the procedure.</p>
        </div>
        <Mascot pose="neutral" size={96} decorative className="mascot--optional no-print" />
      </div>

      <div className="stack">
        {problems.map((p) => {
          const primary = p.productResolutions.primary;
          return (
            <article className="card" key={p.id} id={p.id}>
              <h2 style={{ marginBottom: 4 }}>{p.title}</h2>
              <p className="muted small" style={{ marginTop: 0 }}>{p.symptoms}</p>

              <div className="row-between">
                <div className="row">
                  {primary ? (
                    primary.available ? (
                      <Link className="btn btn-primary btn-sm" to={`/produits/${encodeURIComponent(primary.id)}`}>
                        {primary.name}
                      </Link>
                    ) : (
                      <span className="badge badge-red">{primary.id} — no datasheet</span>
                    )
                  ) : <span className="muted small">No documented primary product</span>}
                  <Link className="btn btn-outline btn-sm" to="/selection" state={{ entry: 'problem', problemId: p.id }}>
                    Use the guide
                  </Link>
                </div>
              </div>

              <div className="mt-2">
                <Reveal title="Cause, procedure and alternatives" flat>
                  <dl className="def-list">
                    <dt>Root cause</dt><dd>{p.root_cause || 'Not documented'}</dd>
                    <dt>Selection criterion</dt><dd>{p.selection_criteria || 'Not documented'}</dd>
                    <dt>Documented procedure</dt><dd>{p.recommended_solution?.procedure || 'Not documented'}</dd>
                    <dt>Alternatives</dt>
                    <dd>
                      {p.productResolutions.alternatives.length
                        ? p.productResolutions.alternatives.map((a, i) => (
                          <span key={a.id}>
                            {i > 0 ? ' · ' : ''}
                            {a.available ? <Link to={`/produits/${encodeURIComponent(a.id)}`}>{a.name}</Link> : <span className="mono">{a.id} (no datasheet)</span>}
                          </span>
                        ))
                        : 'none'}
                    </dd>
                  </dl>
                </Reveal>
              </div>
            </article>
          );
        })}
      </div>

      {warnings.data?.warnings?.length ? (
        <div className="mt-3">
          <Reveal title="Warnings and limitations" count={warnings.data.warnings.length}>
            <div className="stack" style={{ gap: 12 }}>
              {warnings.data.warnings.map((w) => (
                <div key={w.warning_id} className={`alert alert-${SEVERITY_TONE[w.severity] === 'critical' ? 'danger' : 'warn'}`}>
                  <div className="row-between">
                    <strong className="alert-title">{w.title}</strong>
                    <Badge tone={SEVERITY_TONE[w.severity] === 'critical' ? 'critical' : 'amber'}>{SEVERITY_TEXT[w.severity] || w.severity}</Badge>
                  </div>
                  <p className="small" style={{ margin: '6px 0' }}>{w.description}</p>
                  <div className="small">
                    Affected:{' '}
                    {w.affected.map((a, i) => (
                      <span key={a.id}>
                        {i > 0 ? ' · ' : ''}
                        {a.available ? <Link to={`/produits/${encodeURIComponent(a.id)}`}>{a.name}</Link> : <span className="mono">{a.id}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      ) : null}

      {sources.data?.sources?.length ? (
        <div className="mt-3">
          <Reveal title="Source documents" count={sources.data.sources.length}>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th scope="col">Document</th><th scope="col">Pages</th><th scope="col">Topic</th><th scope="col">Products</th></tr></thead>
                <tbody>
                  {sources.data.sources.map((s) => (
                    <tr key={s.ref_id}>
                      <td className="mono small">{s.source_pdf}<div className="tiny muted">{s.ref_id}</div></td>
                      <td className="small">{s.pages_referenced || '—'}</td>
                      <td className="small">{s.topic}</td>
                      <td className="small">
                        {s.linkedProducts.length
                          ? s.linkedProducts.map((p, i) => (
                            <span key={p.id}>{i > 0 ? ' · ' : ''}<Link to={`/produits/${encodeURIComponent(p.id)}`}>{p.code}</Link></span>
                          ))
                          : <span className="muted">no product cited by name</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Alert tone="info" title="How these links were made">
              Page ranges come from source_references.json. The product ↔ document link is inferred from the explicit
              mention of the product code in the extracted claims — it is indicative only.
            </Alert>
          </Reveal>
        </div>
      ) : null}
    </div>
  );
}
