import { useState } from 'react';
import { MASH, fmtDate, fmtShort } from '../app.js';
import { Badge, Prog } from '../components/index.jsx';

export default function SitesSection({ data }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [sort, setSort]                 = useState('compliance-desc');
  let sites = [...(data.sites || [])];
  if (filterStatus) sites = sites.filter(s => s.status === filterStatus);
  if (sort === 'compliance-asc')  sites.sort((a, b) => a.compliance - b.compliance);
  else if (sort === 'name-asc')   sites.sort((a, b) => a.name.localeCompare(b.name));
  else                            sites.sort((a, b) => b.compliance - a.compliance);

  const bar = v => (
    <div className="flex items-center gap-x-2">
      <span className="font-mono text-xs w-8 text-right" style={{ color: 'var(--gold)' }}>{v}%</span>
      <div className="w-14 prog prog-s"><div className="prog-fill p-gold" style={{ width: `${v}%` }} /></div>
    </div>
  );

  return (
    <div className="section">
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="sec-heading mb-1">All Facilities</div>
          <h2 className="font-head text-[1.8rem] font-bold" style={{ color: 'var(--off-white)' }}>Facility Overview</h2>
        </div>
        <div className="flex items-center gap-x-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="inp w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            <option value="green">Compliant</option>
            <option value="amber">Needs Attention</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="inp w-auto text-xs py-1.5">
            <option value="compliance-desc">Sort: Security Posture ↓</option>
            <option value="compliance-asc">Sort: Security Posture ↑</option>
            <option value="name-asc">Sort: Name A–Z</option>
          </select>
        </div>
      </div>
      <div className="sites-table-wrap card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="border-b" style={{ borderColor: 'rgba(201,168,76,.1)' }}>
            <tr>
              <th className="text-left px-6 py-4">Facility</th>
              <th className="text-left px-4 py-4">Location</th>
              <th className="text-left px-4 py-4">Security Posture</th>
              <th className="text-left px-4 py-4">Personnel Security</th>
              <th className="text-left px-4 py-4">Audit Readiness</th>
              <th className="text-left px-4 py-4">SCIF Controls</th>
              <th className="text-left px-4 py-4">Emanations Sec.</th>
              <th className="text-left px-4 py-4">SSM</th>
              <th className="text-left px-4 py-4">Next Inspection</th>
              <th className="text-left px-4 py-4">Status</th>
              <th className="px-4 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'rgba(201,168,76,.05)' }}>
            {sites.map(s => (
              <tr key={s.id}>
                <td className="px-6 py-4">
                  <div className="font-head font-bold uppercase tracking-wide text-sm" style={{ color: 'var(--off-white)', letterSpacing: '.06em' }}>{s.name}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.35)' }} className="mt-0.5 uppercase tracking-wider">{s.type}</div>
                </td>
                <td className="px-4 py-4 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{s.location}</td>
                <td className="px-4 py-4">
                  <span className="font-head font-bold text-xl" style={{ color: 'var(--gold)' }}>{s.compliance}%</span>
                </td>
                <td className="px-4 py-4">{bar(s.nispom)}</td>
                <td className="px-4 py-4">{bar(s.daapm)}</td>
                <td className="px-4 py-4">{bar(s.icd705)}</td>
                <td className="px-4 py-4">{bar(s.tempest)}</td>
                <td className="px-4 py-4 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{s.ssm || '—'}</td>
                <td className="px-4 py-4 text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{fmtDate(s.nextAudit)}</td>
                <td className="px-4 py-4"><Badge cls={s.status === 'green' ? 'b-g' : 'b-a'}>{s.status === 'green' ? 'COMPLIANT' : 'NEEDS ATTN'}</Badge></td>
                <td className="px-4 py-4">
                  <button onClick={() => MASH.openSiteModal && MASH.openSiteModal(s.id)}
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors"
                    style={{ color: 'var(--gold)', letterSpacing: '.07em' }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sites.slice(0, 6).map(s => (
          <div key={s.id} className="card p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="font-head font-bold uppercase tracking-wide text-sm" style={{ color: 'var(--off-white)', letterSpacing: '.08em' }}>{s.name}</div>
              <Badge cls={s.openFindings > 0 ? 'b-a' : 'b-g'}>{s.openFindings || 0} findings</Badge>
            </div>
            <div className="mb-4" style={{ fontSize: '10px', color: 'rgba(143,163,192,.35)' }}>SSM: {s.ssm || '—'} · {s.personnel} personnel · {s.scifZones} SCIF zones</div>
            <div className="grid grid-cols-2 gap-2 mb-4" style={{ fontSize: '9px' }}>
              {[
                ['TS/SCI',    s.totalClearances?.tsSci || 0],
                ['SECRET',   s.totalClearances?.secret || 0],
                ['Sq Ft',    (s.squareFootage || 0).toLocaleString()],
                ['Accred Exp', fmtShort(s.accreditationExpiry)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg p-2" style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.08)' }}>
                  <span style={{ color: 'rgba(143,163,192,.4)' }}>{k} </span>
                  <span className="font-bold" style={{ color: 'rgba(240,244,248,.75)' }}>{v}</span>
                </div>
              ))}
            </div>
            {s.notes && <div style={{ fontSize: '9px', color: 'rgba(143,163,192,.3)' }} className="italic line-clamp-2">{s.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
