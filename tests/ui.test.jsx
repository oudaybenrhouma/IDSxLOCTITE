// @vitest-environment jsdom
/**
 * UI tests (the real React pages rendered against the real API).
 * Checks that every screen renders with the supplied datasets, that the
 * empty/error states work, and that the guided flow stays usable.
 */
import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4297;
const BASE = `http://127.0.0.1:${PORT}`;
let proc;

const realFetch = global.fetch;
global.fetch = (input, init) => {
  const url = typeof input === 'string' ? new URL(input, BASE).toString() : input;
  return realFetch(url, init);
};

const Layout = (await import('../web/src/components/Layout.jsx')).default;
const Home = (await import('../web/src/pages/Home.jsx')).default;
const GuidedSelection = (await import('../web/src/pages/GuidedSelection.jsx')).default;
const Catalogue = (await import('../web/src/pages/Catalogue.jsx')).default;
const Search = (await import('../web/src/pages/Search.jsx')).default;
const Compare = (await import('../web/src/pages/Compare.jsx')).default;
const Problems = (await import('../web/src/pages/Problems.jsx')).default;
const DataQuality = (await import('../web/src/pages/DataQuality.jsx')).default;
const ProductDetail = (await import('../web/src/pages/ProductDetail.jsx')).default;

const renderRoute = (routePath, Component, initial = routePath) => {
  const router = createMemoryRouter(
    [{ path: '/', element: <Layout />, children: [{ path: routePath === '/' ? '/' : routePath.slice(1), element: <Component /> }] }],
    { initialEntries: [initial] }
  );
  return render(<RouterProvider router={router} />);
};

