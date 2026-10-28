import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { ToastProvider } from './Toast.jsx';
import { APP, formatDate } from '../ui-text.js';
/* Same artwork as the supplied ids_logo_light.png, re-inked for a white header:
   the file name says “light” for a light *mark* on a dark background. */
import logo from '../../ids_logo_dark.png';

/** Five things clients actually do. Everything else lives under “More”. */
const PRIMARY_NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/selection', label: 'Find a product', icon: '🧭' },
  { to: '/recherche', label: 'Search', icon: '🔍' },
  { to: '/catalogue', label: 'Products', icon: '🧴' },
  { to: '/comparer', label: 'Compare', icon: '⚖️' },
];

const SECONDARY_NAV = [
  { to: '/problemes', label: 'Problems & solutions', icon: '🛠️' },
  { to: '/qualite-donnees', label: 'Data quality', icon: '📋' },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const health = useApi(() => api.health(), []);
  const dataIssues = health.data?.dataErrors || 0;

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A route change on a long page should start at the top of the new screen.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [location.pathname]);

  const menuLinks = [...PRIMARY_NAV.filter((n) => !n.end), ...SECONDARY_NAV];

  return (
    <ToastProvider>
      <div className="shell">
        <a className="skip-link" href="#main-content">Skip to main content</a>

        <header className="header">
          <div className="header-inner">
            <Link to="/" className="brand" aria-label="IDS — Loctite Product Selection Guide, back to home">
              <img src={logo} alt="Industrial Development Solutions" className="brand-logo" />
              <span className="brand-text">
              </span>
            </Link>

            <nav className="nav" aria-label="Primary">
              {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                  {item.to === '/qualite-donnees' && dataIssues ? (
                    <span className="nav-badge" aria-label={`${dataIssues} data issues detected`}>!</span>
                  ) : null}
                </NavLink>
              ))}
            </nav>

            <div className="header-actions">
              <button
                type="button"
                className="nav-toggle icon-btn"
                aria-expanded={open}
                aria-controls="more-navigation"
                aria-label={open ? 'Close the menu' : 'Open the menu'}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? '✕' : '☰'}
              </button>
            </div>
          </div>

          <div id="more-navigation" className={`nav-sheet ${open ? 'open' : ''}`}>
            <nav className="nav" aria-label="More sections">
              {menuLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <span aria-hidden="true">{item.icon}</span> {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="main" id="main-content">
          <Outlet />
        </main>

        <footer className="footer">
          <div className="footer-inner">
            <div>
              <strong>{APP.company}</strong> — {APP.name}. Recommendations come only from the supplied technical
              datasets. Loctite® is a trademark of Henkel AG &amp; Co. KGaA.
            </div>
            <div className="tiny">
              {health.data ? (
                <>
                  Data version <span className="mono">{health.data.dataVersion}</span> ·{' '}
                  {health.data.products} products · last analysed {formatDate(health.data.dataLoadedAt)}
                </>
              ) : null}
            </div>
          </div>
        </footer>

        {/* The tablet's main way in: five thumb-sized destinations, always visible. */}
        <nav className="tabbar" aria-label="Main sections">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `tabbar__link ${isActive ? 'active' : ''}`}
            >
              <span className="tabbar__icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        </div>
    </ToastProvider>
  );
}
