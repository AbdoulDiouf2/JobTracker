import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAuth } from '../contexts/AuthContext';
import WelcomeModal from '../components/WelcomeModal';

/* ─── Design tokens (inline styles pour coller pixel-perfect au design) ─── */
const css = {
  bg: '#020817',
  surface: '#0f172a',
  surface2: '#1e293b',
  border: 'rgba(255,255,255,0.08)',
  gold: '#c4a052',
  goldLight: '#d4b472',
  goldDim: 'rgba(196,160,82,0.15)',
  text: '#f8fafc',
  muted: '#94a3b8',
  success: '#22c55e',
  successDim: 'rgba(34,197,94,0.12)',
};

/* ─── Primitives ─── */
function GoldButton({ children, onClick, disabled, outline, style }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '14px 24px', borderRadius: '12px',
        fontFamily: 'inherit', fontSize: '15px', fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: outline ? `1.5px solid ${css.gold}` : 'none',
        background: outline
          ? 'transparent'
          : disabled
            ? 'rgba(196,160,82,0.3)'
            : 'linear-gradient(135deg,#c4a052,#d4b472)',
        color: outline ? css.gold : disabled ? 'rgba(248,250,252,0.4)' : '#020817',
        transition: 'transform 0.15s, box-shadow 0.15s',
        transform: hov && !disabled ? 'scale(1.02)' : 'scale(1)',
        boxShadow: hov && !disabled && !outline ? '0 8px 25px rgba(196,160,82,0.35)' : 'none',
        opacity: disabled ? 0.6 : 1,
        letterSpacing: '0.01em',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, style }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'transparent',
        border: '1.5px solid rgba(255,255,255,0.12)',
        color: hov ? css.text : css.muted,
        borderRadius: '12px', padding: '12px 20px',
        fontFamily: 'inherit', fontSize: '14px', fontWeight: '500',
        cursor: 'pointer', transition: 'all 0.15s', width: '100%', ...style,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ label, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '8px 16px', borderRadius: '999px',
        fontFamily: 'inherit', fontSize: '13px', fontWeight: '500',
        cursor: 'pointer', transition: 'all 0.15s',
        border: active ? `1.5px solid ${css.gold}` : '1.5px solid rgba(255,255,255,0.1)',
        background: active ? css.goldDim : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? css.gold : hov ? css.text : css.muted,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function TextInput({ placeholder, value, onChange, style }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={e => (e.target.style.borderColor = 'rgba(196,160,82,0.5)')}
      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
      style={{
        width: '100%', padding: '12px 16px',
        background: 'rgba(30,41,59,0.6)',
        border: '1.5px solid rgba(255,255,255,0.08)',
        borderRadius: '10px', color: css.text,
        fontFamily: 'inherit', fontSize: '14px', outline: 'none',
        transition: 'border-color 0.15s', caretColor: css.gold, ...style,
      }}
    />
  );
}

/* ─── Slider avec track gold remplie ─── */
function GoalSlider({ value, onChange, min, max, step }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ position: 'relative', padding: '10px 0' }}>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: '6px', borderRadius: '3px',
          outline: 'none', cursor: 'pointer',
          WebkitAppearance: 'none', appearance: 'none',
          background: `linear-gradient(90deg, #c4a052 0%, #d4b472 ${pct}%, rgba(30,41,59,0.9) ${pct}%, rgba(30,41,59,0.9) 100%)`,
        }}
      />
    </div>
  );
}

