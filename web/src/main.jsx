import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, useRouteError, Link } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { Mascot } from './components/Mascot.jsx';
import Home from './pages/Home.jsx';
import GuidedSelection from './pages/GuidedSelection.jsx';
import Search from './pages/Search.jsx';
import Catalogue from './pages/Catalogue.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Compare from './pages/Compare.jsx';
import Problems from './pages/Problems.jsx';
import DataQuality from './pages/DataQuality.jsx';
import './styles.css';

function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="container container-narrow">
      <div className="card">
        <div className="state-block">
          <Mascot pose="error" size={150} alt="IDS robot mascot scratching its head with a snapped spanner" />
          <h1>This screen did not load</h1>
          <p className="small">{String(error?.message || error?.statusText || 'An unexpected error occurred.')}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to="/">Back to home</Link>
            <Link className="btn btn-outline" to="/catalogue">Open the catalogue</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="container container-narrow">
      <div className="card">
        <div className="state-block">
          <Mascot pose="error" size={150} alt="IDS robot mascot scratching its head with a snapped spanner" />
          <h1>There is no page at this address</h1>
          <p className="small">
            The link may be out of date. Everything in the guide is reachable from the navigation below.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to="/">Go to home</Link>
            <Link className="btn btn-outline" to="/catalogue">Open the catalogue</Link>
            <Link className="btn btn-ghost" to="/selection">Start guided selection</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <Home /> },
      { path: 'selection', element: <GuidedSelection /> },
      { path: 'recherche', element: <Search /> },
      { path: 'catalogue', element: <Catalogue /> },
      { path: 'produits/:id', element: <ProductDetail /> },
      { path: 'comparer', element: <Compare /> },
      { path: 'problemes', element: <Problems /> },
      { path: 'qualite-donnees', element: <DataQuality /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
