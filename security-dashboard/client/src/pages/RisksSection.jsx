import { API, MASH, fmtDate, uid, sevCls, today } from '../app.js';
import { Badge } from '../components/index.jsx';

export default function RisksSection({ data, onRefresh }) {
  const risks    = data.risks || [];
  const open     = risks.filter(r => r.status !== 'resolved');
  const resolved = risks.filter(r => r.status === 'resolved');
  const matrix   = { tl: [], tr: [], bl: [], br: [] };
  open.forEach(r => {
    const hp = r.probability === 'high', hi = r.impact === 'high';
    if (hp && hi)    matrix.tr.push(r.title);
    else if (hp)     matrix.tl.push(r.title);
    else if (hi)     matrix.br.push(r.title);
    else             matrix.bl.push(r.title);
  });

  async function resolveRisk(id) {
    await API.patch('risks', id, { status: 'resolved', resolvedAt: new Date().toISOString() });
    const r = risks.find(x => x.id === id);
    if (r) r.status = 'resolved';
    onRefresh();
    MASH.toast('Risk resolved', 'success');
  }

  function openRiskModal(id = null) {
    const r     = id ? risks.find(x => x.id === id) : null;
    const sOpts = (data.sites || []).map(s => `<option value="${s.id}" ${r?.siteId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
    MASH.openModal(r ? `Edit Risk — ${r.id}` : 'Add New Risk', `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="inp-lbl">Title</label><input id="rk-t" class="inp" value="${r?.title || ''}"></div>
        <div class="col-span-2"><label class="inp-lbl">Description</label><textarea id="rk-d" rows="2" class="inp">${r?.description || ''}</textarea></div>
        <div><label class="inp-lbl">Standard</label><select id="rk-s" class="inp">${['NISPOM', 'DAAPM', 'ICD 705', 'TEMPEST'].map(s => `<option ${r?.standard === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Facility</label><select id="rk-si" class="inp">${sOpts}</select></div>
        <div><label class="inp-lbl">Severity</label><select id="rk-sv" class="inp">${['critical', 'high', 'medium', 'low'].map(s => `<option ${r?.severity === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Probability</label><select id="rk-p" class="inp">${['high', 'medium', 'low'].map(s => `<option ${r?.probability === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Impact</label><select id="rk-i" class="inp">${['high', 'medium', 'low'].map(s => `<option ${r?.impact === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Due Date</label><input type="date" id="rk-dd" class="inp" value="${r?.dueDate || ''}"></div>
        <div><label class="inp-lbl">Owner</label><input id="rk-o" class="inp" value="${r?.owner || ''}"></div>
        <div><label class="inp-lbl">Financial Impact ($)</label><input type="number" id="rk-f" class="inp" value="${r?.financialImpact || 0}"></div>
        <div class="col-span-2"><label class="inp-lbl">Mitigation Plan</label><textarea id="rk-m" rows="2" class="inp">${r?.mitigation || ''}</textarea></div>
      </div>`,
      `<button onclick="MASH._saveRisk('${id || ''}')" class="btn-gold">${r ? 'Save Changes' : 'Add Risk'}</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase tracking-wider" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.6)">Cancel</button>`);
    MASH._saveRisk = async (id) => {
      const site = (data.sites || []).find(s => s.id === document.getElementById('rk-si').value);
      const d = {
        title: document.getElementById('rk-t').value,
        description: document.getElementById('rk-d').value,
        standard: document.getElementById('rk-s').value,
        siteId: site?.id, site: site?.name,
        severity: document.getElementById('rk-sv').value,
        probability: document.getElementById('rk-p').value,
        impact: document.getElementById('rk-i').value,
        dueDate: document.getElementById('rk-dd').value,
        owner: document.getElementById('rk-o').value,
        financialImpact: +document.getElementById('rk-f').value,
        mitigation: document.getElementById('rk-m').value,
      };
      if (!d.title) { MASH.toast('Title required', 'warning'); return; }
      if (id) {
        await API.patch('risks', id, d);
        const idx = risks.findIndex(x => x.id === id);
        if (idx !== -1) Object.assign(risks[idx], d);
      } else {
        d.id = uid(); d.status = 'open'; d.createdAt = new Date().toISOString();
        await API.post('risks', d);
        risks.push(d);
      }
      MASH.closeModal(); onRefresh(); MASH.toast(id ? 'Risk updated' : 'Risk added', 'success');
    };
  }

  const sevBdr = { critical: '#EF4444', high: '#EF4444', medium: '#F59E0B', low: '#10B981', resolved: '#10B981' };

  return (
    <div className="section">
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="sec-heading mb-1">Risk Register</div>
          <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>Open Risk Items</h2>
        </div>
        <button onClick={() => openRiskModal()} className="btn-gold">
          <i className="fa-solid fa-plus text-[10px]" /> Add Risk
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Matrix */}
        <div className="card p-6">
          <div className="font-head font-semibold mb-0.5" style={{ color: 'var(--off-white)' }}>Risk Matrix</div>
          <div className="uppercase tracking-wider mb-5" style={{ fontSize: '9px', color: 'rgba(143,163,192,.35)', letterSpacing: '.08em' }}>Probability × Impact</div>
          <div className="grid grid-cols-2 grid-rows-2 gap-2 mb-4" style={{ aspectRatio: '1' }}>
            {[
              { id: 'tl', bg: 'rgba(245,158,11,.08)', bdr: 'rgba(245,158,11,.18)', tc: 'rgba(245,158,11,.6)',  lbl: 'Hi Prob / Lo Impact' },
              { id: 'tr', bg: 'rgba(239,68,68,.10)',  bdr: 'rgba(239,68,68,.22)',  tc: 'rgba(239,68,68,.7)',   lbl: 'Hi Prob / Hi Impact' },
              { id: 'bl', bg: 'rgba(16,185,129,.07)', bdr: 'rgba(16,185,129,.18)', tc: 'rgba(16,185,129,.55)', lbl: 'Lo Prob / Lo Impact' },
              { id: 'br', bg: 'rgba(245,158,11,.06)', bdr: 'rgba(245,158,11,.14)', tc: 'rgba(245,158,11,.5)',  lbl: 'Lo Prob / Hi Impact' },
            ].map(q => (
              <div key={q.id} className="rounded-xl p-3 flex flex-col justify-between"
                style={{ background: q.bg, border: `1px solid ${q.bdr}` }}>
                <div className="uppercase tracking-wider" style={{ fontSize: '8px', letterSpacing: '.08em', color: q.tc }}>{q.lbl}</div>
                <div className="mt-2 leading-relaxed" style={{ fontSize: '9px', color: 'rgba(240,244,248,.5)' }}>{matrix[q.id].join(' / ') || '—'}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between uppercase tracking-wider px-1" style={{ fontSize: '8px', color: 'rgba(143,163,192,.25)', letterSpacing: '.08em' }}>
            <span>Low Impact</span><span>High Impact</span>
          </div>
          <div className="mt-5 pt-4 grid grid-cols-2 gap-2 text-center" style={{ borderTop: '1px solid rgba(201,168,76,.07)', fontSize: '10px' }}>
            {[
              { lbl: 'Critical', cnt: open.filter(r => r.severity === 'critical').length, c: '#EF4444'    },
              { lbl: 'High',     cnt: open.filter(r => r.severity === 'high').length,     c: '#F59E0B'    },
              { lbl: 'Medium',   cnt: open.filter(r => r.severity === 'medium').length,   c: 'var(--gold)' },
              { lbl: 'Resolved', cnt: resolved.length,                                    c: '#10B981'    },
            ].map(({ lbl, cnt, c }) => (
              <div key={lbl} className="rounded-xl py-3" style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.07)' }}>
                <div className="font-head font-bold text-2xl" style={{ color: c }}>{cnt}</div>
                <div className="mt-0.5" style={{ color: 'rgba(143,163,192,.4)' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk cards */}
        <div className="col-span-1 lg:col-span-2 space-y-3">
          {[...open, ...resolved].map(r => (
            <div key={r.id} className={`card p-6 border-l-4 ${r.status === 'resolved' ? 'opacity-50' : ''}`}
              style={{ borderLeftColor: sevBdr[r.status === 'resolved' ? 'resolved' : r.severity] || 'rgba(201,168,76,.3)' }}>
              <div className="flex items-start justify-between gap-x-4 mb-3">
                <div>
                  <div className="flex items-center gap-x-2 flex-wrap gap-y-1 mb-2">
                    <Badge cls={r.status === 'resolved' ? 'b-g' : sevCls(r.severity)}>
                      {r.status === 'resolved' ? 'RESOLVED' : r.severity?.toUpperCase()}
                    </Badge>
                    <span className="font-mono" style={{ fontSize: '9px', color: 'rgba(143,163,192,.3)' }}>{r.id}</span>
                  </div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--off-white)' }}>{r.title}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(143,163,192,.4)' }}>{r.description}</div>
                </div>
                <div className="text-right shrink-0">
                  <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.35)' }}>Due</div>
                  <div className={`text-sm font-bold font-mono ${r.status === 'resolved' ? 'text-emerald-400' : new Date(r.dueDate) < today ? 'text-red-400' : 'text-amber-400'}`}>
                    {r.status === 'resolved' ? 'CLOSED' : fmtDate(r.dueDate)}
                  </div>
                  {r.financialImpact ? <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.28)' }} className="mt-0.5">${r.financialImpact.toLocaleString()} est.</div> : null}
                </div>
              </div>
              {r.mitigation && (
                <div className="text-[10px] p-2.5 rounded-xl mt-2" style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.08)', color: 'rgba(143,163,192,.45)' }}>
                  <i className="fa-solid fa-shield-halved mr-1.5" style={{ color: 'var(--gold)' }} />
                  {r.mitigation}
                </div>
              )}
              <div className="flex items-center gap-x-5 mt-3 pt-3 text-[10px]" style={{ borderTop: '1px solid rgba(201,168,76,.06)', color: 'rgba(143,163,192,.35)' }}>
                <span><i className="fa-solid fa-user mr-1.5" />{r.owner || '—'}</span>
                <span><i className="fa-solid fa-building mr-1.5" />{r.site || '—'}</span>
                {r.status !== 'resolved' && (
                  <>
                    <button onClick={() => resolveRisk(r.id)} className="ml-auto text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider" style={{ fontSize: '9px', letterSpacing: '.07em' }}>Resolve</button>
                    <button onClick={() => openRiskModal(r.id)} className="font-bold uppercase tracking-wider transition-colors" style={{ fontSize: '9px', letterSpacing: '.07em', color: 'var(--gold)' }}>Edit</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
