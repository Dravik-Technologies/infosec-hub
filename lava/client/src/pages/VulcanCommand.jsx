import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import lavaBackdrop from '../assets/lava-backdrop.png';

const STATUS_COLORS = {
  pending:     { bg: 'rgba(255,165,0,0.12)', border: 'rgba(255,165,0,0.4)', text: '#FFA500' },
  approved:    { bg: 'rgba(0,200,100,0.1)',  border: 'rgba(0,200,100,0.35)', text: '#00C864' },
  rejected:    { bg: 'rgba(139,0,0,0.15)',   border: 'rgba(139,0,0,0.4)',    text: '#ff6666' },
  provisioned: { bg: 'rgba(255,69,0,0.12)', border: 'rgba(255,69,0,0.4)',   text: '#FF4500' },
};

const Badge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '0.15rem 0.6rem', borderRadius: '2px', fontSize: '0.65rem', letterSpacing: '0.12em' }}>
      {status.toUpperCase()}
    </span>
  );
};

const Modal = ({ title, children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,5,5,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }} onClick={onClose}>
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 0 40px rgba(255,69,0,0.2)', borderRadius: '4px', padding: '2rem', width: '100%', maxWidth: '540px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--orange)', fontSize: '0.9rem', letterSpacing: '0.2em' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const inputStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.65rem 0.85rem', fontSize: '0.82rem', borderRadius: '3px', outline: 'none' };
const labelStyle = { display: 'block', color: 'var(--muted)', fontSize: '0.68rem', letterSpacing: '0.14em', marginBottom: '0.35rem' };
const btnBase    = { padding: '0.6rem 1.25rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.12em', border: '1px solid transparent', fontFamily: 'inherit' };

