import { useState, useRef } from 'react';
import { API, MASH, fmtDate, daysUntil, uid } from '../app.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function getSelfDueDate(s) {
  if (s.selfInspectionDueDate) return s.selfInspectionDueDate;
  if (s.lastSelfInspectionDate) {
    const d = new Date(s.lastSelfInspectionDate + 'T12:00:00Z');
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function getStatus(s) {
  const due = getSelfDueDate(s);
  if (!due) return 'overdue';
  const days = daysUntil(due);
  if (days === null || days < 0) return 'overdue';
  if (days <= 30) return 'due-soon';
  return 'current';
}

const STATUS_CFG = {
  'current':  { label: 'Current',  color: '#10B981', bg: 'rgba(16,185,129,.12)', border: 'rgba(16,185,129,.3)',  icon: 'fa-circle-check'         },
  'due-soon': { label: 'Due Soon', color: '#F59E0B', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)',  icon: 'fa-clock'                },
  'overdue':  { label: 'Overdue',  color: '#EF4444', bg: 'rgba(239,68,68,.12)',  border: 'rgba(239,68,68,.3)',   icon: 'fa-triangle-exclamation' },
};

const NETWORKS = [
  { key: 'jwics',   label: 'JWICS',    desc: 'Joint Worldwide Intelligence Communications System',   cls: 'TS/SCI'        },
  { key: 'siprnet', label: 'SIPRNET',  desc: 'Secret Internet Protocol Router Network',              cls: 'SECRET'        },
  { key: 'niprnet', label: 'NIPRNet',  desc: 'Non-classified Internet Protocol Router Network',      cls: 'UNCLASSIFIED'  },
  { key: 'cwan',    label: 'CWAN',     desc: 'Classified Wide Area Network',                         cls: 'SECRET'        },
  { key: 'lava',    label: 'LAVA',     desc: 'Local Area Voice/Video Architecture',                  cls: 'SECRET'        },
  { key: 'dren',    label: 'DREN',     desc: 'Defense Research and Engineering Network',             cls: 'UNCLASSIFIED'  },
  { key: 'centrix', label: 'CENTRIX',  desc: 'Combined Enterprise Regional Information Exchange',    cls: 'SECRET//REL'   },
  { key: 'jwics_v', label: 'JWICS-V',  desc: 'JWICS Voice',                                          cls: 'TS/SCI'        },
];

const LESSON_TYPES = {
  'lesson-learned':    { label: 'Lesson Learned',   color: '#60A5FA', icon: 'fa-lightbulb'   },
  'best-practice':     { label: 'Best Practice',    color: '#10B981', icon: 'fa-star'        },
  'corrective-action': { label: 'Corrective Action',color: '#F97316', icon: 'fa-wrench'      },
};

const NOTE_TYPES = {
  'directive':          { label: 'Directive',         color: '#EF4444', icon: 'fa-bullhorn'       },
  'strategic-priority': { label: 'Strategic Priority',color: '#60A5FA', icon: 'fa-crosshairs'     },
  'site-assessment':    { label: 'Assessment',        color: '#A78BFA', icon: 'fa-clipboard-list' },
  'guidance':           { label: 'Guidance',          color: '#F59E0B', icon: 'fa-comment-dots'   },
};

// ── Tab pill nav ──────────────────────────────────────────────────────────────

function TabNav({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-x-1 flex-wrap gap-y-1">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all"
          style={active === t.id
            ? { background: 'var(--gold)', color: '#06121f' }
            : { background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.15)', color: 'rgba(143,163,192,.6)' }}>
          <i className={`fa-solid ${t.icon} mr-1.5`} style={{ fontSize: '9px' }} />{t.label}
        </button>
      ))}
    </div>
  );
}

// ── Note / KB detail modal ────────────────────────────────────────────────────

const KB_TYPE_CFG = {
  'lesson-learned':    { label: 'Lesson Learned',   color: '#60A5FA', icon: 'fa-lightbulb',      bg: 'rgba(96,165,250,.06)'   },
  'best-practice':     { label: 'Best Practice',    color: '#10B981', icon: 'fa-star',            bg: 'rgba(16,185,129,.06)'   },
  'corrective-action': { label: 'Corrective Action',color: '#F97316', icon: 'fa-wrench',          bg: 'rgba(249,115,22,.06)'   },
  'directive':         { label: 'Directive',         color: '#EF4444', icon: 'fa-bullhorn',        bg: 'rgba(239,68,68,.06)'    },
  'strategic-priority':{ label: 'Strategic Priority',color: '#60A5FA', icon: 'fa-crosshairs',     bg: 'rgba(96,165,250,.06)'   },
  'site-assessment':   { label: 'Assessment',        color: '#A78BFA', icon: 'fa-clipboard-list', bg: 'rgba(167,139,250,.06)'  },
  'guidance':          { label: 'Guidance',           color: '#F59E0B', icon: 'fa-comment-dots',  bg: 'rgba(245,158,11,.06)'   },
  'admin-comment':     { label: 'Admin Comment',     color: '#A78BFA', icon: 'fa-comment-dots',   bg: 'rgba(167,139,250,.06)'  },
};

