import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import lavaLogo from '../assets/lava-logo.png';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/vulcan');
    } catch (err) {
      setError(err?.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width:         '100%',
    background:    'var(--bg-input)',
    border:        '1px solid var(--border)',
    color:         'var(--text)',
    padding:       '0.75rem 1rem',
    fontSize:      '0.85rem',
    borderRadius:  '3px',
    outline:       'none',
    letterSpacing: '0.05em',
  };

  const labelStyle = {
    display:       'block',
    color:         'var(--muted)',
    fontSize:      '0.7rem',
    letterSpacing: '0.15em',
    marginBottom:  '0.4rem',
  };

  return (
    <div style={{
      minHeight:      'calc(100vh - 56px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '2rem',
      position:       'relative',
    }}>

      {/* Login card */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '420px', zIndex: 1 }}>

        {/* Branding above card */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src={lavaLogo}
            alt="LAVA"
            style={{
              height:     '64px',
              width:      '64px',
              objectFit:  'contain',
              marginBottom: '1rem',
              filter:     'drop-shadow(0 0 16px rgba(255,69,0,0.7))',
            }}
          />
          <h1 style={{ color: 'var(--orange)', letterSpacing: '0.3em', fontSize: '1.2rem', textShadow: '0 0 20px rgba(255,69,0,0.6)' }}>
            VULCAN COMMAND
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.72rem', letterSpacing: '0.18em', marginTop: '0.4rem' }}>
            CONTROLLED HEAT. CONTROLLED ACCESS.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background:   'var(--bg-card)',
          border:       '1px solid var(--border)',
          boxShadow:    'var(--glow)',
          borderRadius: '4px',
          padding:      '2rem',
        }}>
          {error && (
            <div style={{
              background:    'rgba(139,0,0,0.2)',
              border:        '1px solid rgba(139,0,0,0.5)',
              color:         '#ff6666',
              padding:       '0.75rem 1rem',
              borderRadius:  '3px',
              marginBottom:  '1.25rem',
              fontSize:      '0.8rem',
              letterSpacing: '0.05em',
            }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>USERNAME</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="username"
                autoComplete="username"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>PASSWORD</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="current-password"
                style={inputStyle}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width:         '100%',
                background:    loading ? 'var(--red)' : 'var(--orange)',
                color:         '#0B0505',
                border:        'none',
                padding:       '0.9rem',
                fontSize:      '0.85rem',
                fontWeight:    'bold',
                letterSpacing: '0.25em',
                borderRadius:  '3px',
                cursor:        loading ? 'not-allowed' : 'pointer',
                boxShadow:     '0 0 25px rgba(255,69,0,0.4)',
                transition:    'all 0.15s',
              }}
            >
              {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid rgba(255,69,0,0.15)', paddingTop: '1.25rem' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
              Not a Vulcan administrator?{' '}
              <Link to="/apply" style={{ color: 'var(--orange)' }}>Request access here</Link>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(155,138,134,0.5)', fontSize: '0.62rem', marginTop: '1.25rem', letterSpacing: '0.12em' }}>
          UNAUTHORIZED ACCESS IS A VIOLATION OF 18 U.S.C. § 1030
        </p>
      </div>
    </div>
  );
}
