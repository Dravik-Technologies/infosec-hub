import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const teamMembers = [
  { name: 'Mark Brahler',   role: 'LAVA CISO',       clearance: 'TS/SCI', bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin interdum libero vitae nisi suscipit, vel dictum est blandit.' },
  { name: 'Nick Hertzberg',     role: 'LAVA ISSM',      clearance: 'TS/SCI', bio: 'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum volutpat.' },
  { name: 'Chris Cooper',   role: 'LAVA ISSE',   clearance: 'Secret', bio: 'Fusce vehicula bibendum ante, non vestibulum libero sodales a. Donec pretium nisl ut lectus blandit congue.' },
  { name: 'Syadali Shah',     role: 'LAVA ISSO',   clearance: 'Secret', bio: 'Nulla facilisi. Cras suscipit lacus nec volutpat hendrerit. Nam quis augue in erat venenatis tincidunt.' },
  { name: 'Chris Macabugao',   role: 'LAVA ISSM',   clearance: 'Secret', bio: 'Quisque at justo sed nunc porttitor auctor in at felis. Integer facilisis quam id libero vehicula congue.' },
];

const Card = ({ children, style = {} }) => (
  <div style={{
    background:   'var(--bg-card)',
    border:       '1px solid var(--border)',
    boxShadow:    'var(--glow)',
    borderRadius: '4px',
    ...style,
  }}>
    {children}
  </div>
);

export default function Landing() {
  const { user, isVulcan } = useAuth();

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{
        background:  'linear-gradient(160deg, #0B0505 0%, #1a0404 40%, #0B0505 100%)',
        borderBottom: '1px solid var(--border)',
        padding:     '5rem 1.5rem 4rem',
        textAlign:   'center',
        position:    'relative',
        overflow:    'hidden',
      }}>
        {/* Decorative glow orbs */}
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(139,0,0,0.08)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,69,0,0.06)', filter: 'blur(60px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ color: 'var(--orange)', letterSpacing: '0.4em', fontSize: '0.75rem', marginBottom: '1rem' }}>
            PRIVATE NETWORK ACCESS SYSTEM
          </p>
          <h1 style={{
            fontSize:      'clamp(2.5rem, 6vw, 4.5rem)',
            letterSpacing: '0.25em',
            lineHeight:    1.1,
            marginBottom:  '1.25rem',
            textShadow:    '0 0 40px rgba(255,69,0,0.35), 0 0 80px rgba(139,0,0,0.2)',
          }}>
            <span style={{ color: 'var(--orange)' }}>LAVA</span>{' '}
            <span style={{ color: 'var(--text)' }}>NETWORK</span>{' '}
            <span style={{ color: 'var(--red)', textShadow: '0 0 30px rgba(139,0,0,0.5)' }}>SYSTEM</span>
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            LAYERED ACCESS &amp; VERIFIED AUTHENTICATION
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', opacity: 0.7, marginBottom: '2.5rem', letterSpacing: '0.08em' }}>
            Onboarding Portal &mdash; System Access Authorization &amp; Resource Requests
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/apply" style={{
              background:    'var(--orange)',
              color:         '#0B0505',
              padding:       '0.85rem 2.2rem',
              borderRadius:  '3px',
              fontSize:      '0.85rem',
              letterSpacing: '0.15em',
              fontWeight:    'bold',
              textDecoration: 'none',
              boxShadow:     '0 0 20px rgba(255,69,0,0.4)',
            }}>
              REQUEST ACCESS
            </Link>
            {!user && (
              <Link to="/login" style={{
                background:    'transparent',
                color:         'var(--text)',
                padding:       '0.85rem 2.2rem',
                borderRadius:  '3px',
                fontSize:      '0.85rem',
                letterSpacing: '0.15em',
                border:        '1px solid var(--border)',
                textDecoration: 'none',
              }}>
                VULCAN LOGIN
              </Link>
            )}
            {isVulcan && (
              <Link to="/vulcan" style={{
                background:    'var(--red)',
                color:         'var(--text)',
                padding:       '0.85rem 2.2rem',
                borderRadius:  '3px',
                fontSize:      '0.85rem',
                letterSpacing: '0.15em',
                border:        '1px solid var(--orange)',
                textDecoration: 'none',
                boxShadow:     '0 0 15px rgba(139,0,0,0.4)',
              }}>
                VULCAN COMMAND
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '1.25rem 1.5rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { label: 'CLASSIFICATION', value: 'UNCLASSIFIED' },
            { label: 'NETWORK DOMAIN', value: 'MTSI WAN' },
            { label: 'AUTH STANDARD',  value: 'DOD 8140 / SAAR' },
            { label: 'MFA REQUIRED',   value: 'YUBIKEY' },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.18em' }}>{label}</div>
              <div style={{ color: 'var(--orange)', letterSpacing: '0.1em', fontSize: '0.85rem', marginTop: '0.2rem' }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What is LAVA ── */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
            <p style={{ color: 'var(--orange)', letterSpacing: '0.3em', fontSize: '0.7rem' }}>// SYSTEM OVERVIEW</p>
            <h2 style={{ fontSize: '1.6rem', letterSpacing: '0.15em', marginTop: '0.4rem' }}>WHAT IS <span style={{ color: 'var(--orange)' }}>LAVA</span>?</h2>
          </div>
          <Card style={{ padding: '1.75rem' }}>
            <h3 style={{ color: 'var(--orange)', letterSpacing: '0.12em', fontSize: '0.9rem', marginBottom: '1rem' }}>MISSION</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: '0.85rem' }}>
              "LAVA (Linked Automated Virtual Architecture) serves as the molten core 
              of our nationwide collaboration, forging a seamless network path that 
              connects disparate sites into a unified engineering powerhouse. Our 
              mission is to dissolve geographical barriers, enabling real-time data 
              sharing and cross-functional synergy at the speed of heat."
            </p>
          </Card>
          <Card style={{ padding: '1.75rem' }}>
            <h3 style={{ color: 'var(--orange)', letterSpacing: '0.12em', fontSize: '0.9rem', marginBottom: '1rem' }}>CAPABILITIES</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: '0.85rem' }}>
              "Built for high-intensity engineering, LAVA provides a high-fidelity environment 
              for complex simulations, stress testing, and collaborative modeling. It serves as 
              our primary incubation chamber—a dedicated sandbox where developers can conceive, 
              build, and torture-test mission-critical applications before they are hardened for 
              the LAVA Network."
            </p>
          </Card>
          <Card style={{ padding: '1.75rem' }}>
            <h3 style={{ color: 'var(--orange)', letterSpacing: '0.12em', fontSize: '0.9rem', marginBottom: '1rem' }}>COMPLIANCE</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: '0.85rem' }}>
              "Total network integrity is enforced by the LAVA Vulcans through a rigid, automated 
              governance pipeline. Every connection is governed by digitized DD Form 2875 standards, 
              ensuring that access is granted only to validated personnel who meet strict training, 
              security, and privileged-access prerequisites."
            </p>
          </Card>
        </div>
      </section>

      {/* ── Access Process ── */}
      <section style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <p style={{ color: 'var(--orange)', letterSpacing: '0.3em', fontSize: '0.7rem', marginBottom: '0.4rem' }}>// ONBOARDING WORKFLOW</p>
          <h2 style={{ fontSize: '1.4rem', letterSpacing: '0.15em', marginBottom: '2.5rem' }}>ACCESS REQUEST <span style={{ color: 'var(--orange)' }}>PROCESS</span></h2>
          <div style={{ display: 'flex', gap: '0', flexWrap: 'wrap' }}>
            {[
              { step: '01', label: 'SUBMIT SAAR',       desc: 'Complete DD Form 2875 digital equivalent with training certifications.' },
              { step: '02', label: 'VULCAN REVIEW',     desc: 'Designated Vulcan administrators review and adjudicate your request.' },
              { step: '03', label: 'APPROVAL & BRIEF',  desc: 'Upon approval, complete system-specific security briefing.' },
              { step: '04', label: 'TOKEN HAND-OFF',    desc: 'Receive YubiKey; Vulcan records serial number.' },
              { step: '05', label: 'PROVISIONED',       desc: 'Account activated and access granted to authorized systems.' },
            ].map(({ step, label, desc }, i) => (
              <div key={step} style={{ flex: '1', minWidth: '160px', padding: '1.5rem', borderLeft: i === 0 ? 'none' : '1px solid var(--border)', position: 'relative' }}>
                <div style={{ fontSize: '2rem', color: 'var(--red)', opacity: 0.5, lineHeight: 1, marginBottom: '0.5rem' }}>{step}</div>
                <div style={{ color: 'var(--orange)', fontSize: '0.75rem', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>{label}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Meet the Team ── */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '4rem 1.5rem' }}>
        <p style={{ color: 'var(--orange)', letterSpacing: '0.3em', fontSize: '0.7rem', marginBottom: '0.4rem' }}>// PERSONNEL</p>
        <h2 style={{ fontSize: '1.4rem', letterSpacing: '0.15em', marginBottom: '2.5rem' }}>MEET THE <span style={{ color: 'var(--orange)' }}>TEAM</span></h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {teamMembers.map((member) => (
            <Card key={member.name} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '3px',
                  background: 'linear-gradient(135deg, var(--red), var(--orange))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', flexShrink: 0,
                  boxShadow: '0 0 12px rgba(255,69,0,0.3)',
                }}>
                  ◈
                </div>
                <div>
                  <div style={{ color: 'var(--text)', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '0.05em' }}>{member.name}</div>
                  <div style={{ color: 'var(--orange)', fontSize: '0.72rem', letterSpacing: '0.08em', marginTop: '0.15rem' }}>{member.role}</div>
                  <div style={{ fontSize: '0.65rem', marginTop: '0.2rem', padding: '0.1rem 0.4rem', background: 'rgba(139,0,0,0.2)', border: '1px solid rgba(139,0,0,0.3)', display: 'inline-block', letterSpacing: '0.06em', color: '#cc4444' }}>{member.clearance}</div>
                </div>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.7 }}>{member.bio}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: 'linear-gradient(135deg, #130808, #1a0404)', borderTop: '1px solid var(--border)', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.3rem', letterSpacing: '0.2em', marginBottom: '0.75rem' }}>
          READY TO <span style={{ color: 'var(--orange)' }}>JOIN</span> THE NETWORK?
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1.75rem', fontSize: '0.85rem' }}>
          Submit your System Access Authorization Request to begin the onboarding process.
        </p>
        <Link to="/apply" style={{
          background: 'var(--orange)', color: '#0B0505', padding: '1rem 2.5rem',
          borderRadius: '3px', fontSize: '0.85rem', letterSpacing: '0.2em',
          fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 0 25px rgba(255,69,0,0.45)',
        }}>
          SUBMIT SAAR &rarr;
        </Link>
      </section>
    </div>
  );
}