export default function VulcanCommand() {
  const [saars, setSaars]           = useState([]);
  const [stats, setStats]           = useState({});
  const [filter, setFilter]         = useState('all');
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [modal, setModal]           = useState(null); // 'detail' | 'approve' | 'reject' | 'provision'
  const [rejectReason, setRejectReason] = useState('');
  const [yubiSerial, setYubiSerial] = useState('');
  const [tokenType, setTokenType]   = useState('YubiKey');
  const [working, setWorking]       = useState(false);
  const [toast, setToast]           = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [saarRes, statsRes] = await Promise.all([
        axios.get('/api/saar', { withCredentials: true }),
        axios.get('/api/saar/meta/stats', { withCredentials: true }),
      ]);
      setSaars(saarRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load SAAR data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => { setModal(null); setSelected(null); setRejectReason(''); setYubiSerial(''); };

  const handleApprove = async () => {
    setWorking(true);
    try {
      await axios.patch(`/api/saar/${selected.id}/status`, { status: 'approved' }, { withCredentials: true });
      showToast('SAAR approved successfully.');
      closeModal(); load();
    } catch (err) { showToast(err?.response?.data?.error || 'Action failed'); }
    finally { setWorking(false); }
  };

  const handleReject = async () => {
    setWorking(true);
    try {
      await axios.patch(`/api/saar/${selected.id}/status`, { status: 'rejected', rejectionReason: rejectReason }, { withCredentials: true });
      showToast('SAAR rejected.');
      closeModal(); load();
    } catch (err) { showToast(err?.response?.data?.error || 'Action failed'); }
    finally { setWorking(false); }
  };

  const handleProvision = async () => {
    if (!yubiSerial.trim()) return showToast('Serial number is required.');
    setWorking(true);
    try {
      await axios.patch(`/api/saar/${selected.id}/provision`, { yubiKeySerial: yubiSerial, tokenType }, { withCredentials: true });
      showToast(`Account provisioned. Token SN: ${yubiSerial}`);
      closeModal(); load();
    } catch (err) { showToast(err?.response?.data?.error || 'Provisioning failed'); }
    finally { setWorking(false); }
  };

  const filtered = filter === 'all' ? saars : saars.filter(s => s.status === filter);
  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--bg-card)', border: '1px solid var(--orange)', padding: '0.85rem 1.25rem', borderRadius: '3px', boxShadow: '0 0 20px rgba(255,69,0,0.3)', zIndex: 300, fontSize: '0.82rem', color: 'var(--text)', letterSpacing: '0.05em' }}>
          {toast}
        </div>
      )}

      {/* ── Hero Banner ── */}
      <div style={{
        backgroundImage:    `url(${lavaBackdrop})`,
        backgroundSize:     'cover',
        backgroundPosition: 'center 25%',
        backgroundRepeat:   'no-repeat',
        position:           'relative',
        minHeight:          '200px',
        display:            'flex',
        alignItems:         'flex-end',
        borderBottom:       '1px solid var(--border)',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(11,5,5,0.25) 0%, rgba(11,5,5,0.6) 50%, rgba(11,5,5,0.97) 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(11,5,5,0.55) 0%, transparent 35%, transparent 65%, rgba(11,5,5,0.55) 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '0 1.5rem 1.75rem' }}>
          <p style={{ color: 'var(--orange)', letterSpacing: '0.35em', fontSize: '0.66rem', marginBottom: '0.4rem', textShadow: '0 0 12px rgba(255,69,0,0.5)' }}>
            // RESTRICTED — VULCAN PERSONNEL ONLY
          </p>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '0.25em', textShadow: '0 0 30px rgba(255,69,0,0.25)' }}>
            VULCAN <span style={{ color: 'var(--orange)' }}>COMMAND</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.35rem', letterSpacing: '0.12em' }}>
            SAAR Adjudication &amp; Account Provisioning Center
          </p>
        </div>
      </div>

    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'TOTAL',       value: stats.total || 0,       color: 'var(--text)' },
          { label: 'PENDING',     value: stats.pending || 0,     color: '#FFA500' },
          { label: 'APPROVED',    value: stats.approved || 0,    color: '#00C864' },
          { label: 'REJECTED',    value: stats.rejected || 0,    color: '#ff6666' },
          { label: 'PROVISIONED', value: stats.provisioned || 0, color: 'var(--orange)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1.25rem', boxShadow: 'var(--glow)', textAlign: 'center' }}>
            <div style={{ color, fontSize: '1.8rem', lineHeight: 1 }}>{value}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.65rem', letterSpacing: '0.18em', marginTop: '0.4rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'rejected', 'provisioned'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...btnBase, background: filter === f ? 'var(--orange)' : 'var(--bg-card)', color: filter === f ? '#0B0505' : 'var(--muted)', border: `1px solid ${filter === f ? 'transparent' : 'var(--border)'}`, fontWeight: filter === f ? 'bold' : 'normal' }}>
            {f.toUpperCase()}
          </button>
        ))}
        <button onClick={load} style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', marginLeft: 'auto' }}>↻ REFRESH</button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', boxShadow: 'var(--glow)', overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1.5fr', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'rgba(255,69,0,0.05)' }}>
          {['APPLICANT', 'SYSTEM', 'ORGANIZATION', 'ACCESS TYPE', 'STATUS', 'ACTIONS'].map(h => (
            <div key={h} style={{ color: 'var(--muted)', fontSize: '0.63rem', letterSpacing: '0.16em' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>LOADING SAAR RECORDS...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>NO RECORDS MATCH FILTER: {filter.toUpperCase()}</div>
        ) : filtered.map((s) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1.5fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(255,69,0,0.07)', alignItems: 'center', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,69,0,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div>
              <div style={{ color: 'var(--text)', fontSize: '0.82rem' }}>{s.firstName} {s.lastName}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.68rem', marginTop: '0.15rem' }}>{s.email}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>{fmt(s.createdAt)}</div>
            </div>
            <div style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{s.systemName}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{s.organization}</div>
            <div style={{ fontSize: '0.72rem' }}>
              <span style={{ color: s.accessType === 'privileged' ? '#FFA500' : 'var(--muted)', letterSpacing: '0.06em' }}>
                {s.accessType === 'privileged' ? '▲ PRIVILEGED' : 'STANDARD'}
              </span>
            </div>
            <div><Badge status={s.status} /></div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button onClick={() => { setSelected(s); setModal('detail'); }} style={{ ...btnBase, padding: '0.35rem 0.65rem', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', fontSize: '0.65rem' }}>VIEW</button>
              {s.status === 'pending' && (
                <>
                  <button onClick={() => { setSelected(s); setModal('approve'); }} style={{ ...btnBase, padding: '0.35rem 0.65rem', background: 'rgba(0,200,100,0.1)', color: '#00C864', border: '1px solid rgba(0,200,100,0.3)', fontSize: '0.65rem' }}>APPROVE</button>
                  <button onClick={() => { setSelected(s); setModal('reject'); }} style={{ ...btnBase, padding: '0.35rem 0.65rem', background: 'rgba(139,0,0,0.1)', color: '#ff6666', border: '1px solid rgba(139,0,0,0.3)', fontSize: '0.65rem' }}>REJECT</button>
                </>
              )}
              {s.status === 'approved' && (
                <button onClick={() => { setSelected(s); setModal('provision'); }} style={{ ...btnBase, padding: '0.35rem 0.65rem', background: 'rgba(255,69,0,0.1)', color: 'var(--orange)', border: '1px solid var(--border)', fontSize: '0.65rem' }}>PROVISION</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Detail Modal ── */}
      {modal === 'detail' && selected && (
        <Modal title="SAAR DETAIL" onClose={closeModal}>
          {[
            ['Name',         `${selected.firstName} ${selected.middleInitial || ''} ${selected.lastName}`.trim()],
            ['Rank/Grade',   selected.rankGrade || '—'],
            ['Organization', selected.organization],
            ['Office Symbol',selected.officeSymbol || '—'],
            ['Email',        selected.email],
            ['Phone',        selected.phone || '—'],
            ['Supervisor',   selected.supervisorName || '—'],
            ['System',       selected.systemName],
            ['System Owner', selected.systemOwner || '—'],
            ['Classification', selected.classification],
            ['Access Type',  selected.accessType === 'privileged' ? `PRIVILEGED — ${selected.privilegedAccessType}` : 'STANDARD'],
            ['Purpose',      selected.purposeOfAccess || '—'],
            ['Annual IA Training', selected.annualTrainingDate ? new Date(selected.annualTrainingDate).toLocaleDateString() : '—'],
            ['Deriv. Class. Training', selected.derivativeTrainingDate ? new Date(selected.derivativeTrainingDate).toLocaleDateString() : '—'],
            ['Agreement Signed', selected.agreementSigned ? '✓ Yes' : '✗ No'],
            ['Status',       selected.status.toUpperCase()],
            ['Reviewed By',  selected.reviewedBy || '—'],
            ['YubiKey SN',   selected.yubiKeySerial || '—'],
            ['Provisioned By', selected.provisionedBy || '—'],
            ['Submitted',    new Date(selected.createdAt).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,69,0,0.06)', gap: '1rem' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.72rem', minWidth: '140px', flexShrink: 0 }}>{k}</span>
              <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{v}</span>
            </div>
          ))}
          {selected.rejectionReason && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(139,0,0,0.1)', border: '1px solid rgba(139,0,0,0.3)', borderRadius: '3px' }}>
              <div style={{ color: '#ff6666', fontSize: '0.7rem', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>REJECTION REASON</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{selected.rejectionReason}</div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Approve Modal ── */}
      {modal === 'approve' && selected && (
        <Modal title="APPROVE SAAR REQUEST" onClose={closeModal}>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            You are about to <strong style={{ color: '#00C864' }}>APPROVE</strong> the SAAR submitted by <strong style={{ color: 'var(--text)' }}>{selected.firstName} {selected.lastName}</strong> for access to <strong style={{ color: 'var(--text)' }}>{selected.systemName}</strong>.
            This action will be logged and the applicant will be notified.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={closeModal} style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}>CANCEL</button>
            <button onClick={handleApprove} disabled={working} style={{ ...btnBase, background: '#00C864', color: '#0B0505', border: 'none', fontWeight: 'bold' }}>
              {working ? 'PROCESSING...' : 'CONFIRM APPROVAL'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Reject Modal ── */}
      {modal === 'reject' && selected && (
        <Modal title="REJECT SAAR REQUEST" onClose={closeModal}>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
            Rejecting SAAR from <strong style={{ color: 'var(--text)' }}>{selected.firstName} {selected.lastName}</strong>. Provide a reason for the rejection.
          </p>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>REJECTION REASON</label>
            <textarea
              style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Training dates expired / Insufficient justification / Access not authorized..."
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={closeModal} style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}>CANCEL</button>
            <button onClick={handleReject} disabled={working} style={{ ...btnBase, background: 'var(--red)', color: 'var(--text)', border: '1px solid rgba(139,0,0,0.5)', fontWeight: 'bold' }}>
              {working ? 'PROCESSING...' : 'CONFIRM REJECTION'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Provision Modal ── */}
      {modal === 'provision' && selected && (
        <Modal title="HARDWARE HAND-OFF — PROVISION ACCOUNT" onClose={closeModal}>
          <div style={{ background: 'rgba(255,69,0,0.06)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>
            Record the hardware token serial number issued to <strong style={{ color: 'var(--text)' }}>{selected.firstName} {selected.lastName}</strong>. This action is irreversible and will finalize account provisioning.
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>TOKEN TYPE</label>
            <select style={inputStyle} value={tokenType} onChange={e => setTokenType(e.target.value)}>
              {['YubiKey', 'PIV/CAC', 'RSA SecurID', 'FIDO2 Key', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>TOKEN SERIAL NUMBER *</label>
            <input
              style={{ ...inputStyle, fontFamily: 'var(--font)', letterSpacing: '0.1em' }}
              value={yubiSerial}
              onChange={e => setYubiSerial(e.target.value)}
              placeholder="e.g., 12345678 or CCCC1234ABCD"
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={closeModal} style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}>CANCEL</button>
            <button onClick={handleProvision} disabled={working} style={{ ...btnBase, background: 'var(--orange)', color: '#0B0505', border: 'none', fontWeight: 'bold', boxShadow: '0 0 15px rgba(255,69,0,0.3)' }}>
              {working ? 'PROVISIONING...' : 'MARK AS PROVISIONED'}
            </button>
          </div>
        </Modal>
      )}
    </div>
    </div>
  );
}

