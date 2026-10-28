import React from 'react';
import { Link } from 'react-router-dom';
import { Badge, SectionTitle, Alert, Undocumented, Reveal } from './UI.jsx';
import { Mascot } from './Mascot.jsx';
import {
  STATUS_TEXT, STATUS_TONE, STATUS_EXPLAIN, CANDIDATE_TEXT, CANDIDATE_TONE, ROLE_TEXT,
  SEVERITY_TEXT, SEVERITY_TONE, CHECK_TONE, CHECK_TEXT, humaniseKey,
} from '../ui-text.js';

/**
 * The result screen is answer-first: the product, one line of why, and the
 * three things a technician actually does next. Every table, trace and caveat
 * is still there — folded into a disclosure, one tap away.
 */

const originText = (origin) => {
  if (!origin) return 'source not stated';
  if (origin.type === 'rule') return `rule ${origin.ruleId}, branch ${origin.branchIndex + 1}`;
  if (origin.type === 'rule_partial') {
    return `rule ${origin.ruleId}, branch ${origin.branchIndex + 1} — partial (criterion not answered: ${(origin.unknown || []).map(humaniseKey).join(', ')})`;
  }
  if (origin.type === 'question_option') return `documented answer in ${origin.questionId}`;
  if (origin.type === 'problem') return `documented problem ${origin.problemId}`;
  if (origin.type === 'application') return `application ${origin.applicationId}${origin.subApplication ? ` — ${origin.subApplication}` : ''}`;
  return origin.type;
};

