import { motion } from 'framer-motion';

function Confetti() {
  const colors = ['#c4a052', '#f0c070', '#22c55e', '#3b82f6', '#a78bfa', '#f472b6'];
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', overflow: 'hidden', pointerEvents: 'none', height: '80px' }}>
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${10 + (i / 16) * 80}%`,
            top: '-10px',
            width: i % 2 === 0 ? '8px' : '6px',
            height: i % 2 === 0 ? '8px' : '12px',
            borderRadius: i % 3 === 0 ? '50%' : '2px',
            background: colors[i % colors.length],
            animation: `confettiFall ${0.8 + (i % 4) * 0.2}s ease-in ${(i % 5) * 0.1}s both`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

export default function WelcomeModal({ onClose }) {
  const features = [
    'Suivez toutes vos candidatures en un seul endroit',
    'Obtenez des conseils IA personnalisés à chaque étape',
    "Capturez des offres en 1 clic avec l'extension Chrome",
  ];
  const stats = [
    { value: '200+', label: 'candidatures / mois' },
    { value: '50+', label: 'entreprises trackées' },
    { value: '3', label: 'modèles IA' },
  ];

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
          50% { opacity: .7; transform: scale(1.3) rotate(15deg); }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)', padding: '16px',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={{
            background: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px', padding: '36px 32px',
            maxWidth: '420px', width: '100%',
            position: 'relative', overflow: 'hidden',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: '#f8fafc',
          }}
        >
          <Confetti />

          {/* Close button */}
          <button
            onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.color = '#f8fafc'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', width: '32px', height: '32px',
              color: '#94a3b8', fontSize: '18px', cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center',
              justifyContent: 'center', transition: 'all 0.15s',
            }}
          >
            ×
          </button>

          {/* Sparkle */}
          <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '10px' }}>
            <div style={{ fontSize: '40px', animation: 'sparkle 2s ease-in-out infinite', display: 'inline-block' }}>
              ✨
            </div>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: '800', textAlign: 'center', marginBottom: '10px' }}>
            Bienvenue dans{' '}
            <span style={{
              background: 'linear-gradient(135deg,#c4a052,#f0c070,#c4a052)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              JobTracker
            </span>{' '}! 🎉
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', lineHeight: '1.6', marginBottom: '24px' }}>
            Votre espace de recherche d'emploi est prêt. Voici ce que vous pouvez faire dès maintenant :
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
                style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}
              >
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'rgba(34,197,94,0.12)',
                  border: '1.5px solid rgba(34,197,94,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '1px',
                }}>
                  <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: '700' }}>✓</span>
                </div>
                <span style={{ fontSize: '14px', color: '#f8fafc', lineHeight: '1.5', fontWeight: '500' }}>{f}</span>
              </motion.div>
            ))}
          </div>

          {/* Stats strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px',
            background: 'rgba(15,23,42,0.8)', borderRadius: '14px',
            padding: '14px 8px', marginBottom: '24px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: '700', color: '#c4a052', lineHeight: '1' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.3' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(196,160,82,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            style={{
              width: '100%', padding: '14px 24px', borderRadius: '12px',
              background: 'linear-gradient(135deg,#c4a052,#d4b472)',
              border: 'none', color: '#020817', fontFamily: 'inherit',
              fontSize: '15px', fontWeight: '600', cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s', letterSpacing: '0.01em',
            }}
          >
            Commencer ma recherche d'emploi →
          </button>
        </motion.div>
      </motion.div>
    </>
  );
}
