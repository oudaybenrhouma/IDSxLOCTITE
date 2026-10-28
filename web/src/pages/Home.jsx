import React from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Badge, ErrorState, Loading, Reveal } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { APP } from '../ui-text.js';

export default function Home() {
  const status = useApi(() => api.datasetStatus(), []);
  const apps = useApi(() => api.applications(), []);
  const problems = useApi(() => api.problems(), []);

  const s = status.data;
  const loading = status.loading || apps.loading || problems.loading;
  const error = status.error || apps.error || problems.error;

  return (
    <div className="container">
      <section className="hero">
        <div>
          <div className="eyebrow" style={{ color: 'var(--brand-red-light)' }}>{APP.company}</div>
          <h1>Right Loctite product, first time.</h1>
          <p>
            Tell us what you are fixing. We ask only what matters, then show the product, why it fits and
            what to watch out for.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/selection">Find my product</Link>
            <Link className="btn btn-outline btn-lg" to="/recherche">I know what I need</Link>
          </div>
          <div className="hero-note">
            <span className="dot" aria-hidden="true" />
            Answers come straight from the Henkel documentation — nothing is invented.
          </div>
        </div>
        <div className="hero-figure">
          <Mascot pose="neutral" size={252} alt="IDS robot mascot waving hello" />
        </div>
      </section>

      {error ? <ErrorState error={error} onRetry={status.reload} /> : null}
      {loading && !error ? <Loading label="Getting the product data ready…" /> : null}

      {/* Three big doors. Everything else in the app is reachable from here or from the tab bar. */}
      <div className="grid grid-3 mb-3">
        <Link to="/selection" className="tile">
          <span className="tile__icon" aria-hidden="true">🧭</span>
          <span className="tile__title">Find a product</span>
          <p className="tile__text">Describe the job or the problem. We narrow it down in a few taps.</p>
          <span className="tile__cta">Start the guide →</span>
        </Link>
        <Link to="/recherche" className="tile">
          <span className="tile__icon" aria-hidden="true">🔍</span>
          <span className="tile__title">Search</span>
          <p className="tile__text">A name, a code like “243”, a surface, or an approval such as NSF.</p>
          <span className="tile__cta">Search the catalogue →</span>
        </Link>
        <Link to="/catalogue" className="tile">
          <span className="tile__icon" aria-hidden="true">🧴</span>
          <span className="tile__title">Browse products</span>
          <p className="tile__text">All {s ? s.stats.products : ''} documented products, with their datasheets.</p>
          <span className="tile__cta">Open the catalogue →</span>
        </Link>
      </div>

      {s ? (
        <div className="metric-strip mb-3">
          <span className="metric-pill"><b>{s.stats.products}</b><span>products documented</span></span>
          <span className="metric-pill"><b>{s.stats.applications}</b><span>applications</span></span>
          <span className="metric-pill"><b>{s.stats.problems}</b><span>common problems</span></span>
          <span className="metric-pill"><b>{s.stats.source_references}</b><span>source documents</span></span>
        </div>
      ) : null}

      {/* Start from the symptom: the fastest route for a technician with a machine in front of them. */}
      <div className="card mb-3">
        <div className="row-between mb-1">
          <h2 style={{ margin: 0 }}>Start from what you can see</h2>
          <Badge tone="outline">{problems.data?.problems?.length || 0} problems</Badge>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Pick the symptom on site — loosening, leakage, wear, seizing — and go straight to the documented solution.
        </p>
        <div className="options">
          {(problems.data?.problems || []).slice(0, 3).map((p) => (
            <Link key={p.id} to="/selection" state={{ entry: 'problem', problemId: p.id }} className="option">
              <span className="option-main">
                <span className="option-label">{p.title}</span>
                <span className="option-meta">{p.symptoms}</span>
              </span>
              <span className="option-check" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
        <div className="mt-2">
          <Link className="btn btn-outline" to="/problemes">See all problems</Link>
        </div>
      </div>

      {/* Everything else is one tap deeper: applications, the trust story, the data caveats. */}
      <div className="stack">
        <Reveal title="Browse by application" count={apps.data?.applications?.length || 0}>
          <div className="stack" style={{ gap: 8 }}>
            {(apps.data?.applications || []).map((a) => (
              <Link
                key={a.id}
                to="/selection"
                state={{ entry: 'application', applicationId: a.id }}
                className="option"
              >
                <span className="option-main">
                  <span className="option-label">{a.title}</span>
                  <span className="option-meta">{a.description}</span>
                </span>
                {a.ruleId ? <Badge tone="green">Guide available</Badge> : <Badge tone="amber">Specialist review</Badge>}
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal title="How this guide stays trustworthy">
          <div className="grid grid-3">
            <div>
              <h3>You can check us</h3>
              <p className="small muted">
                Every answer shows the rule applied, the branch that matched, the limits checked and the source
                document with its page.
              </p>
            </div>
            <div>
              <h3>We say “not sure”</h3>
              <p className="small muted">
                Missing or contradictory data never becomes a forced answer: the case is flagged and handed to an
                IDS specialist.
              </p>
            </div>
            <div>
              <h3>Nothing made up</h3>
              <p className="small muted">
                No prices, stock, images or certifications are added. A value we do not have stays
                “not documented”.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal
          title="Data we are still checking"
          hint={s && s.errors?.length ? `${s.errors.length} open points` : undefined}
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            The technical datasets have {s ? s.errors?.length || 0 : 0} open points, mostly product references that
            are cited in the documentation but have no datasheet in this catalogue. The guide never recommends one
            of those as a confirmed match.
          </p>
          <Link className="btn btn-outline btn-sm" to="/qualite-donnees">Open data quality</Link>
        </Reveal>
      </div>
    </div>
  );
}
