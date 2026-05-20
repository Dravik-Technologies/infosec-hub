import { useState, useEffect, useCallback } from 'react';
import { AUTH, API, MASH, fmtDate } from './app.js';
import Header from './components/Header.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardSection from './pages/DashboardSection.jsx';
import SitesSection from './pages/SitesSection.jsx';
import EmployeesSection from './pages/EmployeesSection.jsx';
import DocumentsSection from './pages/DocumentsSection.jsx';
import ComplianceSection from './pages/ComplianceSection.jsx';
import BudgetSection from './pages/BudgetSection.jsx';
import TimelineSection from './pages/TimelineSection.jsx';
import ConstructionSection from './pages/ConstructionSection.jsx';
import RisksSection from './pages/RisksSection.jsx';
import SiteDetailPage from './pages/SiteDetailPage.jsx';
import CustomTrackersSection from './pages/CustomTrackersSection.jsx';

const EMPTY_DATA = {
  sites: [], risks: [], budget: {}, timeline: {}, compliance: {},
  activity: [], settings: {}, milestones: [], construction: [],
  employees: [], documents: [],
  lessons: [], assets: [], trackers: [], cisoNotes: [],
  selfInspections: [], dcsaInspections: [],
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    // Priority 1: already have a stored session
    const stored = AUTH.getUser();
    if (stored) return stored;
    // Priority 2: arriving via hub SSO redirect (?mash_token=<jwt>)
    const params   = new URLSearchParams(window.location.search);
    const ssoToken = params.get('mash_token');
    const ssoError = params.get('sso_error');
    if (ssoToken) {
      try {
        const b64    = ssoToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
        const payload = JSON.parse(atob(padded));
        AUTH.setToken(ssoToken);
        AUTH.setUser(payload);
        setTimeout(() => window.history.replaceState({}, '', '/'), 0);
        return payload;
      } catch { /* malformed token — fall through to login */ }
    }
    if (ssoError) {
      setTimeout(() => {
        MASH.toast(`SSO error: ${decodeURIComponent(ssoError)}`, 'error');
        window.history.replaceState({}, '', '/');
      }, 500);
    }
    return null;
  });

  const [section,        setSection]        = useState('dashboard');
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [data,           setData]           = useState(EMPTY_DATA);
  const [loaded,  setLoaded]  = useState(false);
  const [tick,    setTick]    = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  function handleLogin(user)  { setCurrentUser(user); }
  function handleLogout()     { AUTH.clearAll(); setCurrentUser(null); setLoaded(false); setData(EMPTY_DATA); setSelectedSiteId(null); }

  // Load all data on login
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const [sites, risks, budget, timeline, compliance, activity, settings, milestones,
             construction, employees, documents,
             lessons, assets, trackers, cisoNotes, selfInspections, dcsaInspections] = await Promise.all([
        API.get('sites'), API.get('risks'), API.get('budget'), API.get('timeline'),
        API.get('compliance'), API.get('activity'), API.get('settings'), API.get('milestones'),
        API.get('construction'), API.get('employees'), API.get('documents'),
        API.get('lessons'), API.get('assets'), API.get('trackers'), API.get('ciso-notes'),
        API.get('self-inspections'), API.get('dcsa-inspections'),
      ]);
      setData({
        sites: sites || [], risks: risks || [], budget: budget || {}, timeline: timeline || {},
        compliance: compliance || {}, activity: activity || [], settings: settings || {},
        milestones: milestones || [], construction: construction || [],
        employees: employees || [], documents: documents || [],
        lessons: lessons || [], assets: assets || [], trackers: trackers || [],
        cisoNotes: cisoNotes || [], selfInspections: selfInspections || [],
        dcsaInspections: dcsaInspections || [],
      });
      setLoaded(true);
    })();
  }, [currentUser, tick]);

  // Wire up openSiteModal (needs live data ref)
  useEffect(() => {
    MASH.openSiteModal = (id) => {
      const s = data.sites.find(x => x.id === id);
      if (!s) return;
      MASH.openModal(`Update Compliance — ${s.name}`, `
        <div class="text-xs mb-4" style="color:rgba(143,163,192,.4)">${s.location} · SSM: ${s.ssm || '—'}</div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="inp-lbl">Personnel Security %</label><input type="number" name="nispom"  value="${s.nispom}"  min="0" max="100" class="inp"></div>
          <div><label class="inp-lbl">Audit Readiness %</label>   <input type="number" name="daapm"   value="${s.daapm}"   min="0" max="100" class="inp"></div>
          <div><label class="inp-lbl">SCIF Controls %</label>      <input type="number" name="icd705"  value="${s.icd705}"  min="0" max="100" class="inp"></div>
          <div><label class="inp-lbl">Emanations Security %</label><input type="number" name="tempest" value="${s.tempest}" min="0" max="100" class="inp"></div>
          <div><label class="inp-lbl">Status</label><select name="status" class="inp">
            <option value="green"  ${s.status === 'green' ? 'selected' : ''}>Fully Compliant</option>
            <option value="amber"  ${s.status === 'amber' ? 'selected' : ''}>Needs Attention</option></select></div>
          <div><label class="inp-lbl">Open Findings</label><input type="number" name="openFindings" value="${s.openFindings || 0}" min="0" class="inp"></div>
          <div class="col-span-2"><label class="inp-lbl">Notes</label><textarea name="notes" rows="2" class="inp">${s.notes || ''}</textarea></div>
        </div>`,
        `<button onclick="MASH._saveSite('${s.id}')" class="btn-gold">Save Changes</button>
         <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase tracking-wider" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.6)">Cancel</button>`);
      MASH._saveSite = async (id) => {
        const inputs  = document.querySelectorAll('#modal-body input,#modal-body select,#modal-body textarea');
        const updates = {};
        inputs.forEach(i => { updates[i.name] = i.type === 'number' ? +i.value : i.value; });
        updates.compliance = Math.round((updates.nispom + updates.daapm + updates.icd705 + updates.tempest) / 4);
        const res = await API.patch('sites', id, updates);
        if (res?.ok) {
          const idx = data.sites.findIndex(x => x.id === id);
          if (idx !== -1) Object.assign(data.sites[idx], updates);
          MASH.closeModal(); refresh(); MASH.toast('Compliance updated', 'success');
        } else {
          MASH.toast('Save failed — is the server running?', 'error');
        }
      };
    };
  }, [data, refresh]);

  // Update notification drawer on data load
  useEffect(() => {
    if (!loaded) return;
    const urgent = (data.compliance?.findings || []).filter(f => f.status !== 'resolved' && (f.severity === 'critical' || f.severity === 'high'));
    const nl = document.getElementById('notif-list');
    const nc = document.getElementById('notif-count');
    const bb = document.getElementById('bell-badge');
    if (nl) {
      nl.innerHTML = urgent.slice(0, 5).map(f => `
        <div class="card rounded-xl p-3" style="border-left:2px solid ${f.severity === 'critical' ? '#EF4444' : '#F59E0B'}">
          <div class="text-xs font-semibold" style="color:var(--off-white)">${f.title}</div>
          <div class="mt-0.5" style="font-size:10px;color:rgba(143,163,192,.4)">${f.site} · Due ${fmtDate(f.dueDate)}</div>
        </div>`).join('');
    }
    if (nc) nc.textContent = urgent.length;
    if (bb) bb.textContent = urgent.length;
  }, [loaded, tick]);

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  if (!loaded) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="font-head font-bold glow-gold mb-3" style={{ fontSize: '3.5rem', color: 'var(--gold)', letterSpacing: '.2em' }}>MASH</div>
        <div className="uppercase tracking-widest" style={{ color: 'rgba(143,163,192,.4)', fontSize: '.72rem', letterSpacing: '.15em' }}>Loading secure program data…</div>
      </div>
    </div>
  );

  const sitesView = selectedSiteId
    ? <SiteDetailPage siteId={selectedSiteId} data={data} currentUser={currentUser}
                      onBack={() => setSelectedSiteId(null)} onRefresh={refresh} />
    : <SitesSection   data={data} onOpenSite={id => { setSelectedSiteId(id); setSection('sites'); }} />;

  const sections = {
    dashboard:    <DashboardSection    data={data} onNavigate={setSection} />,
    sites:        sitesView,
    employees:    <EmployeesSection    data={data} onRefresh={refresh} />,
    documents:    <DocumentsSection    data={data} onRefresh={refresh} />,
    compliance:   <ComplianceSection   data={data} onRefresh={refresh} />,
    budget:       <BudgetSection       data={data} />,
    timeline:     <TimelineSection     data={data} />,
    construction: <ConstructionSection data={data} />,
    risks:        <RisksSection        data={data} onRefresh={refresh} />,
    trackers:     <CustomTrackersSection data={data} currentUser={currentUser} onRefresh={refresh} />,
  };

  return (
    <>
      <Header section={section} onNav={setSection} data={data} currentUser={currentUser} onLogout={handleLogout} />
      <main className="max-w-screen-2xl mx-auto px-6 py-8 relative z-10">
        {sections[section] || sections.dashboard}
      </main>
    </>
  );
}