function NoteDetailModal({ note, isCso, onClose }) {
  if (!note) return null;
  const cfg         = KB_TYPE_CFG[note.type] || KB_TYPE_CFG['guidance'];
  const actionItems = Array.isArray(note.actionItems) ? note.actionItems : [];
  const tags        = Array.isArray(note.tags) ? note.tags : [];

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4"
      style={{ background: 'rgba(6,18,31,.88)' }}
      onClick={onClose}>

      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--navy, #0a1628)', border: `1px solid ${cfg.color}35`, boxShadow: `0 24px 64px rgba(0,0,0,.6), 0 0 0 1px ${cfg.color}15` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 flex items-start justify-between gap-x-4 shrink-0"
          style={{ borderBottom: `1px solid ${cfg.color}20`, background: cfg.bg }}>
          <div className="min-w-0">
            <div className="flex items-center gap-x-2 mb-2 flex-wrap gap-y-1">
              <span className="inline-flex items-center gap-x-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.color}40`, color: cfg.color }}>
                <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: '8px' }} />{cfg.label}
              </span>
              {isCso && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.25)', color: '#A78BFA' }}>
                  CSO
                </span>
              )}
              {note.visibility && note.visibility !== 'shared' && (
                <span className="text-[9px] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(96,165,250,.08)', color: 'rgba(96,165,250,.6)' }}>
                  <i className="fa-solid fa-lock mr-1 text-[7px]" />
                  {note.visibility === 'site-only' ? 'Site Only' : 'Admin Only'}
                </span>
              )}
            </div>
            <h2 className="font-head font-bold text-lg leading-tight" style={{ color: 'var(--off-white)', letterSpacing: '-.01em' }}>
              {note.title || 'Untitled'}
            </h2>
            <div className="flex items-center gap-x-3 mt-2 flex-wrap gap-y-1" style={{ fontSize: '10px', color: 'rgba(143,163,192,.45)' }}>
              {note.submittedBy && <span><i className="fa-solid fa-user mr-1 text-[8px]" />{note.submittedBy}</span>}
              {note.submittedDate && <span><i className="fa-solid fa-calendar mr-1 text-[8px]" />{note.submittedDate}</span>}
              {note.siteName && <span><i className="fa-solid fa-building mr-1 text-[8px]" />{note.siteName}</span>}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#FCA5A5' }}>
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Main body text */}
          {note.body && (
            <div className="text-sm leading-relaxed" style={{ color: 'rgba(240,244,248,.75)', whiteSpace: 'pre-wrap' }}>
              {note.body}
            </div>
          )}

          {/* Admin / CSO comment on KB entries */}
          {note.adminComment && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.18)' }}>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-2" style={{ color: '#A78BFA' }}>
                <i className="fa-solid fa-comment-dots mr-1.5" />CSO / Admin Comment
              </div>
              <div className="text-sm leading-relaxed" style={{ color: 'rgba(167,139,250,.8)' }}>{note.adminComment}</div>
            </div>
          )}

          {/* Action items */}
          {actionItems.length > 0 && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.1)' }}>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(201,168,76,.6)' }}>
                <i className="fa-solid fa-list-check mr-1.5" />Action Items
              </div>
              {actionItems.map((item, i) => (
                <div key={i} className="flex items-start gap-x-3">
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)' }}>
                    <span className="text-[8px] font-bold" style={{ color: 'rgba(201,168,76,.7)' }}>{i + 1}</span>
                  </div>
                  <div className="text-sm" style={{ color: 'rgba(143,163,192,.7)' }}>{String(item)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded text-[9px] font-mono"
                  style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)', color: 'rgba(201,168,76,.5)' }}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 flex justify-end" style={{ borderTop: `1px solid ${cfg.color}15` }}>
          <button onClick={onClose} className="btn-gold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Info grid cell ────────────────────────────────────────────────────────────

function InfoCell({ label, value, wide }) {
  return (
    <div className={`rounded-xl p-3.5 ${wide ? 'col-span-2' : ''}`}
      style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.08)' }}>
      <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'rgba(143,163,192,.35)' }}>{label}</div>
      <div className="text-xs font-semibold" style={{ color: value ? 'rgba(240,244,248,.8)' : 'rgba(143,163,192,.25)' }}>{value || '—'}</div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ site, status, canEdit, onRefresh }) {
  const dueDate  = getSelfDueDate(site);
  const daysLeft = dueDate ? daysUntil(dueDate) : null;

  function openEdit() {
    MASH.openModal(`Edit Site — ${site.name}`, `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="inp-lbl">FSO Name</label><input name="fsoName" class="inp" value="${site.fsoName || ''}" /></div>
        <div><label class="inp-lbl">FSO Email</label><input name="fsoEmail" class="inp" value="${site.fsoEmail || ''}" /></div>
        <div><label class="inp-lbl">Backup FSO</label><input name="backupFso" class="inp" value="${site.backupFso || ''}" /></div>
        <div><label class="inp-lbl">Assigned Admin</label><input name="assignedAdmin" class="inp" value="${site.assignedAdmin || ''}" /></div>
        <div><label class="inp-lbl">Phone</label><input name="phone" class="inp" value="${site.phone || ''}" /></div>
        <div><label class="inp-lbl">Clearance Level</label><input name="clearance" class="inp" value="${site.clearance || ''}" /></div>
        <div class="col-span-2"><label class="inp-lbl">Notes</label><textarea name="notes" rows="3" class="inp">${site.notes || ''}</textarea></div>
      </div>`,
      `<button onclick="MASH._saveSiteEdit()" class="btn-gold">Save Changes</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.5)">Cancel</button>`
    );
    MASH._saveSiteEdit = async () => {
      const inputs  = document.querySelectorAll('#modal-body input, #modal-body textarea');
      const updates = {};
      inputs.forEach(i => { if (i.name) updates[i.name] = i.value; });
      const r = await API.patch('sites', site.id, updates);
      if (r?.ok) { MASH.closeModal(); onRefresh(); MASH.toast('Site updated', 'success'); }
      else        { MASH.toast('Save failed', 'error'); }
    };
  }

  return (
    <div className="space-y-6">
      {/* Inspection status */}
      <div className="card rounded-2xl p-5">
        <div className="sec-heading mb-4">Inspection Status</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Last Self-Inspection', fmtDate(site.lastSelfInspectionDate)],
            ['Self-Inspection Due',  fmtDate(dueDate)],
            ['Last DCSA',            fmtDate(site.lastDcsaInspectionDate)],
            ['Next DCSA',            fmtDate(site.nextDcsaInspectionDate)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl p-3" style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.08)' }}>
              <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'rgba(143,163,192,.35)' }}>{k}</div>
              <div className="text-xs font-semibold" style={{ color: 'rgba(240,244,248,.8)' }}>{v || '—'}</div>
            </div>
          ))}
        </div>
        {daysLeft !== null && (
          <div className="mt-3 text-xs" style={{ color: daysLeft < 0 ? '#EF4444' : daysLeft <= 30 ? '#F59E0B' : '#10B981' }}>
            <i className="fa-solid fa-clock mr-1.5" />
            {daysLeft >= 0 ? `${daysLeft} days until self-inspection due` : `Self-inspection is ${Math.abs(daysLeft)} days OVERDUE`}
          </div>
        )}
      </div>

      {/* Facility info */}
      <div className="card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="sec-heading">Facility Information</div>
          {canEdit && (
            <button onClick={openEdit} className="inline-flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)' }}>
              <i className="fa-solid fa-pen text-[9px]" /> Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoCell label="Cage Code"      value={site.cageCode} />
          <InfoCell label="Facility Code"  value={site.facilityCode || site.siteId} />
          <InfoCell label="Established"    value={site.established ? `${site.established}` : null} />
          <InfoCell label="Type"           value={site.type} />
          <InfoCell label="SCIF Zones"     value={site.scifZones ? `${site.scifZones} zones` : null} />
          <InfoCell label="Open Findings"  value={site.openFindings !== undefined ? `${site.openFindings}` : null} />
          <InfoCell label="Phone"          value={site.phone} />
          <InfoCell label="FSO"            value={site.fsoName} />
          <InfoCell label="Backup FSO"     value={site.backupFso} />
          <InfoCell label="Assigned Admin" value={site.assignedAdmin} />
          <InfoCell label="FSO Email"      value={site.fsoEmail} />
          <InfoCell label="Location"       value={site.location} />
          <InfoCell label="Address"        value={site.address} />
          {site.notes && <InfoCell label="Notes" value={site.notes} wide />}
        </div>
      </div>
    </div>
  );
}

// ── Networks Tab ──────────────────────────────────────────────────────────────

// ── Site Assets Tab ───────────────────────────────────────────────────────────

const ASSET_STATUS_CFG = {
  'active':         { label: 'Active',           color: '#10B981' },
  'pending':        { label: 'Pending Approval', color: '#F59E0B' },
  'inactive':       { label: 'Inactive',         color: '#6B7280' },
  'decommissioned': { label: 'Decommissioned',   color: '#EF4444' },
};
const ASSET_APPROVAL_CFG = {
  'approved': { label: 'Approved', color: '#10B981' },
  'denied':   { label: 'Denied',   color: '#EF4444' },
  'pending':  { label: 'Pending',  color: '#F59E0B' },
};

