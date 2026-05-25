import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const CLASSIFICATIONS = ['UNCLASSIFIED', 'CUI', 'SECRET', 'TOP SECRET', 'TS/SCI'];
const NETWORK_TYPES   = ['NIPRNET', 'SIPRNET', 'JWICS', 'SIPRNet Enclave', 'Standalone', 'Other'];
const SYSTEM_STATUSES = ['pending', 'active', 'rejected', 'decommissioned'];
const ASSET_STATUSES = ['Assigned', 'Available', 'In Repair', 'Lost', 'Retired', 'Destroyed'];

const inputStyle  = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.65rem 0.85rem', fontSize: '0.82rem', borderRadius: '3px', outline: 'none' };
const labelStyle  = { display: 'block', color: 'var(--muted)', fontSize: '0.68rem', letterSpacing: '0.14em', marginBottom: '0.35rem' };
const fieldStyle  = { marginBottom: '1.1rem' };
const cardStyle   = { background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--glow)', borderRadius: '4px', padding: '1.75rem', marginBottom: '1.5rem' };
const btnBase     = { padding: '0.65rem 1.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.78rem', letterSpacing: '0.12em', border: '1px solid transparent', fontFamily: 'inherit' };

const SectionTitle = ({ label }) => (
  <h3 style={{ color: 'var(--orange)', fontSize: '0.78rem', letterSpacing: '0.2em', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{label}</h3>
);

const Modal = ({ title, children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,5,5,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }} onClick={onClose}>
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 0 40px rgba(255,69,0,0.2)', borderRadius: '4px', padding: '2rem', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--orange)', fontSize: '0.9rem', letterSpacing: '0.2em' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

export default function SystemRequest() {
  const { isVulcan } = useAuth();
  const [systems, setSystems]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [activeSystem, setActiveSystem] = useState(null);
  const [assets, setAssets]         = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [toast, setToast]           = useState('');
  const [uploading, setUploading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [errors, setErrors]         = useState({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [systemStatus, setSystemStatus] = useState('pending');
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetForm, setAssetForm] = useState({
    assetTag: '', serialNumber: '', make: '', model: '', assetType: '',
    status: 'Assigned', classification: 'UNCLASSIFIED', assignedUser: '', location: '', notes: '',
  });
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    systemName: '', systemOwner: '', ownerEmail: '', ownerPhone: '',
    classification: 'UNCLASSIFIED', purpose: '', networkType: '',
  });

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadSystems = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/systems', { withCredentials: true });
      setSystems(data);
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.error || 'Failed to load systems');
    } finally { setLoading(false); }
  };

  const loadAssets = async (systemId) => {
    setAssetsLoading(true);
    try {
      const { data } = await axios.get(`/api/hardware?systemId=${systemId}`, { withCredentials: true });
      setAssets(data);
    } catch (err) { setAssets([]); }
    finally { setAssetsLoading(false); }
  };

  useEffect(() => { loadSystems(); }, []);

  const handleSelectSystem = (s) => {
    setActiveSystem(s);
    setSystemStatus(s.status);
    setReviewNotes(s.reviewNotes || '');
    loadAssets(s.id);
  };

  const validate = () => {
    const e = {};
    if (!form.systemName.trim())  e.systemName  = 'System name is required';
    if (!form.systemOwner.trim()) e.systemOwner = 'System owner is required';
    if (!form.ownerEmail.trim())  e.ownerEmail  = 'Owner email is required';
    if (!/\S+@\S+\.\S+/.test(form.ownerEmail)) e.ownerEmail = 'Invalid email';
    if (!form.purpose.trim())     e.purpose     = 'Purpose is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmitSystem = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post('/api/systems', form, { withCredentials: true });
      showToast(`System integration request created: ${data.systemName}`);
      setShowForm(false);
      setForm({ systemName: '', systemOwner: '', ownerEmail: '', ownerPhone: '', classification: 'UNCLASSIFIED', purpose: '', networkType: '' });
      await loadSystems();
      setActiveSystem(data);
      setAssets([]);
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const resp = await axios.get('/api/hardware/template', { responseType: 'blob', withCredentials: true });
      const url  = URL.createObjectURL(resp.data);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'LAVA_Hardware_Template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch { showToast('Failed to download template'); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeSystem) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const { data } = await axios.post(`/api/hardware/upload/${activeSystem.id}`, fd, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(data.message);
      loadAssets(activeSystem.id);
    } catch (err) {
      showToast(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAsset = async (assetId) => {
    try {
      await axios.delete(`/api/hardware/${assetId}`, { withCredentials: true });
      setAssets(prev => prev.filter(a => a.id !== assetId));
      showToast('Asset removed.');
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to remove asset'); }
  };

  const openEditAsset = (asset) => {
    setEditingAsset(asset);
    setAssetForm({
      assetTag: asset.assetTag || '',
      serialNumber: asset.serialNumber || '',
      make: asset.make || '',
      model: asset.model || '',
      assetType: asset.assetType || '',
      status: asset.status || 'Assigned',
      classification: asset.classification || 'UNCLASSIFIED',
      assignedUser: asset.assignedUser || '',
      location: asset.location || '',
      notes: asset.notes || '',
    });
  };

  const closeAssetModal = () => {
    setEditingAsset(null);
    setAssetForm({
      assetTag: '', serialNumber: '', make: '', model: '', assetType: '',
      status: 'Assigned', classification: 'UNCLASSIFIED', assignedUser: '', location: '', notes: '',
    });
  };

  const handleUpdateSystemStatus = async () => {
    if (!activeSystem) return;
    setSavingStatus(true);
    try {
      const { data } = await axios.patch(`/api/systems/${activeSystem.id}/status`, { status: systemStatus, reviewNotes }, { withCredentials: true });
      showToast(`System status updated to ${data.status}.`);
      await loadSystems();
      setActiveSystem((prev) => ({ ...prev, ...data }));
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to update system status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveAsset = async () => {
    if (!editingAsset) return;
    setSavingAsset(true);
    try {
      const { data } = await axios.patch(`/api/hardware/${editingAsset.id}`, assetForm, { withCredentials: true });
      setAssets((prev) => prev.map((asset) => (asset.id === data.id ? data : asset)));
      showToast(`Asset ${data.assetTag || data.serialNumber || data.id} updated.`);
      closeAssetModal();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to update asset');
    } finally {
      setSavingAsset(false);
    }
  };

  const statusColor = (s) => ({ pending: '#FFA500', active: '#00C864', rejected: '#ff6666', decommissioned: 'var(--muted)' }[s] || 'var(--muted)');
  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--bg-card)', border: '1px solid var(--orange)', padding: '0.85rem 1.25rem', borderRadius: '3px', boxShadow: '0 0 20px rgba(255,69,0,0.3)', zIndex: 300, fontSize: '0.82rem', color: 'var(--text)' }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ color: 'var(--orange)', letterSpacing: '0.3em', fontSize: '0.68rem' }}>// LAVA ONBOARDING MODULE</p>
          <h1 style={{ fontSize: '1.4rem', letterSpacing: '0.2em', marginTop: '0.35rem' }}>
            SYSTEM <span style={{ color: 'var(--orange)' }}>INTEGRATION</span> REQUEST
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.3rem' }}>Register new systems and bulk-import hardware assets via Excel template.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ ...btnBase, background: showForm ? 'transparent' : 'var(--orange)', color: showForm ? 'var(--muted)' : '#0B0505', border: showForm ? '1px solid var(--border)' : 'none', fontWeight: 'bold', boxShadow: showForm ? 'none' : '0 0 15px rgba(255,69,0,0.3)' }}>
          {showForm ? 'CANCEL' : '+ NEW SYSTEM REQUEST'}
        </button>
      </div>

      {/* ── New System Form ── */}
      {showForm && (
        <div style={cardStyle}>
          <SectionTitle label="NEW SYSTEM INTEGRATION REQUEST" />
          <form onSubmit={handleSubmitSystem}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>SYSTEM NAME *</label>
                <input style={inputStyle} value={form.systemName} onChange={e => set('systemName', e.target.value)} placeholder="LAVA Node Alpha" />
                {errors.systemName && <div style={{ color: '#ff6666', fontSize: '0.7rem', marginTop: '0.25rem' }}>{errors.systemName}</div>}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>SYSTEM OWNER *</label>
                <input style={inputStyle} value={form.systemOwner} onChange={e => set('systemOwner', e.target.value)} placeholder="MAJ Smith" />
                {errors.systemOwner && <div style={{ color: '#ff6666', fontSize: '0.7rem', marginTop: '0.25rem' }}>{errors.systemOwner}</div>}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>OWNER EMAIL *</label>
                <input style={inputStyle} type="email" value={form.ownerEmail} onChange={e => set('ownerEmail', e.target.value)} placeholder="owner@mail.mil" />
                {errors.ownerEmail && <div style={{ color: '#ff6666', fontSize: '0.7rem', marginTop: '0.25rem' }}>{errors.ownerEmail}</div>}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>OWNER PHONE</label>
                <input style={inputStyle} type="tel" value={form.ownerPhone} onChange={e => set('ownerPhone', e.target.value)} placeholder="DSN: 312-XXX-XXXX" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>CLASSIFICATION</label>
                <select style={inputStyle} value={form.classification} onChange={e => set('classification', e.target.value)}>
                  {CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>NETWORK TYPE</label>
                <select style={inputStyle} value={form.networkType} onChange={e => set('networkType', e.target.value)}>
                  <option value="">Select Network</option>
                  {NETWORK_TYPES.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <label style={labelStyle}>PURPOSE / JUSTIFICATION *</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="Describe the mission purpose and operational justification for this system integration..." />
                {errors.purpose && <div style={{ color: '#ff6666', fontSize: '0.7rem', marginTop: '0.25rem' }}>{errors.purpose}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}>CANCEL</button>
              <button type="submit" disabled={submitting} style={{ ...btnBase, background: 'var(--orange)', color: '#0B0505', border: 'none', fontWeight: 'bold', boxShadow: '0 0 15px rgba(255,69,0,0.3)' }}>
                {submitting ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── System List + Detail ── */}
      <div style={{ display: 'grid', gridTemplateColumns: activeSystem ? '320px 1fr' : '1fr', gap: '1.5rem' }}>
        {/* System List */}
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', boxShadow: 'var(--glow)', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'rgba(255,69,0,0.05)' }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.65rem', letterSpacing: '0.18em' }}>REGISTERED SYSTEMS ({systems.length})</span>
            </div>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>LOADING...</div>
            ) : systems.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No systems registered yet.</div>
            ) : systems.map(s => (
              <div key={s.id} onClick={() => handleSelectSystem(s)} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,69,0,0.07)', cursor: 'pointer', background: activeSystem?.id === s.id ? 'rgba(255,69,0,0.08)' : 'transparent', borderLeft: activeSystem?.id === s.id ? '3px solid var(--orange)' : '3px solid transparent', transition: 'all 0.15s' }}>
                <div style={{ color: 'var(--text)', fontSize: '0.82rem', fontWeight: activeSystem?.id === s.id ? 'bold' : 'normal' }}>{s.systemName}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>{s.systemOwner}</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.62rem', color: statusColor(s.status), letterSpacing: '0.08em' }}>{s.status.toUpperCase()}</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--muted)', opacity: 0.7 }}>{s.classification}</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--muted)', opacity: 0.5 }}>{s.assets?.length || 0} assets</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Detail */}
        {activeSystem && (
          <div>
            {/* System Info */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ color: 'var(--text)', fontSize: '1.1rem', letterSpacing: '0.1em' }}>{activeSystem.systemName}</h2>
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>{activeSystem.ownerEmail}</div>
                </div>
                <span style={{ color: statusColor(activeSystem.status), fontSize: '0.7rem', letterSpacing: '0.12em', border: `1px solid ${statusColor(activeSystem.status)}`, padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
                  {activeSystem.status.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                {[
                  ['Owner',          activeSystem.systemOwner],
                  ['Classification', activeSystem.classification],
                  ['Network',        activeSystem.networkType || '—'],
                  ['Phone',          activeSystem.ownerPhone || '—'],
                  ['Submitted',      new Date(activeSystem.createdAt).toLocaleDateString()],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: 'var(--muted)', fontSize: '0.65rem', letterSpacing: '0.14em', marginBottom: '0.2rem' }}>{k}</div>
                    <div style={{ color: 'var(--text)', fontSize: '0.82rem' }}>{v}</div>
                  </div>
                ))}
              </div>
              {activeSystem.purpose && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--muted)', fontSize: '0.65rem', letterSpacing: '0.14em', marginBottom: '0.35rem' }}>PURPOSE</div>
                  <div style={{ color: 'var(--text)', fontSize: '0.82rem', lineHeight: 1.7 }}>{activeSystem.purpose}</div>
                </div>
              )}
              {isVulcan && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem', alignItems: 'end' }}>
                    <div>
                      <label style={labelStyle}>SYSTEM STATUS</label>
                      <select style={inputStyle} value={systemStatus} onChange={(e) => setSystemStatus(e.target.value)}>
                        {SYSTEM_STATUSES.map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>REVIEW NOTES</label>
                      <textarea style={{ ...inputStyle, minHeight: '84px', resize: 'vertical' }} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Approval notes, onboarding blockers, or decommissioning details..." />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.9rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
                      Reviewed by: <span style={{ color: 'var(--text)' }}>{activeSystem.reviewedBy || '—'}</span>
                    </div>
                    <button onClick={handleUpdateSystemStatus} disabled={savingStatus} style={{ ...btnBase, background: 'var(--orange)', color: '#0B0505', border: 'none', fontWeight: 'bold' }}>
                      {savingStatus ? 'SAVING...' : 'SAVE STATUS'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hardware Section */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <SectionTitle label={`HARDWARE REGISTRY — ${assets.length} ASSET(S)`} />
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button onClick={handleDownloadTemplate} style={{ ...btnBase, background: 'transparent', color: 'var(--orange)', border: '1px solid var(--border)', fontSize: '0.72rem' }}>
                    ⬇ DOWNLOAD TEMPLATE
                  </button>
                  <label style={{ ...btnBase, background: uploading ? 'var(--red)' : 'rgba(255,69,0,0.1)', color: uploading ? 'var(--muted)' : 'var(--orange)', border: '1px solid var(--border)', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.72rem' }}>
                    {uploading ? 'IMPORTING...' : '⬆ UPLOAD EXCEL'}
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
                  </label>
                </div>
              </div>

              <div style={{ background: 'rgba(255,69,0,0.04)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                ℹ Download the Excel template, fill in your hardware assets, then upload. All assets will be bulk-imported into the LAVA hardware registry for this system.
              </div>

              {assetsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.8rem' }}>LOADING ASSETS...</div>
              ) : assets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.8rem' }}>No hardware assets registered. Download the template and upload to add assets.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Asset Tag', 'Serial #', 'Make / Model', 'Type', 'Status', 'Classification', 'Assigned To', 'Location', ''].map(h => (
                          <th key={h} style={{ color: 'var(--muted)', fontSize: '0.62rem', letterSpacing: '0.12em', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 'normal' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map(a => (
                        <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,69,0,0.06)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,69,0,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--orange)' }}>{a.assetTag || '—'}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text)', fontFamily: 'monospace' }}>{a.serialNumber || '—'}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text)' }}>{[a.make, a.model].filter(Boolean).join(' ') || '—'}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--muted)' }}>{a.assetType || '—'}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--orange)' }}>{a.status || 'Assigned'}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--muted)' }}>{a.classification}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text)' }}>{a.assignedUser || '—'}</td>
                          <td style={{ padding: '0.55rem 0.75rem', color: 'var(--muted)' }}>{a.location || '—'}</td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>
                            <button onClick={() => openEditAsset(a)} style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontSize: '0.72rem', marginRight: '0.5rem' }} title="Edit asset">EDIT</button>
                            <button onClick={() => handleDeleteAsset(a.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem' }} title="Remove asset">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {editingAsset && (
        <Modal title="EDIT HARDWARE ASSET" onClose={closeAssetModal}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>ASSET TAG</label>
              <input style={inputStyle} value={assetForm.assetTag} onChange={(e) => setAssetForm((prev) => ({ ...prev, assetTag: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>SERIAL NUMBER</label>
              <input style={inputStyle} value={assetForm.serialNumber} onChange={(e) => setAssetForm((prev) => ({ ...prev, serialNumber: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>MAKE</label>
              <input style={inputStyle} value={assetForm.make} onChange={(e) => setAssetForm((prev) => ({ ...prev, make: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>MODEL</label>
              <input style={inputStyle} value={assetForm.model} onChange={(e) => setAssetForm((prev) => ({ ...prev, model: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>TYPE</label>
              <input style={inputStyle} value={assetForm.assetType} onChange={(e) => setAssetForm((prev) => ({ ...prev, assetType: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>STATUS</label>
              <select style={inputStyle} value={assetForm.status} onChange={(e) => setAssetForm((prev) => ({ ...prev, status: e.target.value }))}>
                {ASSET_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>CLASSIFICATION</label>
              <select style={inputStyle} value={assetForm.classification} onChange={(e) => setAssetForm((prev) => ({ ...prev, classification: e.target.value }))}>
                {CLASSIFICATIONS.map((classification) => <option key={classification}>{classification}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>ASSIGNED USER</label>
              <input style={inputStyle} value={assetForm.assignedUser} onChange={(e) => setAssetForm((prev) => ({ ...prev, assignedUser: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>LOCATION</label>
              <input style={inputStyle} value={assetForm.location} onChange={(e) => setAssetForm((prev) => ({ ...prev, location: e.target.value }))} />
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>NOTES</label>
              <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} value={assetForm.notes} onChange={(e) => setAssetForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button onClick={closeAssetModal} style={{ ...btnBase, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}>CANCEL</button>
            <button onClick={handleSaveAsset} disabled={savingAsset} style={{ ...btnBase, background: 'var(--orange)', color: '#0B0505', border: 'none', fontWeight: 'bold' }}>
              {savingAsset ? 'SAVING...' : 'SAVE ASSET'}
            </button>
          </div>
          {editingAsset.assignmentHistory?.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ color: 'var(--orange)', fontSize: '0.72rem', letterSpacing: '0.16em', marginBottom: '0.75rem' }}>ASSIGNMENT HISTORY</div>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {editingAsset.assignmentHistory.map((entry) => (
                  <div key={entry.id} style={{ background: 'rgba(255,69,0,0.05)', border: '1px solid rgba(255,69,0,0.08)', borderRadius: '3px', padding: '0.75rem' }}>
                    <div style={{ color: 'var(--text)', fontSize: '0.78rem' }}>{entry.assignedUser || 'Unassigned'}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.68rem', marginTop: '0.15rem' }}>
                      Assigned {formatDate(entry.assignedAt)} by {entry.assignedBy || '—'}
                      {entry.returnedAt ? ` • Returned ${formatDate(entry.returnedAt)}` : ' • Active assignment'}
                    </div>
                    {(entry.previousUser || entry.notes) && (
                      <div style={{ color: 'var(--muted)', fontSize: '0.68rem', marginTop: '0.2rem' }}>
                        {entry.previousUser ? `Previous: ${entry.previousUser}` : ''}
                        {entry.previousUser && entry.notes ? ' • ' : ''}
                        {entry.notes || ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
