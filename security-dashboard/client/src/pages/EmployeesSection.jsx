import { useState } from 'react';
import { API, MASH, fmtDate, daysUntil, uid } from '../app.js';
import { Badge } from '../components/index.jsx';

const CLEARANCE_LABEL = {
  'confidential': 'CONFIDENTIAL',
  'secret':       'SECRET',
  'ts-sci':       'TS/SCI',
  'ts-sci-poly':  'TS/SCI POLY',
};
const CLEARANCE_CLS = {
  'confidential': 'b-b',
  'secret':       'b-c',
  'ts-sci':       'b-gold',
  'ts-sci-poly':  'b-v',
};
const STATUS_CLS = {
  active:      'b-g',
  terminated:  'b-r',
  suspended:   'b-a',
  transferred: 'b-b',
};

export default function EmployeesSection({ data, onRefresh }) {
  const employees = data.employees || [];
  const sites     = data.sites     || [];
  const [filterSite,      setFilterSite]      = useState('');
  const [filterClearance, setFilterClearance] = useState('');
  const [filterStatus,    setFilterStatus]    = useState('active');
  const [sort,            setSort]            = useState('name-asc');

  let list = [...employees];
  if (filterSite)      list = list.filter(e => e.siteId === filterSite);
  if (filterClearance) list = list.filter(e => e.clearanceLevel === filterClearance);
  if (filterStatus)    list = list.filter(e => e.status === filterStatus);
  if (sort === 'name-asc')      list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === 'pr-due')   list.sort((a, b) => new Date(a.reinvestigationDue) - new Date(b.reinvestigationDue));
  else if (sort === 'training-due') list.sort((a, b) => new Date(a.trainingDueDate) - new Date(b.trainingDueDate));

  const active    = employees.filter(e => e.status === 'active');
  const prOverdue = active.filter(e => e.reinvestigationDue && daysUntil(e.reinvestigationDue) < 0);
  const prSoon    = active.filter(e => e.reinvestigationDue && daysUntil(e.reinvestigationDue) >= 0 && daysUntil(e.reinvestigationDue) <= 90);
  const trainOverdue = active.filter(e => e.trainingDueDate && daysUntil(e.trainingDueDate) < 0);

  function dueCls(dateStr) {
    const d = daysUntil(dateStr);
    if (d === null) return '';
    if (d < 0)   return 'text-red-400 font-bold';
    if (d <= 30) return 'text-amber-400 font-bold';
    if (d <= 90) return 'text-yellow-400';
    return '';
  }

  function openAddEmployee() {
    const sOpts = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    MASH.openModal('Add Employee', `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="inp-lbl">Full Name</label><input id="em-n" class="inp" placeholder="Jane Smith"></div>
        <div><label class="inp-lbl">Position / Title</label><input id="em-pos" class="inp" placeholder="Security Analyst"></div>
        <div><label class="inp-lbl">Facility</label><select id="em-si" class="inp">${sOpts}</select></div>
        <div><label class="inp-lbl">Clearance Level</label><select id="em-cl" class="inp">
          <option value="confidential">Confidential</option>
          <option value="secret">Secret</option>
          <option value="ts-sci">TS/SCI</option>
          <option value="ts-sci-poly">TS/SCI Poly</option></select></div>
        <div><label class="inp-lbl">Status</label><select id="em-st" class="inp">
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="transferred">Transferred</option>
          <option value="terminated">Terminated</option></select></div>
        <div><label class="inp-lbl">Clearance Granted</label><input type="date" id="em-cg" class="inp"></div>
        <div><label class="inp-lbl">Reinvestigation Due</label><input type="date" id="em-rd" class="inp"></div>
        <div><label class="inp-lbl">Training Due Date</label><input type="date" id="em-td" class="inp"></div>
        <div><label class="inp-lbl">Annual Briefing Due</label><input type="date" id="em-ab" class="inp"></div>
        <div class="col-span-2"><label class="inp-lbl">Notes</label><textarea id="em-no" rows="2" class="inp"></textarea></div>
      </div>`,
      `<button onclick="MASH._saveEmployee('')" class="btn-gold">Add Employee</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase tracking-wider" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.6)">Cancel</button>`);
    MASH._saveEmployee = async () => {
      const site = sites.find(s => s.id === document.getElementById('em-si').value);
      const item = {
        id: uid(),
        name: document.getElementById('em-n').value,
        position: document.getElementById('em-pos').value,
        siteId: site?.id, site: site?.name,
        clearanceLevel: document.getElementById('em-cl').value,
        status: document.getElementById('em-st').value,
        clearanceGranted: document.getElementById('em-cg').value,
        reinvestigationDue: document.getElementById('em-rd').value,
        trainingDueDate: document.getElementById('em-td').value,
        annualBriefingDue: document.getElementById('em-ab').value,
        notes: document.getElementById('em-no').value,
      };
      if (!item.name) { MASH.toast('Name required', 'warning'); return; }
      await API.post('employees', item);
      MASH.closeModal(); onRefresh(); MASH.toast('Employee added', 'success');
    };
  }

  function openEditEmployee(emp) {
    const sOpts = sites.map(s => `<option value="${s.id}" ${s.id === emp.siteId ? 'selected' : ''}>${s.name}</option>`).join('');
    MASH.openModal(`Edit — ${emp.name}`, `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="inp-lbl">Full Name</label><input id="em-n" class="inp" value="${emp.name || ''}"></div>
        <div><label class="inp-lbl">Position / Title</label><input id="em-pos" class="inp" value="${emp.position || ''}"></div>
        <div><label class="inp-lbl">Facility</label><select id="em-si" class="inp">${sOpts}</select></div>
        <div><label class="inp-lbl">Clearance Level</label><select id="em-cl" class="inp">
          ${['confidential', 'secret', 'ts-sci', 'ts-sci-poly'].map(c => `<option value="${c}" ${emp.clearanceLevel === c ? 'selected' : ''}>${CLEARANCE_LABEL[c]}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Status</label><select id="em-st" class="inp">
          ${['active', 'suspended', 'transferred', 'terminated'].map(s => `<option value="${s}" ${emp.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Clearance Granted</label><input type="date" id="em-cg" class="inp" value="${emp.clearanceGranted || ''}"></div>
        <div><label class="inp-lbl">Reinvestigation Due</label><input type="date" id="em-rd" class="inp" value="${emp.reinvestigationDue || ''}"></div>
        <div><label class="inp-lbl">Training Due Date</label><input type="date" id="em-td" class="inp" value="${emp.trainingDueDate || ''}"></div>
        <div><label class="inp-lbl">Annual Briefing Due</label><input type="date" id="em-ab" class="inp" value="${emp.annualBriefingDue || ''}"></div>
        <div class="col-span-2"><label class="inp-lbl">Notes</label><textarea id="em-no" rows="2" class="inp">${emp.notes || ''}</textarea></div>
      </div>`,
      `<button onclick="MASH._saveEmployee('${emp.id}')" class="btn-gold">Save Changes</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase tracking-wider" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.6)">Cancel</button>`);
    MASH._saveEmployee = async (id) => {
      const site = sites.find(s => s.id === document.getElementById('em-si').value);
      const d = {
        name: document.getElementById('em-n').value,
        position: document.getElementById('em-pos').value,
        siteId: site?.id, site: site?.name,
        clearanceLevel: document.getElementById('em-cl').value,
        status: document.getElementById('em-st').value,
        clearanceGranted: document.getElementById('em-cg').value,
        reinvestigationDue: document.getElementById('em-rd').value,
        trainingDueDate: document.getElementById('em-td').value,
        annualBriefingDue: document.getElementById('em-ab').value,
        notes: document.getElementById('em-no').value,
      };
      if (!d.name) { MASH.toast('Name required', 'warning'); return; }
      await API.patch('employees', id, d);
      MASH.closeModal(); onRefresh(); MASH.toast('Employee updated', 'success');
    };
  }

  return (
    <div className="section">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="sec-heading mb-1">Personnel Registry</div>
          <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>Cleared Personnel</h2>
        </div>
        <button onClick={openAddEmployee} className="btn-gold">
          <i className="fa-solid fa-plus text-[10px]" /> Add Employee
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {[
          { icon: 'fa-id-card',             label: 'Active Personnel',   val: active.length,       sub: `${employees.length} total in registry`,     color: 'var(--gold)'   },
          { icon: 'fa-rotate',              label: 'PR Overdue',         val: prOverdue.length,    sub: 'Reinvestigation past due',                   color: prOverdue.length ? 'var(--red)' : 'var(--green)'  },
          { icon: 'fa-clock-rotate-left',   label: 'PR Due ≤ 90 Days',   val: prSoon.length,       sub: 'Upcoming periodic reinvestigation',           color: prSoon.length ? 'var(--amber)' : 'var(--gold)'   },
          { icon: 'fa-graduation-cap',      label: 'Training Overdue',   val: trainOverdue.length, sub: 'Annual training past due',                   color: trainOverdue.length ? 'var(--amber)' : 'var(--green)' },
        ].map((k, i) => (
          <div key={i} className="card card-kpi p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.18)' }}>
                <i className={`fa-solid ${k.icon} text-base`} style={{ color: 'var(--gold)' }} />
              </div>
            </div>
            <div className="uppercase tracking-widest mb-2" style={{ fontSize: '.58rem', fontWeight: 700, color: 'rgba(143,163,192,.5)', letterSpacing: '.1em' }}>{k.label}</div>
            <div className="font-head font-bold leading-none mb-2" style={{ fontSize: '2rem', color: k.color }}>{k.val}</div>
            <div className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="">All Facilities</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterClearance} onChange={e => setFilterClearance(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="">All Clearances</option>
          <option value="ts-sci-poly">TS/SCI Poly</option>
          <option value="ts-sci">TS/SCI</option>
          <option value="secret">Secret</option>
          <option value="confidential">Confidential</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="transferred">Transferred</option>
          <option value="terminated">Terminated</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="name-asc">Sort: Name A–Z</option>
          <option value="name-desc">Sort: Name Z–A</option>
          <option value="pr-due">Sort: PR Due ↑</option>
          <option value="training-due">Sort: Training Due ↑</option>
        </select>
        <span className="ml-auto text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>{list.length} record{list.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '900px' }}>
            <thead className="border-b" style={{ borderColor: 'rgba(201,168,76,.1)' }}>
              <tr>
                <th className="text-left px-6 py-4">Name</th>
                <th className="text-left px-4 py-4">Facility</th>
                <th className="text-left px-4 py-4">Position</th>
                <th className="text-left px-4 py-4">Clearance</th>
                <th className="text-left px-4 py-4">Reinvestigation Due</th>
                <th className="text-left px-4 py-4">Training Due</th>
                <th className="text-left px-4 py-4">Status</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(201,168,76,.05)' }}>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-xs" style={{ color: 'rgba(143,163,192,.35)' }}>
                    No employees match the current filters.
                  </td>
                </tr>
              ) : list.map(emp => {
                const prDays    = daysUntil(emp.reinvestigationDue);
                const trainDays = daysUntil(emp.trainingDueDate);
                const site      = sites.find(s => s.id === emp.siteId);
                return (
                  <tr key={emp.id}>
                    <td className="px-6 py-4">
                      <div className="font-head font-semibold text-sm" style={{ color: 'var(--off-white)' }}>{emp.name}</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: 'rgba(143,163,192,.3)' }}>{emp.id}</div>
                    </td>
                    <td className="px-4 py-4 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{site?.name || emp.siteId}</td>
                    <td className="px-4 py-4 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{emp.position || '—'}</td>
                    <td className="px-4 py-4">
                      <Badge cls={CLEARANCE_CLS[emp.clearanceLevel] || 'b-b'}>{CLEARANCE_LABEL[emp.clearanceLevel] || emp.clearanceLevel}</Badge>
                    </td>
                    <td className={`px-4 py-4 text-xs ${dueCls(emp.reinvestigationDue)}`}>
                      {emp.reinvestigationDue
                        ? <>{fmtDate(emp.reinvestigationDue)}{prDays !== null && <span className="ml-1.5" style={{ fontSize: '9px', opacity: .7 }}>({prDays < 0 ? `${Math.abs(prDays)}d OVR` : `${prDays}d`})</span>}</>
                        : <span style={{ color: 'rgba(143,163,192,.3)' }}>—</span>}
                    </td>
                    <td className={`px-4 py-4 text-xs ${dueCls(emp.trainingDueDate)}`}>
                      {emp.trainingDueDate
                        ? <>{fmtDate(emp.trainingDueDate)}{trainDays !== null && <span className="ml-1.5" style={{ fontSize: '9px', opacity: .7 }}>({trainDays < 0 ? `${Math.abs(trainDays)}d OVR` : `${trainDays}d`})</span>}</>
                        : <span style={{ color: 'rgba(143,163,192,.3)' }}>—</span>}
                    </td>
                    <td className="px-4 py-4"><Badge cls={STATUS_CLS[emp.status] || 'b-b'}>{emp.status?.toUpperCase()}</Badge></td>
                    <td className="px-4 py-4">
                      <button onClick={() => openEditEmployee(emp)} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold)', letterSpacing: '.07em' }}>Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