function SiteAssetsTab({ site, assets, canEdit }) {
  const [category, setCategory] = useState('all');
  const siteAssets = (assets || []).filter(a => a.siteId === site.id);
  const filtered   = category === 'all' ? siteAssets : siteAssets.filter(a => a.category === category);
  const pedCt      = siteAssets.filter(a => a.category === 'ped').length;
  const eqCt       = siteAssets.filter(a => a.category === 'equipment').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-y-3">
        <div>
          <div className="sec-heading">Site Assets</div>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(143,163,192,.35)' }}>
            All tracked devices and equipment assigned to this facility
          </p>
        </div>
        {/* Category filter */}
        <div className="flex items-center gap-x-2">
          {[
            { id: 'all',       label: `All (${siteAssets.length})`, icon: 'fa-cubes'                  },
            { id: 'ped',       label: `PEDs (${pedCt})`,            icon: 'fa-mobile-screen-button'   },
            { id: 'equipment', label: `Equipment (${eqCt})`,        icon: 'fa-fax'                    },
          ].map(f => (
            <button key={f.id} onClick={() => setCategory(f.id)}
              className="flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all"
              style={category === f.id
                ? { background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.3)', color: 'var(--gold)' }
                : { background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.08)', color: 'rgba(143,163,192,.4)' }}>
              <i className={`fa-solid ${f.icon}`} style={{ fontSize: '9px' }} />{f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? (
          <div className="card rounded-2xl p-12 text-center">
            <i className="fa-solid fa-cubes text-3xl mb-3" style={{ color: 'rgba(143,163,192,.12)' }} />
            <div className="text-sm" style={{ color: 'rgba(143,163,192,.3)' }}>
              No {category === 'all' ? 'assets' : category === 'ped' ? 'PEDs' : 'equipment'} assigned to this site
            </div>
            {canEdit && (
              <div className="text-xs mt-2" style={{ color: 'rgba(143,163,192,.25)' }}>
                Add assets in the Trackers → PEDs or Equipment tab
              </div>
            )}
          </div>
        )
        : (
          <div className="card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'rgba(201,168,76,.04)', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
                  <tr>
                    {['Category', 'Serial #', 'Make / Model', 'Type', 'Location', 'Assigned To', 'Status', 'Approval'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap"
                        style={{ color: 'rgba(143,163,192,.5)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    const sc = ASSET_STATUS_CFG[a.status]   || ASSET_STATUS_CFG['active'];
                    const ac = ASSET_APPROVAL_CFG[a.approvalStatus];
                    return (
                      <tr key={a.id} className="border-t hover:bg-[rgba(201,168,76,.02)] transition-colors"
                        style={{ borderColor: 'rgba(201,168,76,.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(6,18,31,.2)' }}>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded"
                            style={{ background: a.category === 'ped' ? 'rgba(96,165,250,.1)' : 'rgba(167,139,250,.1)', color: a.category === 'ped' ? '#60A5FA' : '#A78BFA', border: `1px solid ${a.category === 'ped' ? 'rgba(96,165,250,.2)' : 'rgba(167,139,250,.2)'}` }}>
                            {a.category === 'ped' ? 'PED' : 'Equipment'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>{a.serialNumber || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold" style={{ color: 'var(--off-white)' }}>{a.make || '—'}</div>
                          <div className="text-[9px]" style={{ color: 'rgba(143,163,192,.35)' }}>{a.model || ''}</div>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(143,163,192,.5)' }}>{a.type || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{a.location || '—'}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(143,163,192,.5)' }}>{a.assignedTo || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{ background: `${sc.color}15`, border: `1px solid ${sc.color}30`, color: sc.color }}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {ac && (
                            <span className="text-[9px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: `${ac.color}12`, color: ac.color }}>
                              {ac.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}

// ── PDF viewer modal (shared) ─────────────────────────────────────────────────

function PdfViewerModal({ url, title, onClose }) {
  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4" style={{ background: 'rgba(6,18,31,.92)' }}>
      <div className="w-full max-w-5xl h-[85vh] flex flex-col card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(201,168,76,.1)' }}>
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--gold)' }}>{title}</div>
          <div className="flex items-center gap-x-2 shrink-0">
            <a href={url} download target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)' }}>
              <i className="fa-solid fa-download text-[9px]" /> Download
            </a>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#FCA5A5' }}>
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe src={url} title="Report" className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
}

// ── Inspection entry (expandable row) ─────────────────────────────────────────

const APPROVAL_COLORS = {
  'accepted':          { color: '#10B981', label: 'Accepted'          },
  'pending_review':    { color: '#F59E0B', label: 'Pending Review'    },
  'pending':           { color: '#F59E0B', label: 'Pending Review'    },
  'needs_correction':  { color: '#F97316', label: 'Needs Correction'  },
  'needs-correction':  { color: '#F97316', label: 'Needs Correction'  },
  'rejected':          { color: '#EF4444', label: 'Rejected'          },
};

const LESSON_TYPES_MAP = {
  'lesson-learned':    { label: 'Lesson Learned',   color: '#60A5FA', icon: 'fa-lightbulb' },
  'best-practice':     { label: 'Best Practice',    color: '#10B981', icon: 'fa-star'      },
  'corrective-action': { label: 'Corrective Action',color: '#F97316', icon: 'fa-wrench'   },
};

function InspectionEntry({ record, type, siteId, siteName, lessons, canEdit, currentUser, onUpload, onRefresh }) {
  const [expanded,     setExpanded]     = useState(false);
  const [viewUrl,      setViewUrl]      = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);

  const isGold    = type === 'self';
  const color     = isGold ? '#c9a84c' : '#60A5FA';
  const typeLabel = isGold ? 'Self-Inspection' : 'DCSA Inspection';
  const fileName  = record.reportFileName;
  const approval  = APPROVAL_COLORS[record.approvalStatus];
  const isAdmin   = currentUser?.role === 'global_fso' || currentUser?.role === 'director_industrial_sec';

  // Lesson entries for this record — inspection-specific first, then all site lessons
  const allSite = (lessons || []).filter(l => l.siteId === siteId);
  const linked  = allSite.filter(l => l.inspectionId === record.id);
  const general = allSite.filter(l => !l.inspectionId);
  const fsoEntries  = (linked.length > 0 ? linked : general).filter(l => l.submittedBy !== 'CSO');
  const csoEntries  = allSite.filter(l => l.submittedBy === 'CSO' && (l.inspectionId === record.id || !l.inspectionId));

  function openCsoReview() {
    const today = new Date().toISOString().slice(0, 10);
    MASH.openModal(`Add CSO Review — ${siteName || siteId}`,
      `<div class="space-y-5">
        <div class="p-3 rounded-xl text-xs" style="background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.2);color:rgba(167,139,250,.8)">
          <i class="fa-solid fa-shield-halved mr-1.5"></i>Your review will be attached to this inspection record and shared with the FSO.
        </div>
        <div>
          <div class="inp-lbl mb-2" style="color:#60A5FA"><i class="fa-solid fa-lightbulb mr-1.5"></i>CSO Lesson / Observation</div>
          <input name="ll_title" class="inp mb-2" placeholder="Title…" />
          <textarea name="ll_body" rows="2" class="inp" placeholder="Your assessment or lesson from this inspection…"></textarea>
        </div>
        <div>
          <div class="inp-lbl mb-2" style="color:#10B981"><i class="fa-solid fa-star mr-1.5"></i>CSO Best Practice / Recommendation</div>
          <input name="bp_title" class="inp mb-2" placeholder="Title…" />
          <textarea name="bp_body" rows="2" class="inp" placeholder="Best practice or recommendation from CSO perspective…"></textarea>
        </div>
        <div>
          <div class="inp-lbl mb-2" style="color:#F97316"><i class="fa-solid fa-wrench mr-1.5"></i>CSO Corrective Guidance</div>
          <label class="flex items-center gap-x-2 mb-2 cursor-pointer" style="color:rgba(143,163,192,.6);font-size:11px">
            <input type="checkbox" id="cso_no_ca" onchange="document.getElementById('cso_ca').style.display=this.checked?'none':'block'" />
            No corrective guidance needed
          </label>
          <div id="cso_ca">
            <input name="ca_title" class="inp mb-2" placeholder="Corrective guidance title…" />
            <textarea name="ca_body" rows="2" class="inp" placeholder="What the FSO should correct or improve…"></textarea>
          </div>
        </div>
      </div>`,
      `<button onclick="MASH._saveCsoReview()" class="btn-gold"><i class="fa-solid fa-shield-halved text-[9px]"></i> Save CSO Review</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.5)">Cancel</button>`
    );
    MASH._saveCsoReview = async () => {
      const get = n => document.querySelector(`#modal-body [name="${n}"]`)?.value?.trim() || '';
      const noCa = document.getElementById('cso_no_ca')?.checked;
      if (!get('ll_title') || !get('ll_body')) { MASH.toast('Observation is required', 'error'); return; }
      if (!get('bp_title') || !get('bp_body')) { MASH.toast('Recommendation is required', 'error'); return; }
      const base = { siteId, siteName: siteName || siteId, submittedBy: 'CSO', submittedDate: today, visibility: 'shared', status: 'approved', tags: [], inspectionId: record.id };
      await Promise.all([
        API.post('lessons', { ...base, id: 'cso-'+Date.now().toString(36)+'a', type: 'lesson-learned',    title: get('ll_title'), body: get('ll_body') }),
        API.post('lessons', { ...base, id: 'cso-'+Date.now().toString(36)+'b', type: 'best-practice',     title: get('bp_title'), body: get('bp_body') }),
        ...(noCa ? [] : [API.post('lessons', { ...base, id: 'cso-'+Date.now().toString(36)+'c', type: 'corrective-action', title: get('ca_title'), body: get('ca_body') })]),
      ]);
      if (record.approvalStatus === 'pending_review') {
        await API.patch('self-inspections', record.id, { ...record, approvalStatus: 'accepted', approvedBy: currentUser?.name || 'CSO', approvedDate: today });
      }
      MASH.closeModal();
      if (onRefresh) onRefresh();
      MASH.toast('CSO review saved', 'success');
    };
  }

  async function changeApproval(status) {
    await API.patch('self-inspections', record.id, { ...record, approvalStatus: status, approvedBy: currentUser?.name || 'Admin', approvedDate: new Date().toISOString().slice(0, 10) });
    if (onRefresh) onRefresh();
    MASH.toast('Status updated', 'success');
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden transition-all"
        style={{ border: `1px solid ${expanded ? color + '40' : 'rgba(201,168,76,.1)'}`, background: expanded ? `${color}05` : 'transparent' }}>

        {/* Header row — always visible, click to expand */}
        <button onClick={() => setExpanded(v => !v)} className="w-full text-left p-4 flex items-center gap-x-4 group">
          {/* Date badge */}
          <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
            style={{ background: `${color}15`, border: `1px solid ${color}35` }}>
            <div className="font-head font-bold text-base leading-none" style={{ color }}>
              {new Date(record.inspectionDate + 'T12:00:00Z').toLocaleDateString('en-US', { day: 'numeric' })}
            </div>
            <div className="text-[9px] uppercase tracking-wider font-semibold mt-0.5" style={{ color: `${color}90` }}>
              {new Date(record.inspectionDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-x-2 flex-wrap gap-y-1">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{typeLabel}</span>
              {approval && (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded"
                  style={{ background: `${approval.color}15`, border: `1px solid ${approval.color}30`, color: approval.color }}>
                  {approval.label}
                </span>
              )}
              {type === 'dcsa' && record.findings !== undefined && (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded"
                  style={{ background: record.findings === 0 ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', color: record.findings === 0 ? '#10B981' : '#EF4444', border: `1px solid ${record.findings === 0 ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}` }}>
                  {record.findings === 0 ? 'No Findings' : `${record.findings} Finding${record.findings !== 1 ? 's' : ''}`}
                </span>
              )}
              {type === 'dcsa' && record.inspector && (
                <span className="text-[9px]" style={{ color: 'rgba(143,163,192,.4)' }}>{record.inspector}</span>
              )}
            </div>
            {record.notes && (
              <div className="text-[10px] mt-1 line-clamp-1" style={{ color: 'rgba(143,163,192,.4)' }}>{record.notes}</div>
            )}
          </div>

          <div className="flex items-center gap-x-2 shrink-0">
            {fileName && (
              <span className="inline-flex items-center gap-x-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold"
                style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)', color: 'rgba(201,168,76,.6)' }}>
                <i className="fa-solid fa-file-pdf text-[8px]" /> Report
              </span>
            )}
            <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] transition-transform`}
              style={{ color: 'rgba(143,163,192,.35)' }} />
          </div>
        </button>

        {/* Expanded body */}
        {expanded && (
          <div className="px-4 pb-5 space-y-4 border-t" style={{ borderColor: `${color}20` }}>

            {/* Approval row (admin only) */}
            {isAdmin && type === 'self' && (
              <div className="pt-3 flex items-center gap-x-3 flex-wrap gap-y-2">
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(143,163,192,.4)' }}>Review Status:</span>
                <select
                  value={record.approvalStatus || 'pending_review'}
                  onChange={e => changeApproval(e.target.value)}
                  className="inp text-xs py-1"
                  style={{ width: 'auto', minWidth: '170px' }}>
                  <option value="pending_review">Pending Review</option>
                  <option value="accepted">Accepted</option>
                  <option value="needs_correction">Needs Correction</option>
                  <option value="rejected">Rejected</option>
                </select>
                {record.approvedBy && (
                  <span className="text-[9px]" style={{ color: 'rgba(143,163,192,.35)' }}>
                    by {record.approvedBy}{record.approvedDate ? ` · ${fmtDate(record.approvedDate)}` : ''}
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {record.notes && (
              <div className="text-xs leading-relaxed" style={{ color: 'rgba(143,163,192,.55)' }}>{record.notes}</div>
            )}

            {/* Report file actions */}
            <div className="flex items-center gap-x-3 flex-wrap gap-y-2">
              {fileName
                ? (
                  <button onClick={() => setViewUrl(`/uploads/${siteId}/${fileName}`)}
                    className="inline-flex items-center gap-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.25)', color: '#60A5FA' }}>
                    <i className="fa-solid fa-eye text-[10px]" /> View Report
                  </button>
                )
                : <span className="text-xs" style={{ color: 'rgba(143,163,192,.3)' }}>No report file on record</span>}
              {type === 'self' && canEdit && (
                <label className="inline-flex items-center gap-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)' }}>
                  <i className="fa-solid fa-upload text-[10px]" /> Upload / Replace
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => onUpload && onUpload(e, record)} />
                </label>
              )}
            </div>

            {/* ── FSO Inspection Notes ── */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,.1)' }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(6,18,31,.5)', borderBottom: '1px solid rgba(201,168,76,.08)' }}>
                <div className="flex items-center gap-x-2">
                  <i className="fa-solid fa-user-shield text-[9px]" style={{ color: 'var(--gold)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(201,168,76,.7)' }}>
                    FSO Inspection Notes ({fsoEntries.length})
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-2" style={{ background: 'rgba(6,18,31,.25)' }}>
                {fsoEntries.length === 0
                  ? <div className="py-5 text-center text-xs" style={{ color: 'rgba(143,163,192,.3)' }}>
                      No FSO notes for this inspection yet
                    </div>
                  : fsoEntries.map(l => {
                    const tc = LESSON_TYPES_MAP[l.type] || LESSON_TYPES_MAP['lesson-learned'];
                    return (
                      <button key={l.id} onClick={() => setSelectedNote(l)}
                        className="w-full text-left rounded-xl p-3 group hover:opacity-90 transition-opacity"
                        style={{ background: `${tc.color}08`, border: `1px solid ${tc.color}18`, cursor: 'pointer' }}>
                        <div className="flex items-center gap-x-2 mb-1">
                          <span className="inline-flex items-center gap-x-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                            style={{ background: `${tc.color}18`, color: tc.color }}>
                            <i className={`fa-solid ${tc.icon}`} style={{ fontSize: '7px' }} />{tc.label}
                          </span>
                          <span className="text-[8px]" style={{ color: 'rgba(143,163,192,.3)' }}>{l.submittedBy} · {l.submittedDate}</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[7px] ml-auto opacity-0 group-hover:opacity-100" style={{ color: tc.color }} />
                        </div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--off-white)' }}>{l.title}</div>
                        <div className="text-[9px] mt-0.5 line-clamp-2" style={{ color: 'rgba(143,163,192,.45)' }}>{l.body}</div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* ── CSO Review ── */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(167,139,250,.15)' }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(6,18,31,.5)', borderBottom: '1px solid rgba(167,139,250,.1)' }}>
                <div className="flex items-center gap-x-2">
                  <i className="fa-solid fa-shield-halved text-[9px]" style={{ color: '#A78BFA' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(167,139,250,.7)' }}>
                    CSO Review ({csoEntries.length})
                  </span>
                </div>
                {isAdmin && (
                  <button onClick={openCsoReview}
                    className="inline-flex items-center gap-x-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold"
                    style={{ background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.25)', color: '#A78BFA' }}>
                    <i className="fa-solid fa-plus text-[8px]" /> Add Review
                  </button>
                )}
              </div>
              <div className="p-4 space-y-2" style={{ background: 'rgba(6,18,31,.25)' }}>
                {csoEntries.length === 0
                  ? <div className="py-5 text-center text-xs" style={{ color: 'rgba(143,163,192,.3)' }}>
                      {isAdmin
                        ? 'No CSO review yet — click Add Review above to add your inputs'
                        : 'Awaiting CSO review'}
                    </div>
                  : csoEntries.map(l => {
                    const tc = LESSON_TYPES_MAP[l.type] || LESSON_TYPES_MAP['lesson-learned'];
                    return (
                      <button key={l.id} onClick={() => setSelectedNote(l)}
                        className="w-full text-left rounded-xl p-3 group hover:opacity-90 transition-opacity"
                        style={{ background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.15)', cursor: 'pointer' }}>
                        <div className="flex items-center gap-x-2 mb-1">
                          <span className="inline-flex items-center gap-x-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                            style={{ background: `${tc.color}18`, color: tc.color }}>
                            <i className={`fa-solid ${tc.icon}`} style={{ fontSize: '7px' }} />{tc.label}
                          </span>
                          <span className="text-[8px] font-bold" style={{ color: '#A78BFA' }}>CSO</span>
                          <span className="text-[8px]" style={{ color: 'rgba(143,163,192,.3)' }}>{l.submittedDate}</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[7px] ml-auto opacity-0 group-hover:opacity-100" style={{ color: '#A78BFA' }} />
                        </div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--off-white)' }}>{l.title}</div>
                        <div className="text-[9px] mt-0.5 line-clamp-2" style={{ color: 'rgba(143,163,192,.45)' }}>{l.body}</div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {viewUrl && <PdfViewerModal url={viewUrl} title={`${typeLabel} — ${fmtDate(record.inspectionDate)}`} onClose={() => setViewUrl(null)} />}
      {selectedNote && <NoteDetailModal note={selectedNote} isCso={selectedNote.submittedBy === 'CSO'} onClose={() => setSelectedNote(null)} />}
    </>
  );
}

// ── Inspection Reports Tab ────────────────────────────────────────────────────

function ReportsTab({ site, selfInspections, dcsaInspections, lessons, canEdit, currentUser, onRefresh }) {
  const fileRef   = useRef();
  const [uploading, setUploading] = useState(false);

  const siteSelfs = (selfInspections || [])
    .filter(r => r.siteId === site.id)
    .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));
  const siteDCSA  = (dcsaInspections || [])
    .filter(r => r.siteId === site.id)
    .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));

  async function handleNewUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const submittedBy = currentUser?.name || 'FSO';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('siteId', site.id);
    fd.append('siteName', site.name);
    fd.append('type', 'self-inspection');
    fd.append('uploadedBy', submittedBy);
    try {
      const r = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('mash-token')}` }, body: fd });
      const d = await r.json();
      if (!r.ok) { MASH.toast(d.error || 'Upload failed', 'error'); return; }

      const fileName = d.data?.fileName || file.name;
      const inspId   = 'si-' + Date.now().toString(36);
      const today    = new Date().toISOString().slice(0, 10);
      const caId     = 'nocacheck-' + Date.now();

      // Post-upload form: FSO must fill in lessons, best practice, corrective actions
      MASH.openModal(`Complete Inspection Submission — ${site.name}`,
        `<div class="space-y-5">
          <div class="p-3 rounded-xl flex items-center gap-x-2" style="background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.25)">
            <i class="fa-solid fa-circle-check" style="color:#10B981"></i>
            <div>
              <div style="color:#10B981;font-size:11px;font-weight:600">${fileName} uploaded</div>
              <div style="color:rgba(143,163,192,.5);font-size:10px">Complete the required fields below before submitting to CSO for review.</div>
            </div>
          </div>
          <div><label class="inp-lbl">Inspection Date *</label><input type="date" name="inspDate" class="inp" value="${today}"/></div>
          <div>
            <div class="inp-lbl mb-1.5" style="color:#60A5FA"><i class="fa-solid fa-lightbulb mr-1.5"></i>Lesson Learned <span style="color:#EF4444">*</span></div>
            <input name="ll_title" class="inp mb-2" placeholder="What was the key lesson from this inspection?"/>
            <textarea name="ll_body" rows="2" class="inp" placeholder="Describe in detail…"></textarea>
          </div>
          <div>
            <div class="inp-lbl mb-1.5" style="color:#10B981"><i class="fa-solid fa-star mr-1.5"></i>Best Practice <span style="color:#EF4444">*</span></div>
            <input name="bp_title" class="inp mb-2" placeholder="Best practice applied or discovered?"/>
            <textarea name="bp_body" rows="2" class="inp" placeholder="Describe the practice…"></textarea>
          </div>
          <div>
            <div class="inp-lbl mb-1.5" style="color:#F97316"><i class="fa-solid fa-wrench mr-1.5"></i>Corrective Actions</div>
            <label class="flex items-center gap-x-2 mb-2 cursor-pointer" style="color:rgba(143,163,192,.6);font-size:11px">
              <input type="checkbox" id="${caId}" onchange="document.getElementById('caflds${caId}').style.display=this.checked?'none':'block'"/>
              No corrective actions from this inspection
            </label>
            <div id="caflds${caId}">
              <input name="ca_title" class="inp mb-2" placeholder="Corrective action title…"/>
              <textarea name="ca_body" rows="2" class="inp" placeholder="What needs to be corrected?"></textarea>
            </div>
          </div>
        </div>`,
        `<button onclick="MASH._submitInspectionReport()" class="btn-gold"><i class="fa-solid fa-paper-plane text-[9px]"></i> Submit to CSO for Review</button>
         <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.5)">Save Draft</button>`
      );

      MASH._submitInspectionReport = async () => {
        const get  = n => document.querySelector(`#modal-body [name="${n}"]`)?.value?.trim() || '';
        const noCa = document.getElementById(caId)?.checked;
        if (!get('ll_title') || !get('ll_body')) { MASH.toast('Lesson Learned is required', 'error'); return; }
        if (!get('bp_title') || !get('bp_body')) { MASH.toast('Best Practice is required', 'error'); return; }
        if (!noCa && (!get('ca_title') || !get('ca_body'))) { MASH.toast('Fill Corrective Action or check "No corrective actions"', 'error'); return; }

        const inspDate = get('inspDate') || today;
        const dueDate  = new Date(new Date(inspDate+'T12:00:00Z').setFullYear(new Date(inspDate+'T12:00:00Z').getFullYear()+1)).toISOString().slice(0,10);
        const base     = { siteId: site.id, siteName: site.name, submittedBy, submittedDate: today, visibility: 'shared', status: 'pending', tags: [], inspectionId: inspId };

        await API.post('self-inspections', {
          id: inspId, siteId: site.id, siteName: site.name,
          inspectionDate: inspDate, dueDate,
          reportFileName: fileName, uploadedBy: submittedBy,
          approvalStatus: 'pending_review', notes: '',
        });

        await Promise.all([
          API.post('lessons', { ...base, id: 'fso-'+Date.now().toString(36)+'a', type: 'lesson-learned',    title: get('ll_title'), body: get('ll_body') }),
          API.post('lessons', { ...base, id: 'fso-'+Date.now().toString(36)+'b', type: 'best-practice',     title: get('bp_title'), body: get('bp_body') }),
          ...(noCa ? [] : [API.post('lessons', { ...base, id: 'fso-'+Date.now().toString(36)+'c', type: 'corrective-action', title: get('ca_title'), body: get('ca_body') })]),
        ]);

        await API.patch('sites', site.id, {
          lastSelfInspectionDate: inspDate,
          selfInspectionDueDate: dueDate,
        });

        // Notify CSO
        API.post('inspection-submitted', { siteId: site.id, siteName: site.name, fsoName: submittedBy, inspectionDate: inspDate }).catch(() => {});

        MASH.closeModal();
        onRefresh();
        MASH.toast('Inspection submitted — CSO has been notified', 'success');
      };

    } catch { MASH.toast('Upload error', 'error'); }
    finally  { setUploading(false); e.target.value = ''; }
  }

  return (
    <div className="space-y-6">

      {/* Upload new self-inspection */}
      {canEdit && (
        <div className="flex items-center justify-between p-4 rounded-2xl"
          style={{ background: 'rgba(201,168,76,.04)', border: '1px dashed rgba(201,168,76,.2)' }}>
          <div>
            <div className="text-xs font-semibold" style={{ color: 'var(--off-white)' }}>Upload New Self-Inspection Report</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'rgba(143,163,192,.35)' }}>PDF or Word document · max 50 MB</div>
          </div>
          <>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleNewUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)', color: 'var(--gold)' }}>
              <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'} text-[10px]`} />
              {uploading ? 'Uploading…' : 'Upload Report'}
            </button>
          </>
        </div>
      )}

      {/* Self-Inspection History */}
      <div>
        <div className="flex items-center gap-x-3 mb-3">
          <div className="sec-heading">Self-Inspection History</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(201,168,76,.1)', color: 'rgba(201,168,76,.6)' }}>{siteSelfs.length}</span>
        </div>
        {siteSelfs.length === 0
          ? (
            <div className="card rounded-2xl p-10 text-center">
              <i className="fa-solid fa-clipboard-list text-3xl mb-3" style={{ color: 'rgba(143,163,192,.12)' }} />
              <div className="text-sm" style={{ color: 'rgba(143,163,192,.3)' }}>No self-inspection records for this site</div>
            </div>
          )
          : (
            <div className="space-y-3">
              {siteSelfs.map(r => (
                <InspectionEntry key={r.id} record={r} type="self" siteId={site.id} siteName={site.name}
                  lessons={lessons} canEdit={canEdit} currentUser={currentUser} onUpload={handleNewUpload} onRefresh={onRefresh} />
              ))}
            </div>
          )}
      </div>

      {/* DCSA Inspection History */}
      <div>
        <div className="flex items-center gap-x-3 mb-3">
          <div className="sec-heading">DCSA Inspection History</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(96,165,250,.1)', color: 'rgba(96,165,250,.6)' }}>{siteDCSA.length}</span>
          {site.nextDcsaInspectionDate && (
            <span className="text-[10px]" style={{ color: 'rgba(96,165,250,.5)' }}>
              · Next: {fmtDate(site.nextDcsaInspectionDate)}
            </span>
          )}
        </div>
        {siteDCSA.length === 0
          ? (
            <div className="card rounded-2xl p-10 text-center">
              <i className="fa-solid fa-shield-halved text-3xl mb-3" style={{ color: 'rgba(143,163,192,.12)' }} />
              <div className="text-sm" style={{ color: 'rgba(143,163,192,.3)' }}>No DCSA inspection records for this site</div>
            </div>
          )
          : (
            <div className="space-y-3">
              {siteDCSA.map(r => (
                <InspectionEntry key={r.id} record={r} type="dcsa" siteId={site.id} siteName={site.name}
                  lessons={lessons} canEdit={canEdit} currentUser={currentUser} onRefresh={onRefresh} />
              ))}
            </div>
          )}
      </div>

    </div>
  );
}

// ── Knowledge Base Tab ────────────────────────────────────────────────────────

function KnowledgeBaseTab({ site, lessons, canEdit, onRefresh }) {
  const [subTab,       setSubTab]       = useState('lesson-learned');
  const [search,       setSearch]       = useState('');
  const [selectedNote, setSelectedNote] = useState(null);

  const filtered = (lessons || []).filter(l =>
    l.siteId === site.id && l.type === subTab &&
    (!search || l.title?.toLowerCase().includes(search.toLowerCase()) || l.body?.toLowerCase().includes(search.toLowerCase()))
  );

  function openAdd(type) {
    MASH.openModal(`Add ${LESSON_TYPES[type]?.label || 'Entry'} — ${site.name}`, `
      <div class="space-y-4">
        <div><label class="inp-lbl">Title</label><input name="title" class="inp" placeholder="Brief title…" /></div>
        <div><label class="inp-lbl">Details</label><textarea name="body" rows="5" class="inp" placeholder="Describe in detail…"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="inp-lbl">Visibility</label>
            <select name="visibility" class="inp">
              <option value="shared">Shared with all FSOs</option>
              <option value="site-only">Site Only</option>
              <option value="admin-only">Admin Only</option>
            </select>
          </div>
          <div><label class="inp-lbl">Tags (comma-separated)</label><input name="tags" class="inp" placeholder="e.g. dcsa, tempest" /></div>
        </div>
      </div>`,
      `<button onclick="MASH._saveKBEntry()" class="btn-gold">Save</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.5)">Cancel</button>`
    );
    MASH._saveKBEntry = async () => {
      const inputs = document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea');
      const entry  = { type, siteId: site.id, siteName: site.name, status: 'approved', submittedDate: new Date().toISOString().slice(0, 10) };
      inputs.forEach(i => { if (i.name) entry[i.name] = i.value; });
      entry.tags = entry.tags ? entry.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const r = await API.post('lessons', entry);
      if (r?.ok) { MASH.closeModal(); onRefresh(); MASH.toast('Entry added', 'success'); }
      else        { MASH.toast('Save failed', 'error'); }
    };
  }

  const SUB_TABS = [
    { id: 'lesson-learned',    label: 'Lessons Learned',   icon: 'fa-lightbulb' },
    { id: 'best-practice',     label: 'Best Practices',    icon: 'fa-star'      },
    { id: 'corrective-action', label: 'Corrective Actions',icon: 'fa-wrench'    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-y-3">
        <div className="flex items-center gap-x-1 flex-wrap gap-y-1">
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className="px-3.5 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all"
              style={subTab === t.id
                ? { background: LESSON_TYPES[t.id].color + '22', border: `1px solid ${LESSON_TYPES[t.id].color}44`, color: LESSON_TYPES[t.id].color }
                : { background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)', color: 'rgba(143,163,192,.5)' }}>
              <i className={`fa-solid ${t.icon} mr-1`} style={{ fontSize: '8px' }} />{t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-x-2">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[9px]" style={{ color: 'rgba(201,168,76,.4)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="inp pl-8 text-xs py-1.5 w-40" />
          </div>
          {canEdit && (
            <button onClick={() => openAdd(subTab)} className="btn-gold">
              <i className="fa-solid fa-plus text-[9px]" /> Add
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0
        ? (
          <div className="card rounded-2xl p-12 text-center">
            <i className={`fa-solid ${LESSON_TYPES[subTab]?.icon || 'fa-file'} text-3xl mb-3`} style={{ color: 'rgba(143,163,192,.15)' }} />
            <div className="text-sm" style={{ color: 'rgba(143,163,192,.3)' }}>No {LESSON_TYPES[subTab]?.label?.toLowerCase()} entries for this site yet</div>
          </div>
        )
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(l => {
              const tc = LESSON_TYPES[l.type];
              return (
                <button key={l.id} onClick={() => setSelectedNote(l)}
                  className="w-full text-left card rounded-2xl p-5 flex flex-col gap-y-3 group transition-all hover:scale-[1.01]"
                  style={{ borderLeft: `3px solid ${tc.color}`, cursor: 'pointer' }}>
                  <div className="flex items-start justify-between gap-x-2">
                    <div className="font-semibold text-sm leading-snug" style={{ color: 'var(--off-white)' }}>{l.title}</div>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: tc.color }} />
                  </div>
                  <div className="text-xs leading-relaxed line-clamp-3" style={{ color: 'rgba(143,163,192,.5)' }}>{l.body}</div>
                  {l.adminComment && (
                    <div className="rounded-lg p-2 text-[9px]" style={{ background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.15)', color: 'rgba(167,139,250,.6)' }}>
                      <i className="fa-solid fa-comment-dots mr-1" />CSO comment attached
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    {l.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {l.tags.slice(0, 3).map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-[8px] font-mono"
                            style={{ background: 'rgba(201,168,76,.06)', color: 'rgba(201,168,76,.45)' }}>#{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-[9px] ml-auto" style={{ color: 'rgba(143,163,192,.25)' }}>{l.submittedBy} · {l.submittedDate}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      {selectedNote && <NoteDetailModal note={selectedNote} isCso={false} onClose={() => setSelectedNote(null)} />}
    </div>
  );
}

// ── Documents Tab ────────────────────────────────────────────────────────────

const DOC_TYPES   = { ffc: 'FFC', csp: 'CSP', tempest: 'TEMPEST', sap: 'SAP', other: 'Other' };
const DOC_STATUS  = {
  draft:       { label: 'Draft',        color: '#6B7280' },
  pending_fso: { label: 'Pending FSO',  color: '#F59E0B' },
  submitted:   { label: 'Submitted',    color: '#60A5FA' },
  accredited:  { label: 'Accredited',   color: '#10B981' },
};

function DocumentsTab({ site, documents, canEdit, onRefresh }) {
  const siteDocs = (documents || []).filter(d => d.siteId === site.id)
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));

  function openAdd() {
    MASH.openModal(`Add Document — ${site.name}`, `
      <div class="space-y-4">
        <div><label class="inp-lbl">Title</label><input name="title" class="inp" placeholder="e.g. Fixed Facility Checklist v4.0" /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="inp-lbl">Type</label>
            <select name="type" class="inp">
              <option value="ffc">FFC — Fixed Facility Checklist</option>
              <option value="csp">CSP — Construction Security Plan</option>
              <option value="tempest">TEMPEST Assessment</option>
              <option value="sap">SAP Addendum</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><label class="inp-lbl">Status</label>
            <select name="status" class="inp">
              <option value="draft">Draft</option>
              <option value="pending_fso">Pending FSO</option>
              <option value="submitted">Submitted</option>
              <option value="accredited">Accredited</option>
            </select>
          </div>
          <div><label class="inp-lbl">Version</label><input name="version" class="inp" placeholder="e.g. v1.0" /></div>
          <div><label class="inp-lbl">Submitted By</label><input name="submittedBy" class="inp" value="${site.fsoName || ''}" /></div>
        </div>
        <div><label class="inp-lbl">Notes</label><textarea name="notes" rows="2" class="inp"></textarea></div>
      </div>`,
      `<button onclick="MASH._saveDoc()" class="btn-gold">Add Document</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.5)">Cancel</button>`
    );
    MASH._saveDoc = async () => {
      const inputs = document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea');
      const doc    = { id: uid(), siteId: site.id, siteName: site.name, createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10) };
      inputs.forEach(i => { if (i.name) doc[i.name] = i.value; });
      const r = await API.post('documents', doc);
      if (r?.ok || r?.data) { MASH.closeModal(); onRefresh(); MASH.toast('Document added', 'success'); }
      else                   { MASH.toast('Save failed', 'error'); }
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="sec-heading">Site Documents</div>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(143,163,192,.35)' }}>All documents associated with this facility — FFCs, CSPs, assessments, and more</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="btn-gold">
            <i className="fa-solid fa-plus text-[9px]" /> Add Document
          </button>
        )}
      </div>

      {siteDocs.length === 0
        ? (
          <div className="card rounded-2xl p-12 text-center">
            <i className="fa-solid fa-file-circle-plus text-3xl mb-3" style={{ color: 'rgba(143,163,192,.12)' }} />
            <div className="text-sm" style={{ color: 'rgba(143,163,192,.3)' }}>No documents on file for this site</div>
          </div>
        )
        : (
          <div className="card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'rgba(201,168,76,.04)', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
                  <tr>
                    {['Title', 'Type', 'Version', 'Status', 'Submitted By', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold"
                        style={{ color: 'rgba(143,163,192,.5)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {siteDocs.map((doc, i) => {
                    const sc = DOC_STATUS[doc.status] || DOC_STATUS['draft'];
                    return (
                      <tr key={doc.id} className="border-t transition-colors hover:bg-[rgba(201,168,76,.02)]"
                        style={{ borderColor: 'rgba(201,168,76,.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(6,18,31,.2)' }}>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold" style={{ color: 'var(--off-white)' }}>{doc.title}</div>
                          {doc.notes && <div className="text-[9px] mt-0.5 italic" style={{ color: 'rgba(143,163,192,.35)' }}>{doc.notes}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded"
                            style={{ background: 'rgba(201,168,76,.08)', color: 'rgba(201,168,76,.6)' }}>
                            {DOC_TYPES[doc.type] || doc.type?.toUpperCase() || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgba(143,163,192,.45)' }}>{doc.version || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded"
                            style={{ background: `${sc.color}15`, border: `1px solid ${sc.color}30`, color: sc.color }}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(143,163,192,.45)' }}>{doc.submittedBy || '—'}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(143,163,192,.35)' }}>{fmtDate(doc.updatedAt || doc.createdAt)}</td>
                        <td className="px-4 py-3">
                          {doc.fileRef && (
                            <a href={doc.fileRef} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-x-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold"
                              style={{ background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)', color: '#60A5FA' }}>
                              <i className="fa-solid fa-eye text-[8px]" /> View
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}

// ── CSO Notes Tab ─────────────────────────────────────────────────────────────

function CSONotesTab({ site, cisoNotes, canEdit, onRefresh }) {
  const [selectedNote, setSelectedNote] = useState(null);
  const safeNotes = Array.isArray(cisoNotes) ? cisoNotes : [];
  const notes = safeNotes.filter(n => {
    try { return !n.siteId || n.siteId === '' || n.siteId === site.id; }
    catch { return false; }
  });

  function openAdd() {
    MASH.openModal('Add CSO Note',
      `<div class="space-y-4">
        <div><label class="inp-lbl">Title</label><input name="title" class="inp" placeholder="Note title…" /></div>
        <div><label class="inp-lbl">Type</label>
          <select name="type" class="inp">
            <option value="guidance">Guidance</option>
            <option value="directive">Directive</option>
            <option value="strategic-priority">Strategic Priority</option>
            <option value="site-assessment">Site Assessment</option>
          </select>
        </div>
        <div><label class="inp-lbl">Note Body</label><textarea name="body" rows="5" class="inp" placeholder="Enter CSO guidance, directive, or assessment…"></textarea></div>
        <div><label class="inp-lbl">Visibility</label>
          <select name="visibility" class="inp">
            <option value="all-fsos">All FSOs</option>
            <option value="admin-only">Admin Only</option>
          </select>
        </div>
      </div>`,
      `<button onclick="MASH._saveCSONote()" class="btn-gold">Save Note</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.5)">Cancel</button>`
    );
    MASH._saveCSONote = async () => {
      const inputs = document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea');
      const note   = { id: 'cn-' + Date.now(), siteId: site.id, siteName: site.name, submittedBy: 'CSO', submittedDate: new Date().toISOString().slice(0, 10), actionItems: [], tags: [] };
      inputs.forEach(i => { if (i.name) note[i.name] = i.value; });
      try {
        const r = await API.post('ciso-notes', note);
        if (r?.ok || r?.data) { MASH.closeModal(); onRefresh(); MASH.toast('CSO note added', 'success'); }
        else { MASH.toast('Save failed — check server connection', 'error'); }
      } catch (err) { MASH.toast('Error saving note', 'error'); }
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="sec-heading">CSO Notes &amp; Directives</div>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(143,163,192,.35)' }}>Chief Security Officer inputs and directives</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="btn-gold">
            <i className="fa-solid fa-plus text-[9px]" /> Add Note
          </button>
        )}
      </div>

      {notes.length === 0
        ? (
          <div className="card rounded-2xl p-12 text-center">
            <i className="fa-solid fa-comment-dots text-3xl mb-3" style={{ color: 'rgba(143,163,192,.15)' }} />
            <div className="text-sm" style={{ color: 'rgba(143,163,192,.3)' }}>No CSO notes for this site</div>
          </div>
        )
        : notes.map((n, idx) => {
          const tc = NOTE_TYPES[n.type] || NOTE_TYPES['guidance'];
          const actionItems = Array.isArray(n.actionItems) ? n.actionItems : [];
          return (
            <div key={n.id || idx} role="button" tabIndex={0}
              onClick={() => setSelectedNote(n)}
              onKeyDown={e => e.key === 'Enter' && setSelectedNote(n)}
              className="w-full text-left card rounded-2xl p-5 flex flex-col gap-y-3 group transition-all hover:scale-[1.005]"
              style={{ borderLeft: `3px solid ${tc.color}`, cursor: 'pointer' }}>
              <div className="flex items-start justify-between gap-x-3 flex-wrap gap-y-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-x-2 mb-1 flex-wrap gap-y-1">
                    <span className="inline-flex items-center gap-x-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                      style={{ background: `${tc.color}18`, color: tc.color }}>
                      <i className={`fa-solid ${tc.icon || 'fa-comment-dots'}`} style={{ fontSize: '8px' }} />
                      {tc.label}
                    </span>
                    <span className="text-[9px] font-bold uppercase" style={{ color: '#A78BFA' }}>CSO</span>
                  </div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--off-white)' }}>{n.title || 'Untitled'}</div>
                </div>
                <div className="flex items-start gap-x-2 shrink-0">
                  <div className="text-[9px] text-right" style={{ color: 'rgba(143,163,192,.35)' }}>
                    <div>{n.submittedDate || ''}</div>
                    <div className="mt-0.5 italic">{!n.siteId || n.siteId === '' ? 'Enterprise-Wide' : n.siteName || ''}</div>
                  </div>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[9px] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: tc.color }} />
                </div>
              </div>
              {n.body && (
                <div className="text-xs leading-relaxed line-clamp-3" style={{ color: 'rgba(143,163,192,.55)' }}>{n.body}</div>
              )}
              {actionItems.length > 0 && (
                <div className="text-[9px]" style={{ color: 'rgba(201,168,76,.45)' }}>
                  <i className="fa-solid fa-list-check mr-1.5" />{actionItems.length} action item{actionItems.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}

      {selectedNote && <NoteDetailModal note={selectedNote} isCso={true} onClose={() => setSelectedNote(null)} />}
    </div>
  );
}

// ── Main SiteDetailPage ───────────────────────────────────────────────────────

export default function SiteDetailPage({ siteId, data, currentUser, onBack, onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview');
  const site   = (data.sites || []).find(s => s.id === siteId);
  const status = site ? getStatus(site) : 'current';
  const canEdit = currentUser?.role !== 'readonly_leadership';

  if (!site) return (
    <div className="section">
      <button onClick={onBack} className="flex items-center gap-x-2 mb-6 text-xs font-semibold uppercase tracking-wider transition-colors"
        style={{ color: 'rgba(143,163,192,.5)' }}>
        <i className="fa-solid fa-arrow-left text-[9px]" /> Back to Sites
      </button>
      <div className="text-center py-20" style={{ color: 'rgba(143,163,192,.3)' }}>Site not found</div>
    </div>
  );

  const scfg = STATUS_CFG[status];

  const TABS = [
    { id: 'overview',   label: 'Overview',          icon: 'fa-building'    },
    { id: 'networks',   label: 'Assets',            icon: 'fa-cubes'       },
    { id: 'reports',    label: 'Inspection Reports',icon: 'fa-file-shield' },
    { id: 'documents',  label: 'Documents',         icon: 'fa-folder-open' },
  ];

  return (
    <div className="section">
      {/* Back button */}
      <button onClick={onBack}
        className="flex items-center gap-x-2 mb-6 text-xs font-semibold uppercase tracking-wider transition-colors hover:opacity-80"
        style={{ color: 'rgba(143,163,192,.5)' }}>
        <i className="fa-solid fa-arrow-left text-[9px]" /> Back to Sites
      </button>

      {/* Site header */}
      <div className="card rounded-2xl p-6 mb-6" style={{ borderLeft: `4px solid ${scfg.color}` }}>
        <div className="flex items-start justify-between flex-wrap gap-y-3">
          <div>
            <div className="font-head font-bold uppercase tracking-wide" style={{ fontSize: '1.6rem', color: 'var(--off-white)', letterSpacing: '.05em' }}>{site.name}</div>
            <div className="flex items-center gap-x-3 mt-2 flex-wrap gap-y-1">
              <span className="text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{site.location}</span>
              <span style={{ color: 'rgba(201,168,76,.2)' }}>·</span>
              <span className="font-mono text-xs" style={{ color: 'rgba(201,168,76,.55)' }}>{site.cageCode}</span>
              <span style={{ color: 'rgba(201,168,76,.2)' }}>·</span>
              <span className="text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{site.type}</span>
            </div>
            <div className="flex items-center gap-x-2 mt-3 flex-wrap gap-y-1">
              <span className="text-xs font-semibold" style={{ color: 'rgba(143,163,192,.6)' }}>FSO: {site.fsoName || '—'}</span>
              {site.backupFso && <><span style={{ color: 'rgba(201,168,76,.2)' }}>·</span><span className="text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>Backup: {site.backupFso}</span></>}
              {site.clearance && <><span style={{ color: 'rgba(201,168,76,.2)' }}>·</span><span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.15)', color: 'rgba(201,168,76,.6)' }}>{site.clearance}</span></>}
            </div>
          </div>
          <span className="inline-flex items-center gap-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{ background: scfg.bg, border: `1px solid ${scfg.border}`, color: scfg.color }}>
            <i className={`fa-solid ${scfg.icon}`} style={{ fontSize: '10px' }} />{scfg.label}
          </span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="mb-6">
        <TabNav tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content */}
      {activeTab === 'overview'   && <OverviewTab   site={site} status={status} canEdit={canEdit} onRefresh={onRefresh} />}
      {activeTab === 'networks'   && <SiteAssetsTab site={site} assets={data.assets} canEdit={canEdit} />}
      {activeTab === 'reports'    && <ReportsTab    site={site} selfInspections={data.selfInspections} dcsaInspections={data.dcsaInspections} lessons={data.lessons} canEdit={canEdit} currentUser={currentUser} onRefresh={onRefresh} />}
      {activeTab === 'documents'  && <DocumentsTab  site={site} documents={data.documents} canEdit={canEdit} onRefresh={onRefresh} />}
    </div>
  );
}
