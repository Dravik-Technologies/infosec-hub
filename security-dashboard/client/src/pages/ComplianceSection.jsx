import { API, MASH, fmtDate, uid, sevCls, COMP, today } from '../app.js';
import { Badge } from '../components/index.jsx';

export default function ComplianceSection({ data, onRefresh }) {
  const c    = data.compliance || {};
  const circ = 188.5;
  const openFindings   = (c.findings || []).filter(f => f.status !== 'resolved');
  const closedFindings = (c.findings || []).filter(f => f.status === 'resolved');

  async function resolveFinding(id) {
    await API.patch('compliance', id, { status: 'resolved', resolvedAt: new Date().toISOString() });
    const f = c.findings?.find(x => x.id === id);
    if (f) f.status = 'resolved';
    onRefresh();
    MASH.toast('Finding resolved', 'success');
  }

  function openAddFinding() {
    MASH.openModal('Add Compliance Finding', `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="inp-lbl">Finding Title</label><input id="fn-t" class="inp" placeholder="Describe the finding…"></div>
        <div><label class="inp-lbl">Control Area</label><select id="fn-s" class="inp">
          <option value="nispom">Personnel &amp; Operational Security</option>
          <option value="daapm">Audit Readiness</option>
          <option value="icd705">SCIF Technical Controls</option>
          <option value="tempest">Emanations Security</option></select></div>
        <div><label class="inp-lbl">Facility</label><select id="fn-si" class="inp">
          ${(data.sites || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Severity</label><select id="fn-sv" class="inp">
          <option value="critical">Critical</option><option value="high">High</option>
          <option value="medium">Medium</option><option value="low">Low</option></select></div>
        <div><label class="inp-lbl">Due Date</label><input type="date" id="fn-d" class="inp"></div>
        <div class="col-span-2"><label class="inp-lbl">Owner</label><input id="fn-o" class="inp" placeholder="e.g. J. Martinez"></div>
        <div class="col-span-2"><label class="inp-lbl">Description</label><textarea id="fn-desc" rows="2" class="inp"></textarea></div>
      </div>`,
      `<button onclick="MASH._saveFinding()" class="btn-gold">Add Finding</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase tracking-wider" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.6)">Cancel</button>`);
    MASH._saveFinding = async () => {
      const stdEl = document.getElementById('fn-s');
      const site  = (data.sites || []).find(s => s.id === document.getElementById('fn-si').value);
      const item  = {
        id: uid(), title: document.getElementById('fn-t').value,
        standard: stdEl.value, standardName: COMP[stdEl.value]?.label || stdEl.value,
        siteId: site?.id, site: site?.name, severity: document.getElementById('fn-sv').value,
        dueDate: document.getElementById('fn-d').value, owner: document.getElementById('fn-o').value,
        description: document.getElementById('fn-desc').value, status: 'open', createdAt: new Date().toISOString(),
      };
      if (!item.title) { MASH.toast('Title required', 'warning'); return; }
      c.findings = (c.findings || []).concat(item);
      await API.put('compliance', c);
      MASH.closeModal(); onRefresh(); MASH.toast('Finding added', 'success');
    };
  }

  return (
    <div className="section">
      <div className="mb-7">
        <div className="sec-heading mb-1">Security Compliance</div>
        <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>Compliance Status</h2>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {(c.standards || []).map(s => {
          const cd     = COMP[s.id] || { label: s.name, sub: s.name, icon: 'fa-shield-halved', color: 'var(--gold)' };
          const offset = circ * (1 - s.percentage / 100);
          return (
            <div key={s.id} className="card p-6">
              <div className="flex items-center gap-x-5 mb-5">
                <div className="radial-wrap">
                  <svg width="84" height="84" viewBox="0 0 84 84">
                    <circle cx="42" cy="42" r="32" fill="none" stroke="rgba(201,168,76,.08)" strokeWidth="7" />
                    <circle cx="42" cy="42" r="32" fill="none" stroke={cd.color} strokeWidth="7"
                      strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
                  </svg>
                  <div className="radial-lbl" style={{ color: cd.color }}>{s.percentage}%</div>
                </div>
                <div>
                  <div className="font-head font-bold text-sm leading-snug mb-1" style={{ color: 'var(--off-white)' }}>{cd.label}</div>
                  <div className="mb-2 uppercase tracking-wider" style={{ fontSize: '8px', color: 'rgba(143,163,192,.35)', letterSpacing: '.09em' }}>{cd.sub}</div>
                  <Badge cls={s.percentage >= 95 ? 'b-g' : s.percentage >= 80 ? 'b-a' : 'b-r'}>
                    {s.percentage >= 95 ? 'COMPLIANT' : s.percentage >= 80 ? 'NEEDS WORK' : 'NON-COMPLIANT'}
                  </Badge>
                </div>
              </div>
              <div className="pt-4 space-y-1" style={{ borderTop: '1px solid rgba(201,168,76,.07)', fontSize: '9px', color: 'rgba(143,163,192,.35)' }}>
                <div>{s.openFindings} open finding{s.openFindings !== 1 ? 's' : ''}</div>
                <div>Next review: {fmtDate(s.nextReview)}</div>
              </div>
              <div className="mt-3 space-y-1.5">
                {(c.checklist || []).filter(i => i.standard === s.id).slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center gap-x-2" style={{ fontSize: '9px' }}>
                    <i className={`fa-solid ${item.status === 'complete' ? 'fa-circle-check text-emerald-400' : 'fa-circle-half-stroke text-amber-400'} shrink-0`} />
                    <span className="truncate flex-1" style={{ color: 'rgba(143,163,192,.45)' }}>{item.title.replace(/^(NISPOM|DAAPM|ICD 705|TEMPEST)\s+/, '')}</span>
                    <span className="font-mono font-bold shrink-0" style={{ color: 'var(--gold)' }}>{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Findings */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-head font-semibold" style={{ color: 'var(--off-white)' }}>Open Findings</div>
            <div style={{ fontSize: '10px', color: 'rgba(143,163,192,.4)' }} className="mt-0.5">{openFindings.length} open · {closedFindings.length} resolved</div>
          </div>
          <button onClick={openAddFinding} className="badge b-gold cursor-pointer transition-colors" style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-plus mr-1" /> Add Finding
          </button>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b" style={{ borderColor: 'rgba(201,168,76,.08)' }}>
            <tr>
              <th className="text-left pb-3">Finding</th>
              <th className="text-left pb-3">Control Area</th>
              <th className="text-left pb-3">Facility</th>
              <th className="text-left pb-3">Due</th>
              <th className="text-left pb-3">Severity</th>
              <th className="text-left pb-3">Owner</th>
              <th className="text-left pb-3">Status</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'rgba(201,168,76,.05)' }}>
            {[...openFindings, ...closedFindings].map(f => {
              const overdue = f.status !== 'resolved' && new Date(f.dueDate) < today;
              const cd      = COMP[f.standard] || { label: f.standardName || f.standard };
              return (
                <tr key={f.id} className={f.status === 'resolved' ? 'opacity-50' : ''}>
                  <td className="py-3">
                    <div className="font-medium" style={{ color: 'var(--off-white)' }}>{f.title}</div>
                    {f.description && <div className="max-w-xs line-clamp-1 mt-0.5" style={{ fontSize: '9px', color: 'rgba(143,163,192,.35)' }}>{f.description}</div>}
                  </td>
                  <td className="py-3" style={{ color: 'rgba(143,163,192,.45)' }}>{cd.label}</td>
                  <td className="py-3" style={{ color: 'rgba(143,163,192,.45)' }}>{f.site}</td>
                  <td className={`py-3 ${overdue ? 'text-red-400 font-bold' : ''}`} style={!overdue ? { color: 'rgba(143,163,192,.45)' } : {}}>{fmtDate(f.dueDate)}</td>
                  <td className="py-3"><Badge cls={sevCls(f.severity)}>{f.severity?.toUpperCase()}</Badge></td>
                  <td className="py-3" style={{ color: 'rgba(143,163,192,.45)' }}>{f.owner}</td>
                  <td className="py-3"><Badge cls={f.status === 'resolved' ? 'b-g' : 'b-r'}>{f.status?.toUpperCase()}</Badge></td>
                  <td className="py-3">
                    {f.status !== 'resolved' && (
                      <button onClick={() => resolveFinding(f.id)} className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider">Resolve</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
