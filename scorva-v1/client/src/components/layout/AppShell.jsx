import { useState } from 'react';
import Sidebar from './Sidebar';
import Header  from './Header';

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-scorva-bg">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
