import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  User, Mail, Calendar, Shield, Key, CheckCircle2, XCircle,
  Clock, Briefcase, CalendarCheck, TrendingUp, Settings,
  Chrome, LogOut, Edit2, Loader2, Check, Star, Target, Layers
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';
import { useStatistics } from '../hooks/useStatistics';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const ROLE_CONFIG = {
  admin: { label: 'Administrateur', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: Shield },
  premium: { label: 'Premium', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20', icon: Star },
  standard: { label: 'Standard', color: 'text-slate-300', bg: 'bg-slate-700/30', border: 'border-slate-600/30', icon: User },
};

const ONBOARDING_STEPS = [
  { key: 'goal', label: 'Objectif mensuel' },
  { key: 'profile', label: 'Profil / Poste' },
  { key: 'extension', label: 'Extension Chrome' },
  { key: 'first_application', label: 'Première candidature' },
];

function StatCard({ icon: Icon, value, label, color = 'text-gold' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 border border-slate-800"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color === 'text-gold' ? 'bg-gold/10' : color === 'text-blue-400' ? 'bg-blue-400/10' : 'bg-purple-400/10'}`}>
        <Icon size={20} className={color} />
      </div>
      <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
      <p className="text-slate-400 text-sm mt-0.5">{label}</p>
    </motion.div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl border border-slate-800 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
        <Icon size={18} className="text-gold" />
        <h2 className="font-heading font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const { language } = useLanguage();
  const { dashboard, fetchDashboard } = useStatistics();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    const result = await updateProfile({ full_name: fullName.trim() });
    setSaving(false);
    if (result.success) {
      toast.success('Profil mis à jour');
      setEditing(false);
    } else {
      toast.error(result.error || 'Erreur lors de la mise à jour');
    }
  };

  const role = ROLE_CONFIG[user?.role] || ROLE_CONFIG.standard;
  const RoleIcon = role.icon;

  const initials = user?.full_name
    ? user.full_name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const lastLogin = user?.last_login ? new Date(user.last_login) : null;

  const hasAnyApiKey = user?.has_google_ai_key || user?.has_openai_key || user?.has_groq_key;

  const onboardingSteps = user?.onboarding_steps || {};
  const onboardingDoneCount = ONBOARDING_STEPS.filter(
    s => onboardingSteps[s.key]?.completed || onboardingSteps[s.key]?.skipped
  ).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="profile-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Mon Profil</h1>
          <p className="text-slate-400 mt-1">Informations et activité de votre compte</p>
        </div>
        <Link to="/dashboard/settings">
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white gap-2">
            <Settings size={16} />
            Paramètres
          </Button>
        </Link>
      </div>

      {/* Avatar + identité */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl border border-slate-800 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6"
      >
        {/* Avatar */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/20 flex items-center justify-center">
            <span className="font-heading text-2xl font-bold text-gold">{initials}</span>
          </div>
          <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0a0f1a] ${role.bg}`}>
            <RoleIcon size={12} className={role.color} />
          </div>
        </div>

        {/* Nom + édition */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-3">
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="bg-slate-900/50 border-slate-700 text-white font-semibold text-lg max-w-xs"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              />
              <Button onClick={handleSave} disabled={saving} size="sm" className="bg-gold hover:bg-gold/90 text-[#020817]">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </Button>
              <Button onClick={() => { setEditing(false); setFullName(user?.full_name || ''); }} variant="ghost" size="sm" className="text-slate-400">
                Annuler
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-white truncate">{user?.full_name}</h2>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-gold hover:bg-gold/10 transition-colors"
                title="Modifier le nom"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1 text-slate-400 text-sm">
            <Mail size={14} />
            <span>{user?.email}</span>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${role.bg} ${role.color} ${role.border}`}>
              <RoleIcon size={11} />
              {role.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${user?.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${user?.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
              {user?.is_active ? 'Actif' : 'Désactivé'}
            </span>
          </div>
        </div>

        {/* Dates */}
        <div className="text-right text-xs text-slate-500 shrink-0 space-y-1.5">
          {createdAt && (
            <div className="flex items-center gap-1.5 justify-end">
              <Calendar size={12} />
              <span>Inscrit le {format(createdAt, 'dd MMM yyyy', { locale: fr })}</span>
            </div>
          )}
          {lastLogin && (
            <div className="flex items-center gap-1.5 justify-end">
              <Clock size={12} />
              <span>Connecté le {format(lastLogin, 'dd MMM yyyy à HH:mm', { locale: fr })}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats activité */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={Briefcase} value={dashboard?.total_applications} label="Candidatures" color="text-gold" />
        <StatCard icon={CalendarCheck} value={dashboard?.with_interview} label="Entretiens" color="text-blue-400" />
        <StatCard icon={TrendingUp} value={dashboard?.positive} label="Réponses positives" color="text-purple-400" />
      </div>

      {/* Clés API */}
      <Section title="Clés API" icon={Key}>
        <div className="space-y-3">
          {[
            { label: 'Google AI (Gemini)', active: user?.has_google_ai_key },
            { label: 'OpenAI', active: user?.has_openai_key },
            { label: 'Groq', active: user?.has_groq_key },
          ].map(({ label, active }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
              <span className="text-slate-300 text-sm font-medium">{label}</span>
              {active ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                  <CheckCircle2 size={12} /> Configurée
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/50 px-2.5 py-1 rounded-full">
                  <XCircle size={12} /> Non configurée
                </span>
              )}
            </div>
          ))}
          {!hasAnyApiKey && (
            <p className="text-slate-500 text-xs mt-2">
              Aucune clé API configurée.{' '}
              <Link to="/dashboard/settings" className="text-gold hover:underline">Ajouter dans les paramètres →</Link>
            </p>
          )}
        </div>
      </Section>

      {/* Profil recherché — affiché seulement si des données existent */}
      {(user?.job_title || user?.monthly_goal || user?.experience_level || user?.sector || user?.contract_types?.length) && (
        <Section title="Profil recherché" icon={Layers}>
          <div className="space-y-3">
            {user?.job_title && (
              <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <span className="text-slate-500 text-sm">Poste visé</span>
                <span className="text-slate-200 text-sm font-medium">{user.job_title}</span>
              </div>
            )}
            {user?.experience_level && (
              <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <span className="text-slate-500 text-sm">Expérience</span>
                <span className="text-slate-200 text-sm font-medium">{user.experience_level}</span>
              </div>
            )}
            {user?.sector && (
              <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <span className="text-slate-500 text-sm">Secteur</span>
                <span className="text-slate-200 text-sm font-medium">{user.sector}</span>
              </div>
            )}
            {user?.contract_types?.length > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <span className="text-slate-500 text-sm">Contrats</span>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {user.contract_types.map(c => (
                    <span key={c} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {user?.monthly_goal && (
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 text-sm">Objectif mensuel</span>
                <span className="text-gold font-bold text-sm">{user.monthly_goal} candidatures</span>
              </div>
            )}
          </div>
          <Link to="/dashboard/settings" className="text-xs text-slate-500 hover:text-gold mt-3 block">
            Modifier dans les paramètres →
          </Link>
        </Section>
      )}

      {/* Onboarding — uniquement si wizard en cours */}
      {user?.onboarding_completed === false && (
        <Section title="Onboarding en cours" icon={Clock}>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 font-medium">
              <Clock size={14} /> {onboardingDoneCount}/4 étapes complétées
            </span>
            <Link to="/onboarding">
              <Button size="sm" className="bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 text-xs">
                Reprendre →
              </Button>
            </Link>
          </div>
        </Section>
      )}

      {/* Extension Chrome */}
      <Section title="Extension Chrome" icon={Chrome}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-sm font-medium mb-1">JobTracker Clipper</p>
            {user?.extension_connected ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Connectée
              </span>
            ) : (
              <p className="text-slate-500 text-xs">Non connectée — capturez des offres en 1 clic</p>
            )}
          </div>
          <a
            href="https://chromewebstore.google.com/detail/jobtracker-clipper/ephlbjlapgadbjjpongcmniokflciidl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white gap-2">
              <Chrome size={14} />
              {user?.extension_connected ? 'Voir le store' : 'Installer'}
            </Button>
          </a>
        </div>
        {!user?.extension_connected && (
          <p className="text-slate-500 text-xs mt-3">
            Pour connecter l'extension, générez un code depuis <Link to="/dashboard/settings" className="text-gold hover:underline">les paramètres</Link>.
          </p>
        )}
      </Section>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pb-4">
        <Link to="/dashboard/settings" className="flex-1">
          <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:text-white gap-2">
            <Settings size={16} />
            Gérer les paramètres
          </Button>
        </Link>
        <Button
          onClick={logout}
          variant="outline"
          className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 gap-2"
        >
          <LogOut size={16} />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
