import { useState } from 'react';
import { API, MASH, uid } from '../app.js';

// ── Preset color palette ──────────────────────────────────────────────────────

const COLORS = [
  { label: 'Green',  value: '#10B981' },
  { label: 'Amber',  value: '#F59E0B' },
  { label: 'Red',    value: '#EF4444' },
  { label: 'Blue',   value: '#60A5FA' },
  { label: 'Purple', value: '#A78BFA' },
  { label: 'Gold',   value: '#c9a84c' },
  { label: 'Teal',   value: '#14B8A6' },
  { label: 'Pink',   value: '#F472B6' },
];

const TEMPLATES = {
  progress: { label: 'Progress Tracker', icon: 'fa-bars-progress',   desc: 'Track completion % for each item with color-coded progress bars' },
  status:   { label: 'Status Tracker',   icon: 'fa-circle-dot',      desc: 'Assign custom color-coded statuses to each item'                },
  checklist:{ label: 'Checklist',        icon: 'fa-list-check',      desc: 'Simple done/not-done checklist with completion counter'          },
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgBar({ value }) {
  const color = value >= 75 ? '#10B981' : value >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-x-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(143,163,192,.1)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-bold shrink-0" style={{ color, minWidth: '32px', textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

// ── Tracker wizard ────────────────────────────────────────────────────────────

function TrackerWizard({ onSave, onCancel }) {
  const [step,       setStep]       = useState(1);
  const [name,       setName]       = useState('');
  const [template,   setTemplate]   = useState('');
  const [desc,       setDesc]       = useState('');
  const [statusOpts, setStatusOpts] = useState([
    { label: 'Active',   color: '#10B981' },
    { label: 'Pending',  color: '#F59E0B' },
    { label: 'Complete', color: '#60A5FA' },
  ]);
  const [saving, setSaving] = useState(false);

  function addStatusOpt() {
    if (statusOpts.length >= 6) return;
    setStatusOpts(o => [...o, { label: 'New Status', color: '#A78BFA' }]);
  }
  function updateOpt(i, key, val) {
    setStatusOpts(o => o.map((x, idx) => idx === i ? { ...x, [key]: val } : x));
  }
  function removeOpt(i) {
    setStatusOpts(o => o.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!name.trim()) { MASH.toast('Tracker name is required', 'error'); return; }
    setSaving(true);
    const tracker = {
      id: uid(), name: name.trim(), description: desc.trim(), template,
      statusOptions: template === 'status' ? statusOpts : [],
      items: [], createdAt: new Date().toISOString().slice(0, 10),
    };
    const r = await API.post('trackers', tracker);
    setSaving(false);
    if (r?.ok || r?.data) { onSave(); MASH.toast('Tracker created!', 'success'); }
    else                   { MASH.toast('Save failed', 'error'); }
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" style={{ background: 'rgba(6,18,31,.88)' }}>
      <div className="w-full max-w-lg card rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,.2)' }}>
        {/* Wizard header */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(201,168,76,.1)' }}>
          <div className="flex items-center gap-x-3 mb-1">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-x-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={step === s
                    ? { background: 'var(--gold)', color: '#06121f' }
                    : step > s
                    ? { background: '#10B981', color: 'white' }
                    : { background: 'rgba(201,168,76,.12)', color: 'rgba(143,163,192,.4)' }}>
                  {step > s ? <i className="fa-solid fa-check" /> : s}
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: step === s ? 'var(--gold)' : 'rgba(143,163,192,.35)' }}>
                  {s === 1 ? 'Name & Template' : 'Configure'}
                </span>
                {s < 2 && <i className="fa-solid fa-chevron-right text-[8px]" style={{ color: 'rgba(201,168,76,.2)' }} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Name + template */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="inp-lbl">Tracker Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="inp w-full" placeholder="e.g. Clearance Renewal Tracker" />
              </div>
              <div>
                <label className="inp-lbl">Description (optional)</label>
                <input value={desc} onChange={e => setDesc(e.target.value)} className="inp w-full" placeholder="What is this tracker for?" />
              </div>
              <div>
                <label className="inp-lbl mb-3">Choose Template</label>
                <div className="grid grid-cols-1 gap-3 mt-2">
                  {Object.entries(TEMPLATES).map(([k, t]) => (
                    <button key={k} onClick={() => setTemplate(k)}
                      className="flex items-center gap-x-4 p-4 rounded-xl text-left transition-all"
                      style={{
                        background: template === k ? 'rgba(201,168,76,.1)'  : 'rgba(201,168,76,.03)',
                        border:     template === k ? '1px solid rgba(201,168,76,.35)' : '1px solid rgba(201,168,76,.08)',
                      }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: template === k ? 'rgba(201,168,76,.15)' : 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)' }}>
                        <i className={`fa-solid ${t.icon} text-sm`} style={{ color: template === k ? 'var(--gold)' : 'rgba(143,163,192,.4)' }} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: template === k ? 'var(--gold)' : 'var(--off-white)' }}>{t.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(143,163,192,.4)' }}>{t.desc}</div>
                      </div>
                      {template === k && <i className="fa-solid fa-circle-check ml-auto" style={{ color: 'var(--gold)' }} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && template === 'status' && (
            <div className="space-y-4">
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--off-white)' }}>Define Status Options</div>
              <p className="text-xs mb-4" style={{ color: 'rgba(143,163,192,.4)' }}>Each item in your tracker can be assigned one of these statuses.</p>
              <div className="space-y-2">
                {statusOpts.map((opt, i) => (
                  <div key={i} className="flex items-center gap-x-3">
                    <input value={opt.label} onChange={e => updateOpt(i, 'label', e.target.value)}
                      className="inp flex-1 text-xs py-1.5" placeholder="Status name" />
                    <div className="flex items-center gap-x-1 flex-wrap gap-y-1">
                      {COLORS.map(c => (
                        <button key={c.value} onClick={() => updateOpt(i, 'color', c.value)}
                          className="w-5 h-5 rounded-full transition-all"
                          style={{ background: c.value, outline: opt.color === c.value ? `2px solid ${c.value}` : 'none', outlineOffset: '2px' }} />
                      ))}
                    </div>
                    {statusOpts.length > 1 && (
                      <button onClick={() => removeOpt(i)} style={{ color: '#FCA5A5' }}>
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {statusOpts.length < 6 && (
                <button onClick={addStatusOpt} className="text-xs font-semibold flex items-center gap-x-1.5"
                  style={{ color: 'rgba(201,168,76,.6)' }}>
                  <i className="fa-solid fa-plus text-[9px]" /> Add Status Option
                </button>
              )}
            </div>
          )}

          {step === 2 && template !== 'status' && (
            <div className="text-center py-8">
              <i className={`fa-solid ${TEMPLATES[template]?.icon} text-3xl mb-3`} style={{ color: 'var(--gold)' }} />
              <div className="font-semibold mb-2" style={{ color: 'var(--off-white)' }}>{TEMPLATES[template]?.label}</div>
              <div className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>
                {template === 'progress' ? 'Each item will have a 0–100% progress value with a color-coded progress bar.' : 'Items will have a simple done / not done checkbox.'}
              </div>
              <div className="mt-4 text-xs" style={{ color: 'rgba(201,168,76,.5)' }}>Ready to create — click Save Tracker!</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid rgba(201,168,76,.08)' }}>
          <button onClick={onCancel} className="text-xs font-semibold" style={{ color: 'rgba(143,163,192,.4)' }}>Cancel</button>
          <div className="flex items-center gap-x-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.15)', color: 'rgba(143,163,192,.6)' }}>
                ← Back
              </button>
            )}
            {step === 1
              ? <button onClick={() => { if (!name.trim() || !template) { MASH.toast('Name and template required', 'error'); return; } setStep(2); }} className="btn-gold">
                  Next →
                </button>
              : <button onClick={handleSave} disabled={saving} className="btn-gold">
                  {saving ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />Saving…</> : 'Save Tracker'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tracker board ─────────────────────────────────────────────────────────────

function TrackerBoard({ tracker, canEdit, onSave, onDelete }) {
  const [showAdd,    setShowAdd]    = useState(false);
  const [newItem,    setNewItem]    = useState({ name: '', progress: 50, status: '', done: false, notes: '' });
  const [editItemId, setEditItemId] = useState(null);
  const items = tracker.items || [];

  const totalDone     = items.filter(i => i.done).length;
  const avgProgress   = items.length ? Math.round(items.reduce((s, i) => s + (i.progress || 0), 0) / items.length) : 0;

  async function saveItem() {
    if (!newItem.name?.trim()) { MASH.toast('Item name required', 'error'); return; }
    let updated;
    if (editItemId) {
      updated = { ...tracker, items: items.map(i => i.id === editItemId ? { ...i, ...newItem } : i) };
    } else {
      updated = { ...tracker, items: [...items, { id: uid(), ...newItem, status: newItem.status || tracker.statusOptions?.[0]?.label || '' }] };
    }
    const r = await API.patch('trackers', tracker.id, updated);
    if (r?.ok) { onSave(); setShowAdd(false); setEditItemId(null); setNewItem({ name: '', progress: 50, status: '', done: false, notes: '' }); }
    else        { MASH.toast('Save failed', 'error'); }
  }

  async function toggleDone(item) {
    const updated = { ...tracker, items: items.map(i => i.id === item.id ? { ...i, done: !i.done } : i) };
    await API.patch('trackers', tracker.id, updated);
    onSave();
  }

  async function deleteItem(id) {
    const updated = { ...tracker, items: items.filter(i => i.id !== id) };
    await API.patch('trackers', tracker.id, updated);
    onSave();
  }

  function startEdit(item) {
    setNewItem({ name: item.name, progress: item.progress || 50, status: item.status || '', done: item.done || false, notes: item.notes || '' });
    setEditItemId(item.id);
    setShowAdd(true);
  }

  const tmpl = tracker.template;

  return (
    <div className="card rounded-2xl overflow-hidden">
      {/* Board header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(201,168,76,.08)' }}>
        <div>
          <div className="font-head font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--off-white)', letterSpacing: '.06em' }}>{tracker.name}</div>
          {tracker.description && <div className="text-[10px] mt-0.5" style={{ color: 'rgba(143,163,192,.35)' }}>{tracker.description}</div>}
        </div>
        <div className="flex items-center gap-x-3">
          {tmpl === 'checklist' && items.length > 0 && (
            <div className="text-xs font-semibold" style={{ color: totalDone === items.length ? '#10B981' : 'rgba(143,163,192,.5)' }}>
              {totalDone}/{items.length} done
            </div>
          )}
          {tmpl === 'progress' && items.length > 0 && (
            <div className="text-xs font-semibold" style={{ color: '#60A5FA' }}>{avgProgress}% avg</div>
          )}
          <div className="flex items-center gap-x-1">
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
              style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.12)', color: 'rgba(201,168,76,.55)' }}>
              {TEMPLATES[tmpl]?.label}
            </span>
          </div>
          {canEdit && (
            <>
              <button onClick={() => { setEditItemId(null); setNewItem({ name: '', progress: 50, status: tracker.statusOptions?.[0]?.label || '', done: false, notes: '' }); setShowAdd(true); }}
                className="inline-flex items-center gap-x-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold"
                style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.18)', color: 'var(--gold)' }}>
                <i className="fa-solid fa-plus" /> Add
              </button>
              <button onClick={() => onDelete(tracker.id)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', color: '#FCA5A5' }}>
                <i className="fa-solid fa-trash text-[9px]" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="p-4 space-y-3" style={{ background: 'rgba(201,168,76,.03)', borderBottom: '1px solid rgba(201,168,76,.08)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="inp-lbl">Item Name *</label>
              <input value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
                className="inp w-full text-xs py-1.5" placeholder="Item name…" />
            </div>
            {tmpl === 'progress' && (
              <div>
                <label className="inp-lbl">Progress ({newItem.progress}%)</label>
                <input type="range" min="0" max="100" value={newItem.progress}
                  onChange={e => setNewItem(n => ({ ...n, progress: +e.target.value }))}
                  className="w-full mt-1" />
              </div>
            )}
            {tmpl === 'status' && (
              <div>
                <label className="inp-lbl">Status</label>
                <select value={newItem.status} onChange={e => setNewItem(n => ({ ...n, status: e.target.value }))} className="inp w-full text-xs py-1.5">
                  {(tracker.statusOptions || []).map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="inp-lbl">Notes (optional)</label>
              <input value={newItem.notes} onChange={e => setNewItem(n => ({ ...n, notes: e.target.value }))}
                className="inp w-full text-xs py-1.5" placeholder="Optional notes…" />
            </div>
          </div>
          <div className="flex items-center gap-x-2">
            <button onClick={saveItem} className="btn-gold text-xs py-1.5 px-4">
              {editItemId ? 'Update' : 'Add Item'}
            </button>
            <button onClick={() => { setShowAdd(false); setEditItemId(null); }} className="text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Items */}
      {items.length === 0
        ? (
          <div className="py-10 text-center">
            <i className={`fa-solid ${TEMPLATES[tmpl]?.icon} text-2xl mb-2`} style={{ color: 'rgba(143,163,192,.15)' }} />
            <div className="text-xs" style={{ color: 'rgba(143,163,192,.25)' }}>No items yet — click Add above</div>
          </div>
        )
        : (
          <div className="divide-y" style={{ borderColor: 'rgba(201,168,76,.05)' }}>
            {items.map(item => {
              const statusOpt = tmpl === 'status'
                ? (tracker.statusOptions || []).find(o => o.label === item.status)
                : null;
              return (
                <div key={item.id} className="flex items-center gap-x-3 px-5 py-3 hover:bg-[rgba(201,168,76,.02)] transition-colors group">
                  {/* Checklist checkbox */}
                  {tmpl === 'checklist' && (
                    <button onClick={() => toggleDone(item)} className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all"
                      style={{ border: `2px solid ${item.done ? '#10B981' : 'rgba(143,163,192,.25)'}`, background: item.done ? 'rgba(16,185,129,.15)' : 'transparent' }}>
                      {item.done && <i className="fa-solid fa-check text-[9px]" style={{ color: '#10B981' }} />}
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: item.done ? 'rgba(143,163,192,.35)' : 'var(--off-white)', textDecoration: item.done ? 'line-through' : 'none' }}>
                      {item.name}
                    </div>
                    {item.notes && <div className="text-[9px] mt-0.5" style={{ color: 'rgba(143,163,192,.3)' }}>{item.notes}</div>}
                  </div>

                  {/* Progress bar */}
                  {tmpl === 'progress' && (
                    <div className="w-40 shrink-0"><ProgBar value={item.progress || 0} /></div>
                  )}

                  {/* Status badge */}
                  {tmpl === 'status' && statusOpt && (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0"
                      style={{ background: `${statusOpt.color}18`, border: `1px solid ${statusOpt.color}35`, color: statusOpt.color }}>
                      {item.status}
                    </span>
                  )}

                  {canEdit && (
                    <div className="flex items-center gap-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => startEdit(item)} className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ color: 'rgba(201,168,76,.5)' }}>
                        <i className="fa-solid fa-pen text-[8px]" />
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ color: 'rgba(239,68,68,.5)' }}>
                        <i className="fa-solid fa-xmark text-[9px]" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

// ── Asset sub-tab (inline — reuses AssetsSection patterns) ───────────────────

const ASSET_STATUS = {
  'active':         { label: 'Active',           color: '#10B981' },
  'pending':        { label: 'Pending Approval', color: '#F59E0B' },
  'inactive':       { label: 'Inactive',         color: '#6B7280' },
  'decommissioned': { label: 'Decommissioned',   color: '#EF4444' },
};
const ASSET_APPROVAL = {
  'approved': { label: 'Approved', color: '#10B981' },
  'denied':   { label: 'Denied',   color: '#EF4444' },
  'pending':  { label: 'Pending',  color: '#F59E0B' },
};
const PED_TYPES       = ['Phone', 'Tablet', 'Laptop', 'Smartwatch', 'USB Device', 'Other'];
const EQUIP_TYPES     = ['Fax Machine', 'Desk Phone', 'Printer', 'Scanner', 'Server', 'Copier', 'Monitor', 'Other'];

function openAssetModal(category, sites, existing, onDone) {
  const types  = category === 'ped' ? PED_TYPES : EQUIP_TYPES;
  const isEdit = !!existing;
  const d      = existing || {};
  MASH.openModal(isEdit ? 'Edit Asset' : `Add ${category === 'ped' ? 'PED' : 'Equipment'}`, `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="inp-lbl">Serial Number *</label><input name="serialNumber" class="inp" value="${d.serialNumber||''}" placeholder="e.g. SN12345"/></div>
        <div><label class="inp-lbl">Type</label><select name="type" class="inp">${types.map(t=>`<option value="${t}" ${d.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Make</label><input name="make" class="inp" value="${d.make||''}" placeholder="e.g. Apple"/></div>
        <div><label class="inp-lbl">Model</label><input name="model" class="inp" value="${d.model||''}" placeholder="e.g. iPhone 14"/></div>
        <div><label class="inp-lbl">Site</label><select name="siteId" class="inp"><option value="">-- Select --</option>${sites.map(s=>`<option value="${s.id}" data-name="${s.name}" ${d.siteId===s.id?'selected':''}>${s.name}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Location</label><input name="location" class="inp" value="${d.location||''}" placeholder="Room / area"/></div>
        <div><label class="inp-lbl">Assigned To</label><input name="assignedTo" class="inp" value="${d.assignedTo||''}"/></div>
        <div><label class="inp-lbl">Status</label><select name="status" class="inp">${Object.entries(ASSET_STATUS).map(([k,v])=>`<option value="${k}" ${d.status===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Approval</label><select name="approvalStatus" class="inp">${Object.entries(ASSET_APPROVAL).map(([k,v])=>`<option value="${k}" ${d.approvalStatus===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Date Added</label><input name="dateAdded" type="date" class="inp" value="${d.dateAdded||new Date().toISOString().slice(0,10)}"/></div>
      </div>
      <div><label class="inp-lbl">Notes</label><textarea name="notes" rows="2" class="inp">${d.notes||''}</textarea></div>
    </div>`,
    `<button onclick="MASH._saveAsset()" class="btn-gold">${isEdit?'Save Changes':'Add Asset'}</button>
     <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.5)">Cancel</button>`
  );
  MASH._saveAsset = async () => {
    const inputs = document.querySelectorAll('#modal-body input, #modal-body select, #modal-body textarea');
    const asset  = { category, ...(existing || { id: uid() }) };
    inputs.forEach(i => { if (i.name) asset[i.name] = i.value; });
    const sel = document.querySelector('#modal-body select[name="siteId"] option:checked');
    asset.siteName = sel?.getAttribute('data-name') || '';
    if (!asset.serialNumber?.trim()) { MASH.toast('Serial number required', 'error'); return; }
    const r = isEdit ? await API.patch('assets', existing.id, asset) : await API.post('assets', asset);
    if (r?.ok || r?.data) { MASH.closeModal(); onDone(); MASH.toast(isEdit ? 'Updated' : 'Added', 'success'); }
    else                   { MASH.toast('Save failed', 'error'); }
  };
}

function AssetSubTab({ category, assets, sites, canEdit, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const items = assets
    .filter(a => a.category === category)
    .filter(a => !filterSite || a.siteId === filterSite)
    .filter(a => !search || [a.serialNumber, a.make, a.model, a.assignedTo].some(v => v?.toLowerCase().includes(search.toLowerCase())));

  async function del(id) {
    if (!confirm('Delete this asset?')) return;
    await API.del('assets', id);
    onRefresh();
    MASH.toast('Removed', 'success');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-x-3 flex-wrap gap-y-2">
        <div className="relative flex-1 min-w-[180px]">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[9px]" style={{ color: 'rgba(201,168,76,.4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search serial, make, model, assigned to…" className="inp w-full pl-8 text-xs py-2" />
        </div>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="inp w-auto text-xs py-2">
          <option value="">All Sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {items.length === 0
        ? (
          <div className="card rounded-2xl p-12 text-center">
            <i className={`fa-solid ${category === 'ped' ? 'fa-mobile-screen-button' : 'fa-fax'} text-3xl mb-3`} style={{ color: 'rgba(143,163,192,.12)' }} />
            <div className="text-sm" style={{ color: 'rgba(143,163,192,.3)' }}>No {category === 'ped' ? 'PEDs' : 'equipment'} on record</div>
          </div>
        )
        : (
          <div className="card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'rgba(201,168,76,.04)', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
                  <tr>{['Serial #', 'Type', 'Make / Model', 'Site', 'Assigned To', 'Status', 'Approval', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: 'rgba(143,163,192,.5)' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {items.map((a, i) => {
                    const sc = ASSET_STATUS[a.status] || ASSET_STATUS['active'];
                    const ac = ASSET_APPROVAL[a.approvalStatus];
                    return (
                      <tr key={a.id} className="border-t hover:bg-[rgba(201,168,76,.02)] transition-colors"
                        style={{ borderColor: 'rgba(201,168,76,.05)', background: i%2===0 ? 'transparent' : 'rgba(6,18,31,.2)' }}>
                        <td className="px-4 py-3"><span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>{a.serialNumber||'—'}</span></td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgba(143,163,192,.5)' }}>{a.type||'—'}</td>
                        <td className="px-4 py-3"><div className="text-xs font-semibold" style={{ color: 'var(--off-white)' }}>{a.make||'—'}</div><div className="text-[9px]" style={{ color: 'rgba(143,163,192,.35)' }}>{a.model||''}</div></td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(143,163,192,.5)' }}>{a.siteName||'—'}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(143,163,192,.5)' }}>{a.assignedTo||'—'}</td>
                        <td className="px-4 py-3"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background:`${sc.color}15`, border:`1px solid ${sc.color}30`, color:sc.color }}>{sc.label}</span></td>
                        <td className="px-4 py-3">{ac && <span className="text-[9px] font-semibold px-2 py-0.5 rounded" style={{ background:`${ac.color}12`, color:ac.color }}>{ac.label}</span>}</td>
                        <td className="px-4 py-3">{canEdit && <div className="flex gap-x-2"><button onClick={() => openAssetModal(category, [], a, onRefresh)} className="text-[10px] font-bold" style={{ color:'var(--gold)' }}>Edit</button><button onClick={() => del(a.id)} className="text-[10px] font-bold" style={{ color:'#FCA5A5' }}>Del</button></div>}</td>
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

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ icon, label, count, color = 'var(--gold)', action }) {
  return (
    <div className="flex items-center justify-between py-4 mb-4" style={{ borderBottom: '1px solid rgba(201,168,76,.1)' }}>
      <div className="flex items-center gap-x-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <i className={`fa-solid ${icon} text-sm`} style={{ color }} />
        </div>
        <div>
          <div className="font-head font-bold uppercase tracking-wide text-sm" style={{ color: 'var(--off-white)', letterSpacing: '.06em' }}>{label}</div>
        </div>
        {count !== undefined && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CustomTrackersSection({ data, currentUser, onRefresh }) {
  const [showWizard,        setShowWizard]        = useState(false);
  const [selectedTrackerId, setSelectedTrackerId] = useState('');

  const trackers = data.trackers || [];
  const assets   = data.assets   || [];
  const sites    = data.sites    || [];
  const canEdit  = currentUser?.role !== 'readonly_leadership';

  // Auto-select first tracker when list loads or changes
  const activeId = selectedTrackerId && trackers.find(t => t.id === selectedTrackerId)
    ? selectedTrackerId
    : (trackers[0]?.id || '');

  const selectedTracker = trackers.find(t => t.id === activeId) || null;

  async function deleteTracker(id) {
    if (!confirm('Delete this tracker?')) return;
    await API.del('trackers', id);
    if (selectedTrackerId === id) setSelectedTrackerId('');
    onRefresh();
    MASH.toast('Tracker deleted', 'success');
  }

  return (
    <div className="section">
      {/* Page heading */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-y-3">
        <div>
          <div className="sec-heading mb-1">Trackers &amp; Assets</div>
          <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>Custom Trackers</h2>
          <p className="text-xs mt-1" style={{ color: 'rgba(143,163,192,.35)' }}>
            Select a tracker to view, or create a new one. PEDs and equipment are always shown below.
          </p>
        </div>
      </div>

      {/* ── Tracker dropdown selector ── */}
      <div className="card rounded-2xl p-4 mb-6" style={{ border: '1px solid rgba(201,168,76,.15)' }}>
        <div className="flex items-center gap-x-3 flex-wrap gap-y-3">
          <div className="flex-1 min-w-[240px]">
            <label className="inp-lbl mb-1.5">Select Tracker</label>
            <select
              value={activeId}
              onChange={e => setSelectedTrackerId(e.target.value)}
              className="inp w-full"
              style={{ fontSize: '.75rem' }}>
              {trackers.length === 0
                ? <option value="">No trackers yet — create one</option>
                : trackers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.description ? ` — ${t.description}` : ''}
                    </option>
                  ))}
            </select>
          </div>
          {canEdit && (
            <button onClick={() => setShowWizard(true)} className="btn-gold self-end">
              <i className="fa-solid fa-plus text-[9px]" /> New Tracker
            </button>
          )}
        </div>
      </div>

      {/* ── Selected tracker board ── */}
      {selectedTracker
        ? (
          <div className="mb-8">
            <TrackerBoard tracker={selectedTracker} canEdit={canEdit}
              onSave={onRefresh} onDelete={id => deleteTracker(id)} />
          </div>
        )
        : (
          <div className="card rounded-2xl p-12 text-center mb-8">
            <i className="fa-solid fa-table-list text-4xl mb-4" style={{ color: 'rgba(143,163,192,.1)' }} />
            <div className="text-sm font-semibold mb-2" style={{ color: 'rgba(143,163,192,.3)' }}>No trackers yet</div>
            <div className="text-xs mb-4" style={{ color: 'rgba(143,163,192,.2)' }}>Create a progress tracker, status board, or checklist</div>
            {canEdit && <button onClick={() => setShowWizard(true)} className="btn-gold"><i className="fa-solid fa-plus text-[9px]" /> Create First Tracker</button>}
          </div>
        )}

      {showWizard && (
        <TrackerWizard
          onSave={() => { setShowWizard(false); onRefresh(); }}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
