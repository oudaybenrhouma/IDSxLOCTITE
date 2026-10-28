import React from 'react';
import { Mascot } from './Mascot.jsx';

export const Badge = ({ tone = 'neutral', children, title }) => (
  <span className={`badge badge-${tone}`} title={title}>{children}</span>
);

/**
 * The heart of the “simple by default” layout: anything a client does not need
 * in order to act is folded into one of these. The summary is always visible,
 * the detail opens on a tap inside a 48 px target.
 */
export const Reveal = ({ title, children, open = false, count, hint, flat = false, className = '' }) => (
  <details className={`disclose ${flat ? 'disclose--flat' : ''} ${className}`} open={open}>
    <summary>
      <span>{title}</span>
      {count !== undefined && count !== null ? <span className="badge badge-outline">{count}</span> : null}
      {hint ? <span className="tiny muted" style={{ marginLeft: 4 }}>{hint}</span> : null}
    </summary>
    <div className="disclose__body">{children}</div>
  </details>
);

/**
 * Loading state. The mascot works the problem while the request runs; with
 * `prefers-reduced-motion` he holds still (handled in CSS).
 */
export const Loading = ({ label = 'Loading the technical data…', size = 96 }) => (
  <div className="loading" role="status" aria-live="polite">
    <Mascot pose="loading" size={size} decorative />
    <div className="loading-row">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  </div>
);

export const SkeletonCards = ({ count = 3 }) => (
  <div className="grid grid-3" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div className="card" key={i}>
        <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 10, width: '100%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '85%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '60%' }} />
      </div>
    ))}
  </div>
);

/** Empty state: says what is missing and offers the next action. */
export const EmptyState = ({ title, children, action, size = 140 }) => (
  <div className="card">
    <div className="state-block">
      <Mascot pose="empty" size={size} alt="IDS robot mascot holding an empty box" />
      <h3>{title}</h3>
      {children ? <p className="small">{children}</p> : null}
      {action ? <div className="row" style={{ justifyContent: 'center' }}>{action}</div> : null}
    </div>
  </div>
);

/** Success state: confirms what actually happened. */
export const SuccessState = ({ title, children, action }) => (
  <div className="card">
    <div className="state-block">
      <Mascot pose="success" size={140} alt="IDS robot mascot jumping with both fists raised" />
      <h3>{title}</h3>
      {children ? <p className="small">{children}</p> : null}
      {action ? <div className="row" style={{ justifyContent: 'center' }}>{action}</div> : null}
    </div>
  </div>
);

/**
 * Error state: what went wrong, what to do next, and a reference code for the
 * support call — nothing more.
 */
export const ErrorState = ({ error, title, children, onRetry, action, size = 140 }) => (
  <div className="card">
    <div className="state-block">
      <Mascot pose="error" size={size} alt="IDS robot mascot scratching its head with a snapped spanner" />
      <h3>{title || 'That did not work'}</h3>
      <p className="small">
        {children || error?.message || 'The request could not be completed.'}{' '}
        {onRetry ? 'Try again — if it keeps failing, an IDS specialist can look at it with you.' : null}
      </p>
      {error?.code ? <p className="tiny muted mono">Reference: {error.code}</p> : null}
      <div className="row" style={{ justifyContent: 'center' }}>
        {onRetry ? <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button> : null}
        {action}
      </div>
    </div>
  </div>
);

const ALERT_ICON = { info: 'ℹ️', warn: '⚠️', danger: '⛔', success: '✅' };

export const Alert = ({ tone = 'info', title, children }) => (
  <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'note'}>
    {title ? (
      <strong className="alert-title">
        <span aria-hidden="true">{ALERT_ICON[tone] || 'ℹ️'} </span>
        {title}
      </strong>
    ) : null}
    <div className="small">{children}</div>
  </div>
);

export const SectionTitle = ({ level = 2, children, aside }) => {
  const Tag = `h${level}`;
  return (
    <div className="section-title">
      <Tag>{children}</Tag>
      <span className="rule" aria-hidden="true" />
      {aside}
    </div>
  );
};

export const Undocumented = () => <span className="cell-undocumented">Not documented</span>;

export const Field = ({ label, hint, htmlFor, children }) => (
  <div>
    {label ? <label className="label" htmlFor={htmlFor} style={{ display: 'block', marginBottom: 6 }}>{label}</label> : null}
    {children}
    {hint ? <div className="hint" style={{ marginTop: 4 }}>{hint}</div> : null}
  </div>
);

export const VisuallyHidden = ({ children }) => <span className="visually-hidden">{children}</span>;
