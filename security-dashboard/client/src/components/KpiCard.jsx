import { Prog } from './index.jsx';

export default function KpiCard({ icon, label, value, valueColor, sub, progress, children }) {
  return (
    <div className="card card-kpi card-tilt p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.18)' }}>
          <i className={`fa-solid ${icon} text-base`} style={{ color: 'var(--gold)' }} />
        </div>
      </div>
      <div className="uppercase tracking-widest mb-2" style={{ fontSize: '.59rem', fontWeight: 700, color: 'rgba(143,163,192,.5)', letterSpacing: '.1em' }}>{label}</div>
      <div className="font-head font-bold leading-none mb-2.5" style={{ fontSize: '2rem', color: valueColor || 'var(--gold)' }}>{value}</div>
      {progress != null && <div className="mb-3"><Prog v={progress} cls={progress >= 90 ? 'p-g' : progress >= 75 ? 'p-gold' : 'p-a'} /></div>}
      <div className="text-xs" style={{ color: 'rgba(143,163,192,.45)' }}>{sub}</div>
      {children}
    </div>
  );
}
