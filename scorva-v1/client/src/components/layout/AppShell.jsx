import { useState } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="sc-shell">
      <div className="sc-shell-grid cyber-grid">
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
        <main className="sc-main">
          <div className="sc-main-chrome">
            <div className="sc-main-glow sc-main-glow-a" />
            <div className="sc-main-glow sc-main-glow-b" />
            <div className="sc-main-grid" />
            <div className="sc-main-inner page-enter">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