const firstLine = (text, max = 130) => {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

function ProductHeadline({ candidate }) {
  const p = candidate.resolution.product;
  if (!p) {
    return (
      <div>
        <div className="product-name" style={{ fontSize: '1.3rem' }}>
          Reference not in the catalogue: <span className="mono">{candidate.productId}</span>
        </div>
        {candidate.resolution.hint ? <div className="option-meta">Likely designation: {candidate.resolution.hint}</div> : null}
      </div>
    );
  }
  return (
    <div>
      <div className="product-name" style={{ fontSize: '1.45rem', lineHeight: 1.2 }}>{p.name}</div>
      <div className="option-meta">
        Code <strong>{p.product_code}</strong> · {p.category}
        {p.strength && p.strength !== 'N/A' ? ` · ${p.strength}` : ''}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Verdict --- */

function Verdict({ result, onCompare, onAdjust }) {
  const { status, primary, candidates, escalation, missingInfo } = result;
  const p = primary?.resolution?.product;
  const pose = status === 'recommendation' ? 'success' : status === 'informations_insuffisantes' ? 'neutral' : 'error';
  const blocking = missingInfo.filter((m) => m.blocking);
  const caution = escalation?.required;

  return (
    <div className="card card-accent">
      <div className="verdict">
        <Mascot pose={pose} size={132} decorative className="mascot--optional" />
        <div className="verdict__body">
          <div className="row" style={{ marginBottom: 6 }}>
            <Badge tone={STATUS_TONE[status] || 'neutral'}>{STATUS_TEXT[status] || status}</Badge>
            {primary?.resolution?.product ? <Badge tone="outline">Code {primary.resolution.product.product_code}</Badge> : null}
          </div>

          {primary ? <ProductHeadline candidate={primary} /> : <h2 style={{ margin: 0 }}>{STATUS_TEXT[status] || status}</h2>}

          <p className="small" style={{ margin: '10px 0 0', maxWidth: '58ch' }}>
            {firstLine(primary?.reasons?.[0] || STATUS_EXPLAIN[status], 150)}
          </p>

          <div className="answer-actions">
            {p ? (
              <Link className="btn btn-primary" to={`/produits/${encodeURIComponent(p.id)}`}>See full datasheet</Link>
            ) : null}
            {candidates.filter((c) => c.resolution.product).length >= 2 ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onCompare?.(candidates.filter((c) => c.resolution.product).map((c) => c.productId))}
              >
                Compare options
              </button>
            ) : null}
            {onAdjust ? (
              <button type="button" className="btn btn-ghost" onClick={onAdjust}>Change an answer</button>
            ) : null}
          </div>

          {caution ? (
            <p className="tiny" style={{ margin: '12px 0 0', color: 'var(--status-warn-fg)', fontWeight: 800 }}>
              ⚠️ {blocking.length
                ? 'One detail is still missing before this can be confirmed.'
                : status === 'recommendation'
                  ? 'Double-check the notes below before you apply it.'
                  : 'An IDS specialist should confirm this case.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Details ----- */

function ProductDetails({ candidate }) {
  const p = candidate.resolution.product;
  if (!p) return null;
  const checks = candidate.checks.filter((c) => c.severity !== 'ok');
  return (
    <div className="stack" style={{ gap: 18 }}>
      <section>
        <h3>Why this product</h3>
        <ul className="bullets">
          {candidate.reasons.map((r, i) => <li key={i}>{r}</li>)}
          <li className="muted">
            Documented source: {originText(candidate.origin)}
            {candidate.origins.length > 1 ? ` (+ ${candidate.origins.length - 1} other documented source${candidate.origins.length > 2 ? 's' : ''})` : ''}.
          </li>
        </ul>
      </section>

      <section>
        <h3>Specifications</h3>
        <dl className="def-list">
          <dt>Temperature range</dt><dd>{p.temp_range || <Undocumented />}</dd>
          <dt>Maximum gap</dt><dd>{p.max_gap || <Undocumented />}</dd>
          <dt>Cure time</dt><dd>{p.cure_time || <Undocumented />}</dd>
          <dt>Viscosity</dt><dd>{p.viscosity || <Undocumented />}</dd>
          <dt>Chemistry</dt><dd>{p.chemistry || <Undocumented />}</dd>
          <dt>Colour</dt><dd>{p.color || <Undocumented />}</dd>
          <dt>Approvals</dt><dd>{(p.approvals || []).length ? p.approvals.join(' • ') : <Undocumented />}</dd>
          <dt>Limits</dt><dd>{p.limitations || <Undocumented />}</dd>
        </dl>
      </section>

      {checks.length ? (
        <section>
          <h3>Points to check</h3>
          <ul className="bullets">
            {checks.map((c, i) => (
              <li key={i}><Badge tone={CHECK_TONE[c.severity]}>{CHECK_TEXT[c.severity] || c.severity}</Badge> {c.message}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>No gap found between your answers and the documented limits.</p>
      )}

      {candidate.warnings.length ? (
        <section>
          <h3>Warnings that apply</h3>
          <div className="stack" style={{ gap: 10 }}>
            {candidate.warnings.map((w) => (
              <div key={w.warning_id} className={`alert alert-${String(w.severity).startsWith('CRITICAL') ? 'danger' : 'warn'}`}>
                <strong className="alert-title">{w.title}</strong>
                <div className="small">{w.description}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3>How to apply it</h3>
        <p>{p.usage_instructions || <Undocumented />}</p>
      </section>

      <section>
        <h3>Source documents</h3>
        {candidate.sources.length ? (
          <ul className="bullets">
            {candidate.sources.map((s) => (
              <li key={s.ref_id}>
                <span className="mono">{s.source_pdf}</span> — pages {s.pages_referenced || 'not stated'}
                <div className="muted tiny">{s.topic}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            No source reference cites this product explicitly. Its values come from products.json but are not tied to
            a page reference — confirm them with an IDS specialist.
          </p>
        )}
      </section>
    </div>
  );
}

function AlternativesTable({ candidates, primary }) {
  const alts = candidates.filter((c) => c.productId !== primary?.productId);
  if (!alts.length) return null;
  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="visually-hidden">Documented alternatives and when each one is preferable</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Role</th>
            <th scope="col">Match</th>
            <th scope="col">When to prefer it</th>
          </tr>
        </thead>
        <tbody>
          {alts.map((c) => {
            const p = c.resolution.product;
            return (
              <tr key={c.productId}>
                <td>
                  <strong>{p ? <Link to={`/produits/${encodeURIComponent(p.id)}`}>{p.name}</Link> : <span className="mono">{c.productId}</span>}</strong>
                  <div className="product-code">{p?.product_code}</div>
                </td>
                <td className="small">{ROLE_TEXT[c.role] || c.role}<div className="muted tiny">{originText(c.origin)}</div></td>
                <td><Badge tone={CANDIDATE_TONE[c.status]}>{CANDIDATE_TEXT[c.status]}</Badge></td>
                <td className="small">
                  {c.reasons.filter((r) => !r.startsWith('Documented alternative')).slice(0, 2).map((r, i) => <div key={i}>{r}</div>)}
                  {c.checks.filter((x) => x.severity !== 'ok').slice(0, 1).map((x, i) => (
                    <div key={i} className="muted"><Badge tone={CHECK_TONE[x.severity]}>{CHECK_TEXT[x.severity] || x.severity}</Badge> {x.message}</div>
                  ))}
                  {p?.limitations ? <div className="muted">Limit: {p.limitations}</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RuleTrace({ rule, answers, trace }) {
  if (!rule) return null;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <h3>Rule {rule.ruleId}</h3>
        <p className="small muted">{rule.condition}</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th scope="col">#</th><th scope="col">Documented condition</th><th scope="col">State</th><th scope="col">Product</th></tr>
            </thead>
            <tbody>
              {rule.branches.map((b, i) => (
                <tr key={i}>
                  <td className="mono">{i + 1}</td>
                  <td className="small">{Object.entries(b.if).map(([k, v]) => `${humaniseKey(k)} = ${v}`).join(' AND ')}</td>
                  <td>
                    <Badge tone={b.status === 'match' ? 'green' : b.status === 'partial' ? 'amber' : 'neutral'}>
                      {b.status === 'match' ? 'Met' : b.status === 'partial' ? 'Partial' : 'Not met'}
                    </Badge>
                    {b.failed.length ? <div className="muted tiny">Not met: {b.failed.map(humaniseKey).join(', ')}</div> : null}
                    {b.unknown.length ? <div className="muted tiny">Not answered: {b.unknown.map(humaniseKey).join(', ')}</div> : null}
                    {(b.substitutions || []).map((sub) => (
                      <div className="tiny" key={sub.key} style={{ color: 'var(--status-warn-fg)' }}>
                        Documented substitution ({humaniseKey(sub.key)}): “{sub.answer}” accepted for “{sub.branchValue}”.
                      </div>
                    ))}
                  </td>
                  <td className="small mono">
                    {b.thenProductId || '—'}{b.alternativeId ? ` / alt. ${b.alternativeId}` : ''}{b.topcoatId ? ` / topcoat ${b.topcoatId}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3>Decision log</h3>
        <ol className="small">
          {trace.map((t, i) => <li key={i}><strong>{t.step}</strong> — {t.detail}</li>)}
        </ol>
      </div>
      <div>
        <h3>Answers used</h3>
        <pre className="small mono" style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-muted)', padding: 12, borderRadius: 12, margin: 0 }}>
{JSON.stringify(answers, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Screen --- */

export default function AssessmentView({ result, onCompare, onAdjust, showTrace = true }) {
  if (!result) return null;
  const { status, primary, candidates, excluded, unavailable, missingInfo, conflicts, escalation, problem, application, rule, answers } = result;
  const noBranch = conflicts.filter((c) => c.type === 'AUCUNE_BRANCHE');
  const alternatives = candidates.filter((c) => c.productId !== primary?.productId);

  return (
    <div className="stack">
      <Verdict result={result} onCompare={onCompare} onAdjust={onAdjust} />

      {/* Safety and limits stay visible: brevity never wins over a warning. */}
      {escalation?.required && status !== 'recommendation' ? (
        <Alert tone="warn" title="Please confirm this one">
          <p style={{ margin: '0 0 6px' }}>
            Send this case to the <strong>{escalation.contact.team}</strong>. Everything they need is in the details.
          </p>
          <Reveal title="Why it needs a specialist" count={escalation.triggers.length}>
            <ul>{escalation.triggers.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Reveal>
        </Alert>
      ) : null}

      {primary?.warnings?.length ? (
        <Alert tone={primary.warnings.some((w) => String(w.severity).startsWith('CRITICAL')) ? 'danger' : 'warn'} title="Read before you apply">
          <ul>{primary.warnings.map((w) => <li key={w.warning_id}><strong>{w.title}</strong> — {firstLine(w.description, 120)}</li>)}</ul>
        </Alert>
      ) : null}

      {noBranch.map((c, i) => (
        <Alert key={i} tone="danger" title="The documentation does not cover this combination">
          <p style={{ margin: '0 0 6px' }}>{c.message}</p>
          <Reveal title="Which branches were checked" count={(c.detail || []).length}>
            <ul>
              {(c.detail || []).slice(0, 6).map((d, j) => (
                <li key={j}>
                  Branch {j + 1}: {Object.entries(d.if).map(([k, v]) => `${humaniseKey(k)} = ${v}`).join(' AND ')} — not met: {d.failed.map(humaniseKey).join(', ')}
                </li>
              ))}
            </ul>
          </Reveal>
        </Alert>
      ))}

      {primary ? (
        <Reveal title="Why this product, and how to use it" hint="specifications, checks, sources">
          <ProductDetails candidate={primary} />
        </Reveal>
      ) : (
        <Alert tone="warn" title="No product can be recommended from the available data">
          {status === 'produit_non_documente'
            ? 'The documented rules point to a product that has no datasheet in the catalogue, so it cannot be confirmed.'
            : 'Add the missing criteria, or ask an IDS specialist to review the case.'}
        </Alert>
      )}

      {missingInfo.length ? (
        <Reveal title="What is still unconfirmed" count={missingInfo.length}>
          <ul className="bullets">
            {missingInfo.map((m) => (
              <li key={m.key} style={{ marginBottom: 10 }}>
                <strong>{m.label}</strong>{' '}
                {m.blocking ? <Badge tone="red">Blocking</Badge> : m.safety ? <Badge tone="amber">Safety check</Badge> : <Badge tone="neutral">Check</Badge>}
                <div className="muted small">{m.question}</div>
                {m.couldResolve?.length ? <div className="tiny muted">Would settle: {m.couldResolve.join(', ')}</div> : null}
              </li>
            ))}
          </ul>
          {onAdjust ? <button type="button" className="btn btn-primary btn-sm no-print" onClick={onAdjust}>Answer these</button> : null}
        </Reveal>
      ) : null}

      {alternatives.length ? (
        <Reveal title="Other documented options" count={alternatives.length} hint="and when to prefer them">
          <p className="small muted" style={{ marginTop: 0 }}>
            No ranking is applied. Each option is shown with its documented source and the conditions under which it
            is the better choice.
          </p>
          <AlternativesTable candidates={candidates} primary={primary} />
        </Reveal>
      ) : null}

      {excluded.length ? (
        <Reveal title="Ruled out by their own limits" count={excluded.length}>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Product</th><th scope="col">Reason</th></tr></thead>
              <tbody>
                {excluded.map((c) => (
                  <tr key={c.productId}>
                    <td>{c.resolution.product ? <Link to={`/produits/${encodeURIComponent(c.productId)}`}>{c.resolution.product.name}</Link> : <span className="mono">{c.productId}</span>}</td>
                    <td className="small">
                      {c.checks.filter((x) => x.severity === 'exclusion').map((x, i) => <div key={i}>{x.message}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      ) : null}

      {unavailable.length ? (
        <Reveal title="Cited products with no datasheet" count={unavailable.length} hint="they cannot be confirmed">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Reference</th><th scope="col">Likely designation</th><th scope="col">Cited by</th></tr></thead>
              <tbody>
                {unavailable.map((c) => (
                  <tr key={c.productId}>
                    <td className="mono">{c.productId}</td>
                    <td className="small">{c.resolution.hint || '—'}</td>
                    <td className="small muted">{(c.resolution.references || []).map((r) => `${r.dataset}/${r.recordId}`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      ) : null}

      {problem || application ? (
        <Reveal title="The documented case behind this answer" count={[problem, application].filter(Boolean).length}>
          <div className="stack" style={{ gap: 16 }}>
            {problem ? (
              <div>
                <h3>{problem.title}</h3>
                <dl className="def-list">
                  <dt>Symptoms</dt><dd>{problem.symptoms || <Undocumented />}</dd>
                  <dt>Root cause</dt><dd>{problem.root_cause || <Undocumented />}</dd>
                  <dt>Selection criterion</dt><dd>{problem.selection_criteria || <Undocumented />}</dd>
                  <dt>Documented procedure</dt><dd>{problem.procedure || <Undocumented />}</dd>
                </dl>
              </div>
            ) : null}
            {application ? (
              <div>
                <h3>{application.title}</h3>
                <p className="small">{application.description}</p>
                {application.subApplications?.length ? (
                  <div className="chips">
                    {application.subApplications.map((sub) => <span key={sub} className="badge badge-blue">{sub}</span>)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Reveal>
      ) : null}

      {showTrace ? (
        <Reveal title="How we got this answer" hint={rule ? `rule ${rule.ruleId}` : undefined}>
          <RuleTrace rule={rule} answers={answers} trace={result.trace} />
        </Reveal>
      ) : null}
    </div>
  );
}
