import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, isVulcan, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const active = (path) => location.pathname === path;

  const linkStyle = (path) => ({
    padding: '0.4rem 0.9rem',
    borderRadius: '2px',
    color: active(path) ? 'var(--bg)' : 'var(--muted)',
    background: active(path) ? 'var(--orange)' : 'transparent',
    border: active(path) ? 'none' : '1px solid transparent',
    cursor: 'pointer',
    letterSpacing: '0.08em',
    fontSize: '0.8rem',
    textDecoration: 'none',
    transition: 'all 0.15s',
  });

  return (
    <nav style={{
      background:   'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      boxShadow:    'var(--glow)',
      position:     'sticky',
      top:          0,
      zIndex:       100,
    }}>
      <div style={{
        maxWidth:      '1280px',
        margin:        '0 auto',
        padding:       '0 1.5rem',
        height:        '56px',
        display:       'flex',
        alignItems:    'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🌋</span>
          <span style={{ color: 'var(--orange)', fontWeight: 'bold', letterSpacing: '0.15em', fontSize: '1rem' }}>
            LAVA
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '0.65rem', letterSpacing: '0.12em' }}>
            NETWORK SYSTEM
          </span>
        </Link>

        {/* Nav Links */}
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <Link to="/"       style={linkStyle('/')}>HOME</Link>
          <Link to="/apply"  style={linkStyle('/apply')}>APPLY FOR ACCESS</Link>
          {user && <Link to="/systems" style={linkStyle('/systems')}>SYSTEM INTEGRATION</Link>}
          {isVulcan && <Link to="/vulcan" style={{ ...linkStyle('/vulcan'), color: active('/vulcan') ? 'var(--bg)' : 'var(--orange)', borderColor: active('/vulcan') ? 'transparent' : 'var(--border)' }}>VULCAN COMMAND</Link>}
        </div>

        {/* Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user ? (
            <>
              <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                {user.name || user.username}
                {isVulcan && <span style={{ color: 'var(--orange)', marginLeft: '0.4rem' }}>[VULCAN]</span>}
              </span>
              <button onClick={handleLogout} style={{
                background:  'transparent',
                border:      '1px solid var(--border)',
                color:       'var(--muted)',
                padding:     '0.35rem 0.75rem',
                cursor:      'pointer',
                fontSize:    '0.75rem',
                borderRadius: '2px',
                letterSpacing: '0.08em',
              }}>
                LOGOUT
              </button>
            </>
          ) : (
            <Link to="/login" style={{
              background:  'var(--red)',
              border:      '1px solid var(--orange)',
              color:       'var(--text)',
              padding:     '0.35rem 1rem',
              borderRadius: '2px',
              fontSize:    '0.78rem',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              boxShadow:   '0 0 10px rgba(139,0,0,0.4)',
            }}>
              VULCAN LOGIN
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
