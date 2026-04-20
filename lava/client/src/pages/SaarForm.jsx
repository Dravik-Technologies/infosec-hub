import React, { useState } from 'react';
import axios from 'axios';

const STEPS = ['PERSONAL INFO', 'SYSTEM ACCESS', 'TRAINING', 'USER AGREEMENT', 'REVIEW & SUBMIT'];
const CLASSIFICATIONS = ['UNCLASSIFIED', 'CUI', 'SECRET', 'TOP SECRET', 'TS/SCI'];
const NETWORKS = ['NIPRNET', 'SIPRNET', 'JWICS', 'Local Network', 'Other'];
const PRIVILEGED_TYPES = ['System Administrator', 'Network Administrator', 'Database Administrator', 'Security Administrator', 'Other Privileged Role'];

const USER_AGREEMENT_TEXT = `SYSTEM ACCESS AUTHORIZATION REQUEST — USER AGREEMENT

By signing this document, I acknowledge and agree to the following terms governing my access to the LAVA Network System and associated information resources:

1. AUTHORIZED USE ONLY. I will access this system solely for official U.S. Government business or other authorized purpose. I understand that use of this system for personal gain, unauthorized disclosure, or any other unauthorized purpose is strictly prohibited.

2. MONITORING AND CONSENT. I consent to monitoring of all activity on this system. I understand that I have no reasonable expectation of privacy while using government information systems, and that use of this system constitutes consent to monitoring.

3. INFORMATION HANDLING. I will handle all information in accordance with the classification markings assigned. I will not introduce, store, process, or transmit classified information on systems not authorized to handle that level of classification.

4. PASSWORD & TOKEN SECURITY. I am responsible for maintaining the confidentiality of my authentication credentials and hardware tokens (CAC/YubiKey). I will immediately report any suspected compromise to the ISSO.

5. TRAINING COMPLIANCE. I certify that I have completed all required IA training within the past 365 days, including Annual IA Training and Derivative Classification Training, as documented in Section III of this request.

6. PRIVILEGED ACCESS (if applicable). If granted privileged access, I understand I am subject to additional monitoring, restrictions, and accountability measures as defined by DOD 8140 and applicable STIGs.

7. VIOLATIONS. I understand that violation of these terms may result in suspension or revocation of system access privileges, administrative action, civil liability, or criminal penalties under Title 18, United States Code.

8. ACKNOWLEDGMENT. I have read, understand, and agree to comply with all applicable policies, regulations, and directives governing the use of this system.

Reference: DODI 8500.01 | NIST SP 800-53 Rev 5 | DD Form 2875 | AR 25-2`;

const daysAgo = (dateStr) => {
  if (!dateStr) return null;
  const diff = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
};

const isExpired = (dateStr) => {
  const d = daysAgo(dateStr);
  return d === null || d > 365;
};

const inputStyle = {
  width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text)', padding: '0.65rem 0.85rem', fontSize: '0.82rem',
  borderRadius: '3px', outline: 'none', letterSpacing: '0.04em',
};
const labelStyle = {
  display: 'block', color: 'var(--muted)', fontSize: '0.68rem',
  letterSpacing: '0.14em', marginBottom: '0.35rem',
};
const fieldStyle = { marginBottom: '1.1rem' };
const gridStyle  = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };
const reqMark    = <span style={{ color: 'var(--orange)' }}>*</span>;

