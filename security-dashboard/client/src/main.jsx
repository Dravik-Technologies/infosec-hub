import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initMASHDom } from './app.js';

// Wire up DOM event listeners for modal, notifications, etc.
initMASHDom();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('%c✦ MASH v2.5.0 — MTSI Advanced Sentinel Hub', 'color:#c9a84c;font-family:Space Grotesk;font-size:13px;font-weight:700');