/* ─── Step 1: Objectif mensuel ─── */
function Step1({ onNext, firstName }) {
  const MIN = 5, MAX = 50, STEP = 5;
  const presets = [5, 10, 20, 30, 50];
  const [val, setVal] = useState(10);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  const stagger = (i) => ({ delay: 0.08 * i });

  return (
    <motion.div
      key="s1"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Accueil personnalisé */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        style={{ marginBottom: '28px' }}
      >
        <div style={{ fontSize: '13px', color: css.gold, fontWeight: '600', marginBottom: '10px', letterSpacing: '0.04em' }}>
          Bienvenue sur JobTracker
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: '800', lineHeight: '1.2', marginBottom: '12px' }}>
          {firstName ? `Bonjour, ${firstName} !` : 'Bienvenue !'}
        </h1>
        <p style={{ color: css.muted, fontSize: '15px', lineHeight: '1.7' }}>
          En quelques étapes, on va personnaliser votre espace pour que vous soyez opérationnel dès aujourd'hui.
        </p>
      </motion.div>

      {/* Séparateur */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: '1px', background: 'rgba(196,160,82,0.2)', marginBottom: '28px', transformOrigin: 'left' }}
      />

      {/* Question objectif */}
      <AnimatePresence>
        {ready && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ...stagger(0) }}
              style={{ marginBottom: '8px' }}
            >
              <span style={{ fontSize: '13px', color: css.muted, fontWeight: '500' }}>Étape 1 · Objectif</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ...stagger(1) }}
              style={{ fontSize: '22px', fontWeight: '700', lineHeight: '1.3', marginBottom: '8px' }}
            >
              Combien de candidatures<br />par mois visez-vous ?
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ...stagger(2) }}
              style={{ color: css.muted, fontSize: '14px', lineHeight: '1.6', marginBottom: '28px' }}
            >
              Définissez une cible pour rester motivé et mesurer votre progression.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ...stagger(3) }}
              style={{ textAlign: 'center', marginBottom: '24px' }}
            >
              <div style={{
                fontSize: '72px', fontWeight: '800', fontFamily: 'monospace',
                lineHeight: '1', letterSpacing: '-2px',
                background: 'linear-gradient(135deg,#c4a052,#f0c070,#c4a052)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {val}
              </div>
              <div style={{ color: css.muted, fontSize: '14px', marginTop: '6px', fontWeight: '500' }}>
                candidatures / mois
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ...stagger(4) }}
              style={{ marginBottom: '8px' }}
            >
              <GoalSlider value={val} onChange={setVal} min={MIN} max={MAX} step={STEP} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 2px' }}>
                {presets.map(p => (
                  <span key={p} style={{
                    fontSize: '11px', fontWeight: '600',
                    color: val === p ? css.gold : 'rgba(148,163,184,0.5)',
                    transition: 'color 0.2s',
                  }}>{p}</span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ...stagger(5) }}
              style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0 32px' }}
            >
              {[5, 20, 50].map(p => (
                <Pill key={p} label={String(p)} active={val === p} onClick={() => setVal(p)} />
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ...stagger(6) }}
            >
              <GoldButton onClick={() => onNext({ monthly_goal: val })}>Continuer →</GoldButton>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Step 2: Profil ─── */
function Step2({ onNext, dir }) {
  const [jobTitle, setJobTitle] = useState('');
  const [expLevel, setExpLevel] = useState('');
  const [sector, setSector] = useState('');
  const [contracts, setContracts] = useState([]);
  const [autreContrat, setAutreContrat] = useState('');

  const expLevels = ['Junior (0–2 ans)', 'Intermédiaire (2–5 ans)', 'Senior (5–10 ans)', 'Expert (10+ ans)'];
  const contractTypes = ['CDI', 'Freelance', 'Stage / Alternance'];

  const toggleContract = (c) => {
    setContracts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    if (c === 'Autre') setAutreContrat('');
  };

  return (
    <motion.div
      key="s2"
      initial={{ opacity: 0, x: dir === 'back' ? -60 : 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: dir === 'back' ? 60 : -60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: css.muted, fontWeight: '500' }}>👤 Profil</span>
      </div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.25', marginBottom: '10px' }}>
        Parlez-nous de vous
      </h1>
      <p style={{ color: css.muted, fontSize: '15px', lineHeight: '1.6', marginBottom: '30px' }}>
        Ces informations personnalisent vos recommandations IA.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
        <div>
          <label style={labelStyle}>Poste recherché</label>
          <TextInput value={jobTitle} onChange={setJobTitle} placeholder="Ex: Développeur Full-Stack, Product Manager…" />
        </div>

        <div>
          <label style={labelStyle}>Niveau d'expérience</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {expLevels.map(l => (
              <Pill key={l} label={l} active={expLevel === l} onClick={() => setExpLevel(l)} />
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>
            Secteur cible{' '}
            <span style={{ color: 'rgba(148,163,184,0.5)', fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>
              (optionnel)
            </span>
          </label>
          <TextInput value={sector} onChange={setSector} placeholder="Ex: Tech, Finance, Santé…" />
        </div>

        <div>
          <label style={labelStyle}>Type de contrat</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: contracts.includes('Autre') ? '10px' : '0' }}>
            {[...contractTypes, 'Autre'].map(c => (
              <Pill key={c} label={c} active={contracts.includes(c)} onClick={() => toggleContract(c)} />
            ))}
          </div>
          <AnimatePresence>
            {contracts.includes('Autre') && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <TextInput
                  value={autreContrat}
                  onChange={setAutreContrat}
                  placeholder="Précisez le type de contrat…"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <GoldButton
        disabled={!jobTitle.trim()}
        onClick={() => onNext({
          job_title: jobTitle,
          experience_level: expLevel,
          sector,
          contract_types: contracts.map(c => c === 'Autre' && autreContrat ? autreContrat : c),
        })}
      >
        Continuer →
      </GoldButton>
    </motion.div>
  );
}

/* ─── Step 3: Extension Chrome ─── */
function Step3({ onNext, onSkip, dir, extensionConnected }) {
  return (
    <motion.div
      key="s3"
      initial={{ opacity: 0, x: dir === 'back' ? -60 : 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: dir === 'back' ? 60 : -60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: css.muted, fontWeight: '500' }}>🧩 Extension</span>
      </div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.25', marginBottom: '10px' }}>
        {extensionConnected ? 'Extension déjà connectée !' : 'Installez l\'extension Chrome'}
      </h1>
      <p style={{ color: css.muted, fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
        {extensionConnected
          ? 'Votre extension JobTracker est déjà connectée et prête à capturer des offres.'
          : 'Capturez une offre d\'emploi en 1 clic depuis n\'importe quel site.'}
      </p>

      <div style={{
        background: extensionConnected ? 'rgba(34,197,94,0.06)' : 'rgba(15,23,42,0.85)',
        border: extensionConnected ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)', borderRadius: '20px', padding: '32px 24px',
        textAlign: 'center', marginBottom: '16px',
      }}>
        <div style={{ display: 'inline-block', marginBottom: '16px', filter: `drop-shadow(0 4px 20px ${extensionConnected ? 'rgba(34,197,94,0.3)' : 'rgba(66,133,244,0.3)'})` }}>
          <svg width="72" height="72" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
            <path d="M128 28 A100 100 0 0 1 214.6 178 L171.3 153 A50 50 0 0 0 128 78 Z" fill="#EA4335" />
            <path d="M214.6 178 A100 100 0 0 1 41.4 178 L84.7 153 A50 50 0 0 0 171.3 153 Z" fill="#FBBC04" />
            <path d="M41.4 178 A100 100 0 0 1 128 28 L128 78 A50 50 0 0 0 84.7 153 Z" fill="#34A853" />
            <circle cx="128" cy="128" r="57" fill="white" />
            <circle cx="128" cy="128" r="46" fill="#4285F4" />
          </svg>
        </div>

        {extensionConnected ? (
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '20px', padding: '6px 14px', marginBottom: '12px',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: css.success }} />
              <span style={{ fontSize: '13px', color: css.success, fontWeight: '600' }}>Connectée</span>
            </div>
            <div style={{ fontWeight: '700', fontSize: '17px', marginBottom: '6px' }}>JobTracker for Chrome</div>
            <div style={{ color: css.muted, fontSize: '13px' }}>Prête à capturer vos offres d'emploi</div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: '700', fontSize: '17px', marginBottom: '6px' }}>JobTracker for Chrome</div>
            <div style={{ color: css.muted, fontSize: '13px', marginBottom: '20px' }}>Disponible sur le Chrome Web Store</div>
            <div style={{ display: 'inline-block', width: '100%', maxWidth: '240px' }}>
              <GoldButton
                outline
                onClick={() => window.open('https://chromewebstore.google.com/detail/jobtracker-clipper/ephlbjlapgadbjjpongcmniokflciidl', '_blank')}
                style={{ padding: '11px 24px', fontSize: '14px' }}
              >
                Installer l'extension
              </GoldButton>
            </div>
          </div>
        )}
      </div>

      {!extensionConnected && (
        <div style={{
          background: 'rgba(196,160,82,0.06)', border: '1px solid rgba(196,160,82,0.12)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '24px',
          display: 'flex', gap: '10px', alignItems: 'center',
        }}>
          <span style={{ fontSize: '18px' }}>⚡</span>
          <p style={{ fontSize: '13px', color: css.muted, lineHeight: '1.5' }}>
            Repérez une offre sur LinkedIn, Indeed ou autre ? Cliquez sur l'extension pour l'ajouter instantanément à votre tracker.
          </p>
        </div>
      )}

      {extensionConnected ? (
        <GoldButton onClick={() => onNext({ installed: true })}>Continuer →</GoldButton>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <GoldButton
            onClick={() => onNext({ installed: true })}
            style={{
              background: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.1))',
              color: css.success, border: '1.5px solid rgba(34,197,94,0.3)',
            }}
          >
            ✓ J'ai installé
          </GoldButton>
          <GhostButton onClick={onSkip}>Passer</GhostButton>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Step 4: Première candidature ─── */
function Step4({ onFinish, onSkip, dir }) {
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [status, setStatus] = useState('Envoyée');
  const [url, setUrl] = useState('');
  const statuses = ['Envoyée', 'En cours', 'Entretien planifié'];
  const canFinish = company.trim() && jobTitle.trim();

  return (
    <motion.div
      key="s4"
      initial={{ opacity: 0, x: dir === 'back' ? -60 : 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: dir === 'back' ? 60 : -60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: css.muted, fontWeight: '500' }}>📋 Candidature</span>
      </div>
      <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.25', marginBottom: '10px' }}>
        Ajoutez votre première<br />candidature
      </h1>
      <p style={{ color: css.muted, fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
        Commencez à suivre vos candidatures pour ne plus jamais rien oublier.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
        <div>
          <label style={labelStyle}>Entreprise</label>
          <TextInput value={company} onChange={setCompany} placeholder="Ex: Google, Startup XYZ…" />
        </div>
        <div>
          <label style={labelStyle}>Poste</label>
          <TextInput value={jobTitle} onChange={setJobTitle} placeholder="Ex: Développeur React" />
        </div>
        <div>
          <label style={labelStyle}>Statut</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {statuses.map(s => (
              <Pill key={s} label={s} active={status === s} onClick={() => setStatus(s)} />
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>
            Lien de l'offre{' '}
            <span style={{ color: 'rgba(148,163,184,0.5)', fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>
              (optionnel)
            </span>
          </label>
          <TextInput value={url} onChange={setUrl} placeholder="https://…" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <GoldButton
          disabled={!canFinish}
          onClick={() => onFinish({ company, job_title: jobTitle, status, url })}
        >
          Terminer et accéder au tableau de bord →
        </GoldButton>
        <button
          onClick={onSkip}
          style={{
            background: 'transparent', border: 'none', color: css.muted,
            fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
            padding: '6px', textDecoration: 'underline', textDecorationColor: 'rgba(148,163,184,0.4)',
            textUnderlineOffset: '3px', fontWeight: '500',
          }}
        >
          Passer et accéder au tableau de bord
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Save & Leave Modal ─── */
function SaveLeaveModal({ step, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '16px',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        style={{
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)', borderRadius: '20px', padding: '32px 28px',
          maxWidth: '380px', width: '100%', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>💾</div>
        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Sauvegarder et partir ?</h3>
        <p style={{ color: css.muted, fontSize: '14px', lineHeight: '1.6', marginBottom: '8px' }}>
          Votre progression est sauvegardée. Vous reprendrez à l'<strong style={{ color: css.text }}>étape {step}</strong> lors de votre prochaine connexion.
        </p>
        <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '12px', marginBottom: '28px' }}>
          Vous pouvez revenir à tout moment pour compléter l'onboarding.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <GoldButton
            onClick={onConfirm}
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1.5px solid rgba(239,68,68,0.25)' }}
          >
            Se déconnecter
          </GoldButton>
          <GhostButton onClick={onCancel}>Continuer l'onboarding</GhostButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Progress Bar ─── */
function ProgressBar({ step, total }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40 }}>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg,#c4a052,#f0c070)',
            boxShadow: '0 0 10px rgba(196,160,82,0.5)',
          }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

/* ─── Label style ─── */
const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: 'rgba(148,163,184,0.8)', marginBottom: '8px',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

/* ─── Main OnboardingPage ─── */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { completeStep, completeWizard } = useOnboarding();
  const { logout, user } = useAuth();

  const [step, setStep] = useState(() => {
    const steps = user?.onboarding_steps || {};
    const order = ['goal', 'profile', 'extension', 'first_application'];
    for (let i = 0; i < order.length; i++) {
      const s = steps[order[i]];
      if (!s?.completed && !s?.skipped) return i + 1;
    }
    return 1;
  });
  const [dir, setDir] = useState('fwd');
  const [showModal, setShowModal] = useState(false);
  const [showSaveLeave, setShowSaveLeave] = useState(false);
  const totalSteps = 4;

  const goNext = async (stepKey, data = {}, skipped = false) => {
    try {
      await completeStep(stepKey, data, skipped);
    } catch {
      // ne pas bloquer la navigation si l'API échoue
    }
    setDir('fwd');
    if (step < totalSteps) setStep(s => s + 1);
  };

  const goBack = () => {
    setDir('back');
    setStep(s => s - 1);
  };

  const handleFinish = async (data) => {
    try {
      await completeStep('first_application', data, false);
      await completeWizard();
    } catch {
      // continuer quand même
    }
    setShowModal(true);
  };

  const handleSkipFinal = async () => {
    try {
      await completeStep('first_application', {}, true);
      await completeWizard();
    } catch {
      // continuer quand même
    }
    setShowModal(true);
  };

  const handleModalClose = async () => {
    setShowModal(false);
    navigate('/dashboard');
  };

  const handleSaveLeaveConfirm = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: css.bg, color: css.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Grain overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        opacity: 0.4,
      }} />

      <ProgressBar step={step} total={totalSteps} />

      {/* Top bar */}
      <div style={{
        position: 'fixed', top: '3px', left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
      }}>
        {/* Logo + bouton déconnexion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: 'linear-gradient(135deg,#c4a052,#d4b472)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#020817', fontSize: '14px', fontWeight: '800' }}>J</span>
            </div>
            <span style={{ fontWeight: '700', fontSize: '16px', color: css.gold }}>JobTracker</span>
          </div>
          <button
            onClick={() => setShowSaveLeave(true)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = css.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = css.muted; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', padding: '5px 10px', color: css.muted,
              fontFamily: 'inherit', fontSize: '12px', fontWeight: '500',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <LogOut size={12} />
            Revenir plus tard
          </button>
        </div>

        {/* Step counter */}
        <span style={{ color: css.muted, fontSize: '13px', fontWeight: '500' }}>
          Étape {step} sur {totalSteps}
        </span>

        {/* Skip */}
        {step < totalSteps ? (
          <button
            onClick={() => {
              const keys = ['goal', 'profile', 'extension'];
              goNext(keys[step - 1], {}, true);
            }}
            onMouseEnter={e => (e.target.style.color = css.text)}
            onMouseLeave={e => (e.target.style.color = css.muted)}
            style={{
              background: 'transparent', border: 'none', color: css.muted,
              fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: '500', transition: 'color 0.15s', padding: '4px 0',
            }}
          >
            Passer cette étape →
          </button>
        ) : (
          <div style={{ width: '120px' }} />
        )}
      </div>

      {/* Content */}
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>

          {/* Back button */}
          {step > 1 && (
            <button
              onClick={goBack}
              onMouseEnter={e => (e.currentTarget.style.color = css.text)}
              onMouseLeave={e => (e.currentTarget.style.color = css.muted)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'transparent', border: 'none', color: css.muted,
                fontSize: '13px', fontFamily: 'inherit', fontWeight: '500',
                cursor: 'pointer', marginBottom: '28px', padding: 0,
                transition: 'color 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Retour
            </button>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <Step1 key="s1" dir={dir} onNext={(data) => goNext('goal', data)} firstName={user?.full_name?.trim().split(/\s+/)[0]} />
            )}
            {step === 2 && (
              <Step2 key="s2" dir={dir} onNext={(data) => goNext('profile', data)} />
            )}
            {step === 3 && (
              <Step3
                key="s3"
                dir={dir}
                onNext={(data) => goNext('extension', data)}
                onSkip={() => goNext('extension', {}, true)}
                extensionConnected={user?.extension_connected}
              />
            )}
            {step === 4 && (
              <Step4
                key="s4"
                dir={dir}
                onFinish={handleFinish}
                onSkip={handleSkipFinal}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Save & Leave Modal */}
      <AnimatePresence>
        {showSaveLeave && (
          <SaveLeaveModal
            step={step}
            onConfirm={handleSaveLeaveConfirm}
            onCancel={() => setShowSaveLeave(false)}
          />
        )}
      </AnimatePresence>

      {/* Welcome Modal */}
      <AnimatePresence>
        {showModal && <WelcomeModal onClose={handleModalClose} />}
      </AnimatePresence>
    </div>
  );
}