const SectionTitle = ({ label }) => (
  <h3 style={{ color: 'var(--orange)', fontSize: '0.78rem', letterSpacing: '0.2em', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
    {label}
  </h3>
);

export default function SaarForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    // Step 1 — Personal
    lastName: '', firstName: '', middleInitial: '', rankGrade: '',
    organization: '', officeSymbol: '', phone: '', email: '',
    supervisorName: '', supervisorPhone: '', supervisorEmail: '',
    // Step 2 — System
    systemName: '', systemOwner: '', classification: 'UNCLASSIFIED', purposeOfAccess: '',
    accessType: 'standard', privilegedJustification: '', privilegedAccessType: '',
    // Step 3 — Training
    annualTrainingDate: '', derivativeTrainingDate: '',
    // Step 4 — Agreement
    agreementSigned: false,
  });
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fieldErr = (k) => errors[k] ? <div style={{ color: '#ff6666', fontSize: '0.7rem', marginTop: '0.25rem' }}>{errors[k]}</div> : null;

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!form.lastName.trim())    e.lastName    = 'Last name is required';
      if (!form.firstName.trim())   e.firstName   = 'First name is required';
      if (!form.organization.trim()) e.organization = 'Organization is required';
      if (!form.email.trim())       e.email       = 'Email is required';
      if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email format';
    }
    if (step === 1) {
      if (!form.systemName.trim())    e.systemName    = 'System name is required';
      if (!form.purposeOfAccess.trim()) e.purposeOfAccess = 'Purpose of access is required';
      if (form.accessType === 'privileged') {
        if (!form.privilegedJustification.trim()) e.privilegedJustification = 'Justification required for privileged access';
        if (!form.privilegedAccessType)           e.privilegedAccessType    = 'Select privileged access type';
      }
    }
    if (step === 2) {
      if (!form.annualTrainingDate)    e.annualTrainingDate    = 'Annual IA Training date is required';
      if (!form.derivativeTrainingDate) e.derivativeTrainingDate = 'Derivative Classification Training date is required';
      if (form.annualTrainingDate && isExpired(form.annualTrainingDate))
        e.annualTrainingDate = `Training expired (${daysAgo(form.annualTrainingDate)} days ago). Must be within 365 days.`;
      if (form.derivativeTrainingDate && isExpired(form.derivativeTrainingDate))
        e.derivativeTrainingDate = `Training expired (${daysAgo(form.derivativeTrainingDate)} days ago). Must be within 365 days.`;
    }
    if (step === 3) {
      if (!form.agreementSigned) e.agreementSigned = 'You must acknowledge and sign the user agreement to proceed.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => s + 1); };
  const prev = () => { setErrors({}); setStep(s => s - 1); };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await axios.post('/api/saar', { ...form, agreementSignedAt: new Date().toISOString() }, { withCredentials: true });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err?.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
        <h2 style={{ color: 'var(--orange)', letterSpacing: '0.2em', marginBottom: '0.75rem' }}>SAAR SUBMITTED</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: '0.85rem' }}>
          Your System Access Authorization Request has been received. A Vulcan administrator will review your request and contact you at <strong style={{ color: 'var(--text)' }}>{form.email}</strong> once a decision has been made.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '1.25rem', letterSpacing: '0.08em' }}>
          Average review time: 2–5 business days
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ color: 'var(--orange)', letterSpacing: '0.3em', fontSize: '0.68rem' }}>// DD FORM 2875 — DIGITAL EQUIVALENT</p>
        <h1 style={{ fontSize: '1.4rem', letterSpacing: '0.2em', marginTop: '0.35rem' }}>
          SYSTEM ACCESS <span style={{ color: 'var(--orange)' }}>AUTHORIZATION</span> REQUEST
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '0.4rem' }}>
          Complete all required fields ({reqMark} denotes required). All information is subject to verification.
        </p>
      </div>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '2.25rem' }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ height: '3px', background: i <= step ? 'var(--orange)' : 'var(--border)', transition: 'background 0.3s', boxShadow: i <= step ? '0 0 8px rgba(255,69,0,0.5)' : 'none' }} />
            <div style={{ fontSize: '0.58rem', color: i === step ? 'var(--orange)' : 'var(--muted)', letterSpacing: '0.1em', marginTop: '0.35rem', textAlign: 'center' }}>
              {i + 1}. {label}
            </div>
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--glow)', borderRadius: '4px', padding: '2rem' }}>

        {/* ── Step 0: Personal Info ── */}
        {step === 0 && (
          <>
            <SectionTitle label="SECTION I — PERSONAL INFORMATION" />
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>LAST NAME {reqMark}</label>
                <input style={inputStyle} value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="SMITH" />
                {fieldErr('lastName')}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>FIRST NAME {reqMark}</label>
                <input style={inputStyle} value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="JOHN" />
                {fieldErr('firstName')}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>MIDDLE INITIAL</label>
                <input style={inputStyle} value={form.middleInitial} onChange={e => set('middleInitial', e.target.value)} placeholder="A" maxLength={2} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>RANK / GRADE</label>
                <input style={inputStyle} value={form.rankGrade} onChange={e => set('rankGrade', e.target.value)} placeholder="CPT / GS-12" />
              </div>
            </div>
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>ORGANIZATION {reqMark}</label>
                <input style={inputStyle} value={form.organization} onChange={e => set('organization', e.target.value)} placeholder="Unit / Agency" />
                {fieldErr('organization')}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>OFFICE SYMBOL</label>
                <input style={inputStyle} value={form.officeSymbol} onChange={e => set('officeSymbol', e.target.value)} placeholder="G6-NET" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>PHONE</label>
                <input style={inputStyle} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="DSN: 312-XXX-XXXX" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>EMAIL {reqMark}</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="j.smith@mail.mil" />
                {fieldErr('email')}
              </div>
            </div>

            <SectionTitle label="SUPERVISOR INFORMATION" />
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>SUPERVISOR NAME</label>
                <input style={inputStyle} value={form.supervisorName} onChange={e => set('supervisorName', e.target.value)} placeholder="MAJ Williams" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>SUPERVISOR PHONE</label>
                <input style={inputStyle} type="tel" value={form.supervisorPhone} onChange={e => set('supervisorPhone', e.target.value)} placeholder="DSN: 312-XXX-XXXX" />
              </div>
              <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <label style={labelStyle}>SUPERVISOR EMAIL</label>
                <input style={inputStyle} type="email" value={form.supervisorEmail} onChange={e => set('supervisorEmail', e.target.value)} placeholder="supervisor@mail.mil" />
              </div>
            </div>
          </>
        )}

        {/* ── Step 1: System Access ── */}
        {step === 1 && (
          <>
            <SectionTitle label="SECTION II — SYSTEM AND ACCESS INFORMATION" />
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>SYSTEM NAME {reqMark}</label>
                <input style={inputStyle} value={form.systemName} onChange={e => set('systemName', e.target.value)} placeholder="LAVA Network System" />
                {fieldErr('systemName')}
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>SYSTEM OWNER / ISSO</label>
                <input style={inputStyle} value={form.systemOwner} onChange={e => set('systemOwner', e.target.value)} placeholder="MAJ Caldwell" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>CLASSIFICATION LEVEL</label>
                <select style={inputStyle} value={form.classification} onChange={e => set('classification', e.target.value)}>
                  {CLASSIFICATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>NETWORK</label>
                <select style={inputStyle} value={form.network || ''} onChange={e => set('network', e.target.value)}>
                  <option value="">Select Network</option>
                  {NETWORKS.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>PURPOSE OF ACCESS {reqMark}</label>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={form.purposeOfAccess}
                onChange={e => set('purposeOfAccess', e.target.value)}
                placeholder="Describe the specific mission need for this access request..."
              />
              {fieldErr('purposeOfAccess')}
            </div>

            <SectionTitle label="ACCESS TYPE" />
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              {[
                { value: 'standard',   label: 'STANDARD USER',   desc: 'Normal read/write access to authorized resources.' },
                { value: 'privileged', label: 'PRIVILEGED USER',  desc: 'Administrative or elevated system access (requires additional justification).' },
              ].map(({ value, label, desc }) => (
                <div
                  key={value}
                  onClick={() => set('accessType', value)}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: '3px', cursor: 'pointer',
                    background: form.accessType === value ? 'rgba(255,69,0,0.1)' : 'var(--bg-input)',
                    border: `1px solid ${form.accessType === value ? 'var(--orange)' : 'var(--border)'}`,
                    boxShadow: form.accessType === value ? '0 0 12px rgba(255,69,0,0.2)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ color: form.accessType === value ? 'var(--orange)' : 'var(--text)', fontWeight: 'bold', fontSize: '0.78rem', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>{label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>{desc}</div>
                </div>
              ))}
            </div>

            {form.accessType === 'privileged' && (
              <div style={{ background: 'rgba(139,0,0,0.1)', border: '1px solid rgba(139,0,0,0.3)', borderRadius: '3px', padding: '1.25rem', marginBottom: '1rem' }}>
                <p style={{ color: '#cc4444', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                  ▲ PRIVILEGED USER REQUIREMENTS — Additional fields required
                </p>
                <div style={fieldStyle}>
                  <label style={labelStyle}>PRIVILEGED ACCESS TYPE {reqMark}</label>
                  <select style={inputStyle} value={form.privilegedAccessType} onChange={e => set('privilegedAccessType', e.target.value)}>
                    <option value="">Select Type</option>
                    {PRIVILEGED_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  {fieldErr('privilegedAccessType')}
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>JUSTIFICATION FOR PRIVILEGED ACCESS {reqMark}</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                    value={form.privilegedJustification}
                    onChange={e => set('privilegedJustification', e.target.value)}
                    placeholder="Provide mission-specific justification for requiring privileged access..."
                  />
                  {fieldErr('privilegedJustification')}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Step 2: Training ── */}
        {step === 2 && (
          <>
            <SectionTitle label="SECTION III — TRAINING CERTIFICATION" />
            <div style={{ background: 'rgba(255,69,0,0.06)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.7 }}>
              ℹ All training must have been completed within the past <strong style={{ color: 'var(--orange)' }}>365 days</strong>. Requests with expired training will be rejected. Contact your unit training officer if training records need to be updated.
            </div>

            {[
              { key: 'annualTrainingDate', label: 'ANNUAL IA TRAINING COMPLETION DATE', note: 'DoD Cyber Awareness Challenge or equivalent' },
              { key: 'derivativeTrainingDate', label: 'DERIVATIVE CLASSIFICATION TRAINING DATE', note: 'Required for all users handling classified information' },
            ].map(({ key, label, note }) => {
              const days = daysAgo(form[key]);
              const expired = isExpired(form[key]);
              return (
                <div key={key} style={{ ...fieldStyle, padding: '1rem', background: 'var(--bg-input)', borderRadius: '3px', border: `1px solid ${form[key] ? (expired ? 'rgba(139,0,0,0.5)' : 'rgba(255,69,0,0.4)') : 'var(--border)'}` }}>
                  <label style={labelStyle}>{label} {reqMark}</label>
                  <input style={{ ...inputStyle, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '0.35rem 0' }} type="date" value={form[key]} onChange={e => set(key, e.target.value)} max={new Date().toISOString().split('T')[0]} />
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.4rem' }}>{note}</div>
                  {form[key] && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: expired ? '#ff6666' : 'var(--orange)' }}>
                      {expired ? `⚠ EXPIRED: ${days} days ago (exceeds 365-day limit)` : `✓ VALID: ${days} days ago (${365 - days} days remaining)`}
                    </div>
                  )}
                  {fieldErr(key)}
                </div>
              );
            })}

            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(139,0,0,0.08)', border: '1px solid rgba(139,0,0,0.25)', borderRadius: '3px' }}>
              <p style={{ color: 'var(--muted)', fontSize: '0.78rem', lineHeight: 1.7 }}>
                By submitting this form, I certify that all training dates listed above are accurate and that I have retained all applicable training certificates. False statements are punishable under 18 U.S.C. § 1001.
              </p>
            </div>
          </>
        )}

        {/* ── Step 3: User Agreement ── */}
        {step === 3 && (
          <>
            <SectionTitle label="SECTION IV — SYSTEM USER AGREEMENT" />
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1.25rem', maxHeight: '340px', overflowY: 'auto', marginBottom: '1.5rem', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.9, whiteSpace: 'pre-wrap', letterSpacing: '0.02em' }}>
              {USER_AGREEMENT_TEXT}
            </div>
            <div
              onClick={() => set('agreementSigned', !form.agreementSigned)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.85rem', padding: '1rem',
                background: form.agreementSigned ? 'rgba(255,69,0,0.08)' : 'var(--bg-input)',
                border: `1px solid ${form.agreementSigned ? 'var(--orange)' : 'var(--border)'}`,
                borderRadius: '3px', cursor: 'pointer',
                boxShadow: form.agreementSigned ? '0 0 10px rgba(255,69,0,0.15)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: '20px', height: '20px', border: `2px solid ${form.agreementSigned ? 'var(--orange)' : 'var(--border)'}`,
                borderRadius: '2px', background: form.agreementSigned ? 'var(--orange)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                color: '#0B0505', fontSize: '0.75rem', fontWeight: 'bold',
              }}>
                {form.agreementSigned ? '✓' : ''}
              </div>
              <div>
                <div style={{ color: form.agreementSigned ? 'var(--orange)' : 'var(--text)', fontSize: '0.82rem', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
                  I ACKNOWLEDGE AND AGREE TO THE SYSTEM USER AGREEMENT
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
                  I have read, understand, and agree to abide by all terms and conditions stated above. I understand this constitutes my electronic signature for the DD Form 2875 User Agreement.
                </div>
              </div>
            </div>
            {fieldErr('agreementSigned')}
          </>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <>
            <SectionTitle label="SECTION V — REVIEW AND SUBMIT" />
            <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>Review your submission before finalizing. Once submitted, changes must be made by contacting a Vulcan administrator.</p>
            {[
              { title: 'PERSONAL INFORMATION', rows: [
                ['Name',         `${form.firstName} ${form.middleInitial} ${form.lastName}`.trim()],
                ['Rank / Grade', form.rankGrade || '—'],
                ['Organization', form.organization],
                ['Email',        form.email],
                ['Phone',        form.phone || '—'],
                ['Supervisor',   form.supervisorName || '—'],
              ]},
              { title: 'SYSTEM ACCESS', rows: [
                ['System Name',    form.systemName],
                ['System Owner',   form.systemOwner || '—'],
                ['Classification', form.classification],
                ['Access Type',    form.accessType === 'privileged' ? `PRIVILEGED — ${form.privilegedAccessType}` : 'STANDARD'],
                ['Purpose',        form.purposeOfAccess],
              ]},
              { title: 'TRAINING', rows: [
                ['Annual IA Training',       form.annualTrainingDate || '—'],
                ['Derivative Class. Training', form.derivativeTrainingDate || '—'],
              ]},
              { title: 'AGREEMENT', rows: [
                ['User Agreement Signed', form.agreementSigned ? '✓ YES — Electronic Signature Applied' : '✗ NOT SIGNED'],
              ]},
            ].map(({ title, rows }) => (
              <div key={title} style={{ marginBottom: '1.25rem', border: '1px solid var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ background: 'rgba(255,69,0,0.08)', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--orange)', fontSize: '0.72rem', letterSpacing: '0.15em' }}>{title}</span>
                </div>
                {rows.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', padding: '0.55rem 1rem', borderBottom: '1px solid rgba(255,69,0,0.08)', gap: '1rem' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem', minWidth: '160px', flexShrink: 0 }}>{k}</span>
                    <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
            {submitError && (
              <div style={{ background: 'rgba(139,0,0,0.15)', border: '1px solid rgba(139,0,0,0.4)', color: '#ff6666', padding: '0.75rem', borderRadius: '3px', marginTop: '1rem', fontSize: '0.8rem' }}>
                ⚠ {submitError}
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '1rem' }}>
        {step > 0 ? (
          <button onClick={prev} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '0.75rem 1.75rem', cursor: 'pointer', borderRadius: '3px', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
            ← PREVIOUS
          </button>
        ) : <div />}
        {step < STEPS.length - 1 ? (
          <button onClick={next} style={{ background: 'var(--orange)', border: 'none', color: '#0B0505', padding: '0.75rem 2rem', cursor: 'pointer', borderRadius: '3px', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.12em', boxShadow: '0 0 15px rgba(255,69,0,0.3)' }}>
            NEXT →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} style={{ background: submitting ? 'var(--red)' : 'var(--orange)', border: 'none', color: '#0B0505', padding: '0.75rem 2.5rem', cursor: submitting ? 'not-allowed' : 'pointer', borderRadius: '3px', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '0.15em', boxShadow: '0 0 20px rgba(255,69,0,0.4)' }}>
            {submitting ? 'SUBMITTING...' : 'SUBMIT SAAR'}
          </button>
        )}
      </div>
    </div>
  );
}
