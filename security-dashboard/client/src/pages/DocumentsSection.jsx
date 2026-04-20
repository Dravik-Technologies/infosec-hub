import { useState } from 'react';
import { API, MASH, fmtDate, uid } from '../app.js';
import { Badge } from '../components/index.jsx';

const DOC_TYPE_LABEL = { csp: 'CSP', ffc: 'FFC', tempest: 'TEMPEST', sap: 'SAP', other: 'OTHER' };
const DOC_TYPE_CLS   = { csp: 'b-gold', ffc: 'b-b', tempest: 'b-v', sap: 'b-r', other: 'b-c' };

const STATUS_LABEL = {
  draft:       'Draft',
  pending_fso: 'Pending FSO',
  submitted:   'Submitted',
  accredited:  'Accredited',
};
const STATUS_CLS = {
  draft:       'b-b',
  pending_fso: 'b-a',
  submitted:   'b-c',
  accredited:  'b-g',
};

const STATUS_ORDER = ['draft', 'pending_fso', 'submitted', 'accredited'];

export default function DocumentsSection({ data, onRefresh }) {
  const documents = data.documents || [];
  const sites     = data.sites     || [];
  const [filterSite,   setFilterSite]   = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sort,         setSort]         = useState('updated-desc');

  let list = [...documents];
  if (filterSite)   list = list.filter(d => d.siteId === filterSite);
  if (filterType)   list = list.filter(d => d.type   === filterType);
  if (filterStatus) list = list.filter(d => d.status === filterStatus);
  if (sort === 'updated-desc') list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  else if (sort === 'title-asc') list.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'status')  list.sort((a, b) => STATUS_ORDER.indexOf(b.status) - STATUS_ORDER.indexOf(a.status));

  const byStatus = STATUS_ORDER.map(s => ({ status: s, count: documents.filter(d => d.status === s).length }));

  function openAddDocument() {
    const sOpts = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    MASH.openModal('Add Document', `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="inp-lbl">Document Title</label><input id="doc-t" class="inp" placeholder="e.g. SCIF CSP — Lincolnia HQ v2.1"></div>
        <div><label class="inp-lbl">Document Type</label><select id="doc-ty" class="inp">
          <option value="csp">CSP — Construction Security Plan</option>
          <option value="ffc">FFC — Fixed Facility Checklist</option>
          <option value="tempest">TEMPEST Evaluation</option>
          <option value="sap">SAP Addendum</option>
          <option value="other">Other</option></select></div>
        <div><label class="inp-lbl">Facility</label><select id="doc-si" class="inp">${sOpts}</select></div>
        <div><label class="inp-lbl">Status</label><select id="doc-st" class="inp">
          <option value="draft">Draft</option>
          <option value="pending_fso">Pending FSO Review</option>
          <option value="submitted">Submitted</option>
          <option value="accredited">Accredited</option></select></div>
        <div><label class="inp-lbl">Version</label><input id="doc-v" class="inp" value="v1.0"></div>
        <div class="col-span-2"><label class="inp-lbl">File Reference (path or S3 key)</label><input id="doc-f" class="inp" placeholder="e.g. /docs/csp/lincolnia-hq-v1.pdf"></div>
        <div><label class="inp-lbl">Submitted By</label><input id="doc-sb" class="inp"></div>
        <div><label class="inp-lbl">Reviewed By</label><input id="doc-rb" class="inp"></div>
        <div class="col-span-2"><label class="inp-lbl">Notes</label><textarea id="doc-no" rows="2" class="inp"></textarea></div>
      </div>`,
      `<button onclick="MASH._saveDocument('')" class="btn-gold">Add Document</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase tracking-wider" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.6)">Cancel</button>`);
    MASH._saveDocument = async () => {
      const site = sites.find(s => s.id === document.getElementById('doc-si').value);
      const now  = new Date().toISOString().slice(0, 10);
      const item = {
        id: uid(),
        title:       document.getElementById('doc-t').value,
        type:        document.getElementById('doc-ty').value,
        siteId:      site?.id,
        status:      document.getElementById('doc-st').value,
        version:     document.getElementById('doc-v').value || 'v1.0',
        fileRef:     document.getElementById('doc-f').value || null,
        submittedBy: document.getElementById('doc-sb').value,
        reviewedBy:  document.getElementById('doc-rb').value,
        notes:       document.getElementById('doc-no').value,
        createdAt: now, updatedAt: now,
      };
      if (!item.title) { MASH.toast('Title required', 'warning'); return; }
      await API.post('documents', item);
      MASH.closeModal(); onRefresh(); MASH.toast('Document added', 'success');
    };
  }

  function openEditDocument(doc) {
    const sOpts = sites.map(s => `<option value="${s.id}" ${s.id === doc.siteId ? 'selected' : ''}>${s.name}</option>`).join('');
    MASH.openModal(`Edit — ${doc.title}`, `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="inp-lbl">Document Title</label><input id="doc-t" class="inp" value="${doc.title || ''}"></div>
        <div><label class="inp-lbl">Document Type</label><select id="doc-ty" class="inp">
          ${['csp', 'ffc', 'tempest', 'sap', 'other'].map(t => `<option value="${t}" ${doc.type === t ? 'selected' : ''}>${DOC_TYPE_LABEL[t]}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Facility</label><select id="doc-si" class="inp">${sOpts}</select></div>
        <div><label class="inp-lbl">Status</label><select id="doc-st" class="inp">
          ${STATUS_ORDER.map(s => `<option value="${s}" ${doc.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></div>
        <div><label class="inp-lbl">Version</label><input id="doc-v" class="inp" value="${doc.version || 'v1.0'}"></div>
        <div class="col-span-2"><label class="inp-lbl">File Reference</label><input id="doc-f" class="inp" value="${doc.fileRef || ''}"></div>
        <div><label class="inp-lbl">Submitted By</label><input id="doc-sb" class="inp" value="${doc.submittedBy || ''}"></div>
        <div><label class="inp-lbl">Reviewed By</label><input id="doc-rb" class="inp" value="${doc.reviewedBy || ''}"></div>
        <div class="col-span-2"><label class="inp-lbl">Notes</label><textarea id="doc-no" rows="2" class="inp">${doc.notes || ''}</textarea></div>
      </div>`,
      `<button onclick="MASH._saveDocument('${doc.id}')" class="btn-gold">Save Changes</button>
       <button onclick="MASH.closeModal()" class="px-5 h-9 rounded text-xs font-semibold uppercase tracking-wider" style="border:1px solid rgba(201,168,76,.2);color:rgba(143,163,192,.6)">Cancel</button>`);
    MASH._saveDocument = async (id) => {
      const site = sites.find(s => s.id === document.getElementById('doc-si').value);
      const d = {
        title:       document.getElementById('doc-t').value,
        type:        document.getElementById('doc-ty').value,
        siteId:      site?.id,
        status:      document.getElementById('doc-st').value,
        version:     document.getElementById('doc-v').value,
        fileRef:     document.getElementById('doc-f').value || null,
        submittedBy: document.getElementById('doc-sb').value,
        reviewedBy:  document.getElementById('doc-rb').value,
        notes:       document.getElementById('doc-no').value,
        updatedAt:   new Date().toISOString().slice(0, 10),
      };
      if (!d.title) { MASH.toast('Title required', 'warning'); return; }
      await API.patch('documents', id, d);
      MASH.closeModal(); onRefresh(); MASH.toast('Document updated', 'success');
    };
  }

  return (
    <div className="section">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="sec-heading mb-1">Document Registry</div>
          <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>SCIF Documents</h2>
        </div>
        <button onClick={openAddDocument} className="btn-gold">
          <i className="fa-solid fa-plus text-[10px]" /> Add Document
        </button>
      </div>

      {/* Workflow status summary */}
      <div className="card p-6 mb-7">
        <div className="sec-heading mb-4" style={{ fontSize: '.6rem' }}>Document Workflow</div>
        <div className="flex items-center gap-x-0">
          {byStatus.map((s, i) => (
            <div key={s.status} className="flex items-center flex-1">
              <div className="flex-1 text-center py-4 px-2 rounded-xl transition-all cursor-pointer"
                onClick={() => setFilterStatus(filterStatus === s.status ? '' : s.status)}
                style={{ background: filterStatus === s.status ? 'rgba(201,168,76,.1)' : 'rgba(201,168,76,.03)', border: filterStatus === s.status ? '1px solid rgba(201,168,76,.3)' : '1px solid rgba(201,168,76,.07)' }}>
                <div className="font-head font-bold text-2xl mb-1" style={{ color: filterStatus === s.status ? 'var(--gold)' : 'var(--off-white)' }}>{s.count}</div>
                <Badge cls={STATUS_CLS[s.status]}>{STATUS_LABEL[s.status]}</Badge>
              </div>
              {i < byStatus.length - 1 && (
                <div className="flex items-center px-1" style={{ color: 'rgba(201,168,76,.25)' }}>
                  <i className="fa-solid fa-chevron-right text-[10px]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="">All Facilities</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="">All Types</option>
          {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="">All Statuses</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="inp w-auto text-xs py-1.5">
          <option value="updated-desc">Sort: Recently Updated</option>
          <option value="title-asc">Sort: Title A–Z</option>
          <option value="status">Sort: Status (Advanced)</option>
        </select>
        <span className="ml-auto text-xs" style={{ color: 'rgba(143,163,192,.4)' }}>{list.length} record{list.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '900px' }}>
            <thead className="border-b" style={{ borderColor: 'rgba(201,168,76,.1)' }}>
              <tr>
                <th className="text-left px-6 py-4">Document</th>
                <th className="text-left px-4 py-4">Type</th>
                <th className="text-left px-4 py-4">Facility</th>
                <th className="text-left px-4 py-4">Status</th>
                <th className="text-left px-4 py-4">Version</th>
                <th className="text-left px-4 py-4">File Ref</th>
                <th className="text-left px-4 py-4">Updated</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(201,168,76,.05)' }}>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-xs" style={{ color: 'rgba(143,163,192,.35)' }}>
                    No documents match the current filters.
                  </td>
                </tr>
              ) : list.map(doc => {
                const site = sites.find(s => s.id === doc.siteId);
                return (
                  <tr key={doc.id}>
                    <td className="px-6 py-4">
                      <div className="font-head font-semibold text-sm" style={{ color: 'var(--off-white)' }}>{doc.title}</div>
                      {doc.notes && <div className="line-clamp-1 mt-0.5" style={{ fontSize: '9px', color: 'rgba(143,163,192,.3)' }}>{doc.notes}</div>}
                    </td>
                    <td className="px-4 py-4"><Badge cls={DOC_TYPE_CLS[doc.type] || 'b-b'}>{DOC_TYPE_LABEL[doc.type] || doc.type}</Badge></td>
                    <td className="px-4 py-4 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{site?.name || doc.siteId}</td>
                    <td className="px-4 py-4"><Badge cls={STATUS_CLS[doc.status] || 'b-b'}>{STATUS_LABEL[doc.status] || doc.status}</Badge></td>
                    <td className="px-4 py-4 text-xs font-mono" style={{ color: 'rgba(143,163,192,.45)' }}>{doc.version || '—'}</td>
                    <td className="px-4 py-4">
                      {doc.fileRef
                        ? <span className="font-mono text-[10px] line-clamp-1" style={{ color: 'var(--gold)', maxWidth: '160px', display: 'block' }}>{doc.fileRef}</span>
                        : <span style={{ fontSize: '10px', color: 'rgba(143,163,192,.3)' }}>—</span>}
                    </td>
                    <td className="px-4 py-4 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{fmtDate(doc.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <button onClick={() => openEditDocument(doc)} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold)', letterSpacing: '.07em' }}>Edit</button>
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
