import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import lavaBackdrop from '../assets/lava-backdrop.png';

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
      {/* ── Hero — Asymmetric 70/30 Split ── */}
      <>
        <style>{`
          .lava-hero { display: grid; grid-template-columns: 1fr 1fr; min-height: 540px; border-bottom: 1px solid var(--border); overflow: hidden; }
          .lava-hero-image { min-height: 300px; }
          @media (max-width: 768px) {
            .lava-hero { grid-template-columns: 1fr; }
            .lava-hero-image { min-height: 260px; order: -1; }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 18px rgba(255,69,0,0.45); }
            50%       { box-shadow: 0 0 40px rgba(255,69,0,0.85), 0 0 70px rgba(255,69,0,0.3); }
          }
          .lava-cta { animation: pulse-glow 2.4s ease-in-out infinite; }
        `}</style>

        <section className="lava-hero">

          {/* ── Left Column — Obsidian content zone ── */}
          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0,   opacity: 1 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            style={{
              background:     '#0B0505',
              padding:        'clamp(3rem, 5vw, 5rem) clamp(2rem, 5vw, 4rem) clamp(3rem, 5vw, 5rem) clamp(1.5rem, 4vw, 3.5rem)',
              display:        'flex',
              flexDirection:  'column',
              justifyContent: 'center',
              position:       'relative',
            }}
          >
            {/* Smoke-and-shadow blend into image column */}
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '120px', background: 'linear-gradient(to right, transparent, #0B0505)', pointerEvents: 'none', zIndex: 2 }} />

            <div style={{ position: 'relative', zIndex: 3, maxWidth: '600px' }}>
              <motion.p
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}
                style={{ color: 'var(--orange)', letterSpacing: '0.38em', fontSize: '0.68rem', marginBottom: '1.1rem' }}
              >
                PRIVATE NETWORK ACCESS SYSTEM
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', letterSpacing: '0.06em', lineHeight: 1.25, marginBottom: '1.75rem', color: 'var(--text)' }}
              >
                LAVA:{' '}
                <span style={{ color: 'var(--orange)' }}>THE MOLTEN CORE</span>
                <br />OF NATIONWIDE COLLABORATION
              </motion.h1>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}
                style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}
              >
                <Link
                  to="/apply"
                  className="lava-cta"
                  style={{
                    background:     'var(--orange)',
                    color:          '#0B0505',
                    padding:        '0.9rem 2rem',
                    borderRadius:   '3px',
                    fontSize:       '0.82rem',
                    letterSpacing:  '0.18em',
                    fontWeight:     'bold',
                    textDecoration: 'none',
                    display:        'inline-block',
                  }}
                >
                  REQUEST LAVA ACCESS
                </Link>
                {isVulcan && (
                  <Link to="/vulcan" style={{
                    background:     'transparent',
                    color:          'var(--orange)',
                    padding:        '0.9rem 1.75rem',
                    borderRadius:   '3px',
                    fontSize:       '0.82rem',
                    letterSpacing:  '0.15em',
                    border:         '1px solid rgba(255,69,0,0.4)',
                    textDecoration: 'none',
                  }}>
                    VULCAN COMMAND →
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* ── Right Column — Lava Vulcans image ── */}
          <motion.div
            className="lava-hero-image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
            style={{
              backgroundImage:    `url(${lavaBackdrop})`,
              backgroundSize:     'cover',
              backgroundPosition: 'center',
              position:           'relative',
            }}
          >
            {/* Left-edge smoke blend into obsidian */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '160px', background: 'linear-gradient(to right, #0B0505, transparent)', pointerEvents: 'none' }} />
            {/* Bottom fade */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60px', background: 'linear-gradient(to bottom, transparent, #0B0505)', pointerEvents: 'none' }} />
          </motion.div>

        </section>
      </>

      {/* ── Sites Strip ── */}
      <section style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '1.25rem 1.5rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '0', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', paddingRight: '2rem', marginRight: '2rem', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
            LAVA SITES
          </div>
          {[
            { code: 'ALX', name: 'MTSI Alexandria, VA' },
            { code: 'STL', name: 'MTSI St. Louis, MO' },
            { code: 'CO',  name: 'MTSI Colorado Springs, CO' },
            { code: 'DAY', name: 'MTSI Dayton, OH' },
            { code: 'HSV', name: 'MTSI Huntsville, AL' },
            { code: 'LV',  name: 'MTSI Las Vegas, NV' },
          ].map(({ code, name }, i, arr) => (
            <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingRight: i < arr.length - 1 ? '2rem' : 0, marginRight: i < arr.length - 1 ? '2rem' : 0, borderRight: i < arr.length - 1 ? '1px solid rgba(255,69,0,0.15)' : 'none' }}>
              <span style={{ color: 'var(--orange)', fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.15em' }}>{code}</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.65rem', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{name}</span>
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