beforeAll(async () => {
  proc = spawn('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The UI test server did not start')), 20000);
    proc.stdout.on('data', (c) => { if (c.toString().includes('API ready')) { clearTimeout(timer); resolve(); } });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Server stopped (exit ${code})`)); });
  });
});

afterAll(() => {
  cleanup();
  if (proc) proc.kill('SIGTERM');
});

describe('Screen rendering', () => {
  it('Home: shows the title, the brand header, the navigation and the dataset metrics', async () => {
    renderRoute('/', Home);
    expect(await screen.findByRole('heading', { level: 1, name: /Right Loctite product, first time/i })).toBeTruthy();
    // IDS brand header + primary navigation
    expect(screen.getByRole('link', { name: /back to home/i }).textContent).toMatch(/Loctite Selection Guide/);
    expect(screen.getByRole('navigation', { name: /Primary/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('products documented')).toBeTruthy());
    cleanup();
  });

  it('Catalogue: lists the 21 products and flags the missing references', async () => {
    const { container } = renderRoute('/catalogue', Catalogue);
    await waitFor(() => expect(container.querySelectorAll('a.product-card').length).toBe(21));
    expect(container.textContent).toMatch(/References with no datasheet/i);
    cleanup();
  });

  it('Catalogue: filters by search term', async () => {
    const { container } = renderRoute('/catalogue', Catalogue);
    await waitFor(() => expect(container.querySelectorAll('a.product-card').length).toBe(21));
    const input = screen.getByPlaceholderText(/Filter by name, code or property/i);
    fireEvent.change(input, { target: { value: 'retaining' } });
    await waitFor(() => {
      const n = container.querySelectorAll('a.product-card').length;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(21);
    });
    cleanup();
  });

  it('Product page: shows the specifications, the warnings and the sources', async () => {
    const { container } = renderRoute('/produits/:id', ProductDetail, '/produits/PROD_243');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /LOCTITE® 243/i })).toBeTruthy());
    expect(container.textContent).toMatch(/-55°C to \+180°C/);
    expect(container.textContent).toMatch(/Full specifications/);
    expect(container.textContent).toMatch(/Sources and traceability/);
    cleanup();
  });

  it('Product page for a reference with no datasheet: explicit screen, no invented data', async () => {
    const { container } = renderRoute('/produits/:id', ProductDetail, '/produits/PROD_SI5699');
    await waitFor(() => expect(container.textContent).toMatch(/We have no datasheet for this one/i));
    expect(container.textContent).toMatch(/products\.json/);
    expect(container.textContent).not.toMatch(/Continuous service temperature/);
    cleanup();
  });

  it('Search: finds a product by its code', async () => {
    const { container } = renderRoute('/recherche', Search);
    await waitFor(() => expect(container.textContent).toMatch(/results?/i));
    const input = screen.getByLabelText(/Search products/i);
    fireEvent.change(input, { target: { value: '660' } });
    await waitFor(() => expect(container.textContent).toMatch(/LOCTITE® 660/i), { timeout: 4000 });
    cleanup();
  });

  it('Compare: renders a table with the original values and “Not documented”', async () => {
    const { container } = renderRoute('/comparer', Compare, '/comparer?ids=PROD_638,PROD_648');
    await waitFor(() => expect(container.textContent).toMatch(/Documented maximum gap/i), { timeout: 4000 });
    expect(container.textContent).toMatch(/0\.010 inch \(0\.25 mm\) radial/);
    expect(container.textContent).toMatch(/Warnings/);
    cleanup();
  });

  it('Problems: lists the documented problems and their solutions', async () => {
    const { container } = renderRoute('/problemes', Problems);
    await waitFor(() => expect(container.textContent).toMatch(/Bolts loosening due to vibration/i));
    await waitFor(() => expect(container.textContent).toMatch(/Warnings and limitations/), { timeout: 5000 });
    cleanup();
  });

  it('Data quality: shows the blocking errors and the missing references', async () => {
    const { container } = renderRoute('/qualite-donnees', DataQuality);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /Data quality/i })).toBeTruthy());
    await waitFor(() => expect(container.textContent).toMatch(/Products/));
    const refsTab = screen.getByRole('tab', { name: /Missing references/i });
    fireEvent.click(refsTab);
    await waitFor(() => expect(container.textContent).toMatch(/PROD_SI5699/));
    cleanup();
  });
});

describe('Guided flow (interface)', () => {
  it('offers the starting points and then the documented applications', async () => {
    const { container } = renderRoute('/selection', GuidedSelection);
    await waitFor(() => expect(container.textContent).toMatch(/Something is wrong/i));
    expect(container.textContent).toMatch(/I know the type of job/i);
    cleanup();
  });

  it('runs Q1 → Q2 and then shows a traceable recommendation', async () => {
    const { container } = renderRoute('/selection', GuidedSelection);
    await waitFor(() => expect(container.textContent).toMatch(/I know the type of job/i));
    fireEvent.click(screen.getByRole('button', { name: /I know the type of job/i }));
    const q1Option = await screen.findByRole('button', { name: /Locking threaded fasteners/i });
    fireEvent.click(q1Option);
    // Q2 is displayed, with its documented wording
    await waitFor(() => expect(container.textContent).toMatch(/fastener size and required disassembly/i), { timeout: 5000 });
    const q2Option = (await screen.findAllByRole('button', { name: /Standard bolts\/nuts \(M6 to M20\)/i }))[0];
    fireEvent.click(q2Option);
    await waitFor(() => expect(container.textContent).toMatch(/Recommendation ready/i), { timeout: 5000 });
    expect(container.textContent).toMatch(/RULE_THREADLOCKING_STRENGTH/);
    expect(container.textContent).toMatch(/Recommendation ready|Confirm|Needs checking|to verify/i);
    cleanup();
  });

  it('flags the branch that has no documented questionnaire (structural bonding)', async () => {
    const { container } = renderRoute('/selection', GuidedSelection);
    await waitFor(() => expect(container.textContent).toMatch(/I know the type of job/i));
    fireEvent.click(screen.getByRole('button', { name: /I know the type of job/i }));
    await waitFor(() => expect(container.textContent).toMatch(/Structural bonding/i));
    // The label appears twice: the Q1 option and the documented-application shortcut
    fireEvent.click(screen.getAllByRole('button', { name: /Structural bonding of metals/i })[0]);
    await waitFor(() => expect(container.textContent).toMatch(/Not enough information yet/i), { timeout: 5000 });
    expect(container.textContent).toMatch(/IDS specialist|Needs checking|escalat/i);
    cleanup();
  });
});

describe('Tablet layout and “simple by default” contract', () => {
  it('exposes the bottom tab bar and the primary header navigation', async () => {
    const { container } = renderRoute('/', Home);
    expect(screen.getByRole('navigation', { name: /Main sections/i })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /Primary/i })).toBeTruthy();
    // Five thumb-sized destinations, no more.
    const tabbar = screen.getByRole('navigation', { name: /Main sections/i });
    expect(tabbar.querySelectorAll('a').length).toBe(5);
    cleanup();
  });

  it('keeps the result answer-first: the product is visible, the detail is folded away', async () => {
    const { container } = renderRoute('/selection', GuidedSelection);
    await waitFor(() => expect(container.textContent).toMatch(/I know the type of job/i));
    fireEvent.click(screen.getByRole('button', { name: /I know the type of job/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Locking threaded fasteners/i }));
    const q2Option = (await screen.findAllByRole('button', { name: /Standard bolts\/nuts \(M6 to M20\)/i }))[0];
    fireEvent.click(q2Option);
    await waitFor(() => expect(container.textContent).toMatch(/Recommendation ready/i), { timeout: 5000 });
    // The headline product and the action buttons are on screen…
    expect(screen.getByRole('link', { name: /See full datasheet/i })).toBeTruthy();
    // …while the technical detail sits in a closed disclosure.
    const details = [...container.querySelectorAll('details.disclose')];
    expect(details.length).toBeGreaterThan(0);
    const folded = details.find((d) => d.textContent.includes('Why this product, and how to use it'));
    expect(folded).toBeTruthy();
    expect(folded.open).toBe(false);
    cleanup();
  });
});

describe('Light theme only', () => {
  it('no dark-theme toggle is offered and nothing sets data-theme', async () => {
    const { container } = renderRoute('/', Home);
    await waitFor(() => expect(screen.getByText('products documented')).toBeTruthy());
    expect(container.textContent).not.toMatch(/\bDark\b|\bLight\b|\bAuto\b/);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    cleanup();
  });

  it('the IDS wordmark is rendered as transparent artwork, without a plate', async () => {
    const { container } = renderRoute('/', Home);
    const logo = await waitFor(() => {
      const img = container.querySelector('img.brand-logo');
      expect(img).toBeTruthy();
      return img;
    });
    expect(logo.getAttribute('src')).toMatch(/ids_logo_(dark|light)/);
    expect(logo.getAttribute('alt')).toMatch(/Industrial Development Solutions/i);
    cleanup();
  });
});
