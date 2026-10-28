import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { Alert, Badge, ErrorState, Loading, SectionTitle } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDate } from '../ui-text.js';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'errors', label: 'Blocking errors' },
  { key: 'warnings', label: 'Warnings' },
  { key: 'references', label: 'Missing references' },
  { key: 'rules', label: 'Rules & questions' },
  { key: 'unresolved', label: 'Open points' },
];

export default function DataQuality() {
  const [tab, setTab] = useState('overview');
  const toast = useToast();
  const status = useApi(() => api.datasetStatus(), []);
  const [reloading, setReloading] = useState(false);

  const reload = async () => {
    setReloading(true);
    try {
      const res = await api.reloadDatasets();
      toast.push({
        title: 'Datasets reloaded',
        message: `Version ${res.dataVersion} — ${res.errors} error(s), ${res.warnings} warning(s).`,
      });
      status.reload();
    } catch (err) {
      toast.push({ tone: 'error', title: 'Reload failed', message: err.message });
    } finally {
      setReloading(false);
    }
  };

  if (status.loading) return <div className="container"><Loading label="Validating the datasets…" /></div>;
  if (status.error) return <div className="container"><ErrorState error={status.error} onRetry={status.reload} /></div>;
  const d = status.data;
  if (!d) return null;

  const issues = d.issues || {};

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Technical control</div>
          <h1>Data quality</h1>
          <p className="lead">
            {d.errors.length
              ? `${d.errors.length} open points, mostly products the documentation cites without a datasheet. The guide never turns one of those into a confirmed answer.`
              : 'Nothing blocking: every dataset loaded and resolved cleanly.'}
          </p>
        </div>
        <div className="row no-print">
          <button type="button" className="btn btn-outline" onClick={reload} disabled={reloading}>
            {reloading ? 'Reloading…' : 'Reload datasets'}
          </button>
        </div>
      </div>

      <div className="grid grid-4 mb-3">
        <StatCard label="Products" value={d.stats.products} sub="products.json" />
        <StatCard label="Rules / branches" value={`${d.stats.selection_rules} / ${d.stats.rule_branches}`} sub="selection_rules.json" />
        <StatCard label="Blocking errors" value={d.errors.length} sub="handled by the guide" tone={d.errors.length ? 'red' : 'ok'} />
        <StatCard label="Warnings" value={d.warnings.length} sub="to review" tone="warn" />
      </div>

      <div className="tabs" role="tablist" aria-label="Data quality sections">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'errors' && d.errors.length ? ` (${d.errors.length})` : ''}
            {t.key === 'warnings' && d.warnings.length ? ` (${d.warnings.length})` : ''}
            {t.key === 'references' && issues.missingProducts?.length ? ` (${issues.missingProducts.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="stack">
          <div className="card">
            <SectionTitle level={2}>Datasets analysed</SectionTitle>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th scope="col">Dataset</th><th scope="col">Records</th><th scope="col">Errors</th><th scope="col">Warnings</th></tr></thead>
                <tbody>
                  {Object.entries(d.stats).filter(([, v]) => typeof v === 'number').map(([k, v]) => (
                    <tr key={k}>
                      <td className="mono small">{k}.json</td>
                      <td>{v}</td>
                      <td>{d.errors.filter((e) => e.dataset === k).length}</td>
                      <td>{d.warnings.filter((w) => w.dataset === k).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted mt-1">
              Data version <span className="mono">{d.dataVersion}</span> · source <span className="mono">{d.dataSource}</span> ·
              validated {formatDate(d.loadedAt)}
            </p>
          </div>

          <div className="card">
            <div className="mascot-figure">
              <Mascot pose={d.ok ? 'success' : 'error'} size={132} decorative />
              <div className="mascot-figure__body">
                <h2 style={{ marginBottom: 6 }}>{d.ok ? 'Structure check passed' : 'Structure check finished with issues'}</h2>
                <p className="small" style={{ margin: 0 }}>
                  {d.ok
                    ? 'No blocking error was found in the datasets.'
                    : `${d.errors.length} issue(s) detected — mostly product references with no catalogue record, plus one questionnaire branch with no follow-up. The guide never recommends a product without a datasheet.`}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <SectionTitle level={2}>What the guide does when data is imperfect</SectionTitle>
            <ul className="bullets small">
              <li>A <strong>missing product reference</strong> is never shown as a confirmed recommendation: it is listed as “referenced product with no datasheet”.</li>
              <li>A <strong>questionnaire branch without a follow-up</strong> is flagged and the guide stops with a request for specialist verification.</li>
              <li><strong>Conflicting sources</strong> (rule / question / problem) are displayed side by side, with no arbitrary arbitration.</li>
              <li>A <strong>non-numeric technical value</strong> (“Putty”, “Ambient”) is never compared automatically.</li>
              <li>A <strong>critical warning</strong> (oxygen, thermoplastics) removes the product from the recommendation.</li>
            </ul>
          </div>
        </div>
      ) : null}

      {tab === 'errors' ? <IssueList items={d.errors} empty="No blocking errors." pose="success" /> : null}
      {tab === 'warnings' ? <IssueList items={d.warnings} empty="No warnings." pose="success" /> : null}

      {tab === 'references' ? (
        <div className="stack">
          <Alert tone="warn" title={`${issues.missingProducts.length} product references are cited without a catalogue record`}>
            The datasets cite <strong>{d.stats.resolved_product_references + d.stats.missing_product_references}</strong> product
            references, of which <strong>{d.stats.missing_product_references}</strong> distinct references are absent from
            <span className="mono"> products.json</span>. They cannot be detailed, compared or recommended as confirmed matches,
            and no specification has been invented to fill the gap.
          </Alert>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Reference</th><th scope="col">Cited by</th><th scope="col">Consequence</th></tr></thead>
              <tbody>
                {issues.missingProducts.map((m) => (
                  <tr key={m.productId}>
                    <td className="mono">{m.productId}</td>
                    <td className="small">
                      {m.references.map((r, i) => (
                        <div key={i}>{r.dataset} → <span className="mono">{r.recordId}</span> ({r.field})</div>
                      ))}
                    </td>
                    <td className="small">
                      {m.references.some((r) => r.dataset === 'selection_rules')
                        ? 'A documented rule points to this product: the result is flagged “product not in the catalogue”.'
                        : 'Alternative or featured product that cannot be opened.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'rules' ? (
        <div className="stack">
          {issues.danglingNext?.length ? (
            <Alert tone="danger" title="Question with no documented follow-up">
              <ul>
                {issues.danglingNext.map((x, i) => (
                  <li key={i}>
                    <span className="mono">{x.questionId}</span> → answer “{x.label}” points to <span className="mono">{x.next}</span>,
                    which does not exist in decision_questions.json. No rule or question can continue the flow, so the assistant asks for specialist verification.
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {issues.ruleIssues?.length ? <IssueList items={issues.ruleIssues} empty="No rule anomalies." pose="success" /> : null}
          {issues.orphanProducts?.length ? (
            <Alert tone="warn" title="Products with no documented link">
              {issues.orphanProducts.join(', ')} — no rule, problem, application or question references them. Surface-preparation
              products are expected here: they are used alongside a solution, not as a solution.
            </Alert>
          ) : null}
          <div className="card">
            <SectionTitle level={2}>Rule branches that cannot be satisfied with the current data</SectionTitle>
            <p className="small">
              The following conditions refer to products that are not in the catalogue, or to criteria the
              questionnaire does not collect. They are still evaluated, but they cannot end in a confirmed recommendation.
            </p>
            <ul className="bullets small">
              {(issues.ruleIssues || []).filter((r) => r.type === 'NO_PRODUCT').map((r, i) => (
                <li key={i}>{r.ruleId} branch {r.branch + 1} — {r.message}</li>
              ))}
              {!(issues.ruleIssues || []).filter((r) => r.type === 'NO_PRODUCT').length ? <li className="muted">None.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === 'unresolved' ? (
        <div className="stack">
          <Alert tone="info" title="Open points recorded in the source documentation">
            These come from <span className="mono">unresolved_items.json</span>. The guide has not resolved them, and no
            value has been chosen arbitrarily.
          </Alert>
          {(d.unresolvedItems || []).map((u) => (
            <div className="card" key={u.item_id}>
              <div className="row-between mb-1">
                <h3>{u.field}</h3>
                <Badge tone="amber">{u.item_id}</Badge>
              </div>
              <p className="small">{u.issue_description}</p>
              <p className="small"><strong>Action required:</strong> {u.action_required}</p>
              <p className="small muted">Documents involved: {(u.documents_involved || []).join(' · ')}</p>
            </div>
          ))}
          {issues.productsWithoutSources?.length ? (
            <Alert tone="warn" title="Products with no linked source document">
              {issues.productsWithoutSources.length} catalogue product(s) are not cited by any document in
              <span className="mono"> source_references.json</span>: {issues.productsWithoutSources.join(', ')}.
              Check their specifications against the Henkel datasheet before use.
              <div className="mt-1"><Link to="/catalogue">Browse the catalogue</Link></div>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, sub, tone = 'neutral' }) {
  const color = tone === 'red' ? 'var(--brand-red)' : tone === 'warn' ? 'var(--status-warn-fg)' : 'var(--text)';
  return (
    <div className="card card-tight">
      <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, color, lineHeight: 1.1, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div className="tiny muted">{sub}</div>
    </div>
  );
}

function IssueList({ items, empty, pose = 'error' }) {
  if (!items?.length) {
    return (
      <div className="card">
        <div className="state-block" style={{ padding: '20px' }}>
          <Mascot pose={pose} size={104} decorative />
          <p className="small">{empty}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      {items.map((e, i) => (
        <div className="card card-tight" key={i}>
          <div className="row-between">
            <span className="code">{e.code}</span>
            <span className="tiny muted">{e.dataset}{e.path ? ` / ${e.path}` : ''}</span>
          </div>
          <p className="small" style={{ margin: '6px 0 0' }}>{e.message}</p>
        </div>
      ))}
    </div>
  );
}
