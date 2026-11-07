import React, {Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import './article.css';
import './editor-kit.css';

// Render the Editor directly on the homepage, as before.
// Keep Quality Gate on its own lazy route without a visible loading screen.
const QualityGate = lazy(() => import('./QualityGateInsights.jsx'));
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const isQualityGate = pathname === '/quality-gate';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isQualityGate ? <Suspense fallback={null}><QualityGate/></Suspense> : <App/>}
  </React.StrictMode>
);
