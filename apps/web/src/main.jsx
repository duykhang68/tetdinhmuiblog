import React, {Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import './article.css';
import './editor-kit.css';

// Route-level code splitting keeps the quality dashboard independent from the editor UI.
const Editor = lazy(() => import('./App.jsx'));
const QualityGate = lazy(() => import('./QualityGateInsights.jsx'));
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const Page = pathname === '/quality-gate' ? QualityGate : Editor;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b1422',color:'#a8f3d2',fontFamily:'system-ui'}}>Đang mở workspace…</div>}>
      <Page/>
    </Suspense>
  </React.StrictMode>
);
