import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Search, Users, Shield, ShieldCheck, ShieldX, Eye,
  Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight,
  Loader2, UserCheck, UserX, Briefcase, Calendar, Download, UserPlus,
  CheckCircle2, Clock, SkipForward, Sparkles, Key, Infinity,
  AlertTriangle, FileText, MapPin, Target, GraduationCap, Zap, Puzzle
} from 'lucide-react';
import { useAdminUsers, useAdminMutations } from '../../hooks/useAdmin';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useConfirmDialog } from '../../components/ui/confirm-dialog';

// Skeleton Animation Component
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

// Skeleton User Card
const UserCardSkeleton = () => (
  <div className="glass-card rounded-xl p-5 border border-slate-800">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded" />
    </div>
    <div className="grid grid-cols-2 gap-3 mb-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-36" />
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
      <Skeleton className="h-4 w-16" />
      <div className="flex gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  </div>
);

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrateur', icon: ShieldCheck, color: 'text-red-400 bg-red-500/20' },
  { value: 'premium', label: 'Premium', icon: Shield, color: 'text-gold bg-gold/20' },
  { value: 'standard', label: 'Standard', icon: Users, color: 'text-slate-400 bg-slate-500/20' }
];

// User Card Component
const UserCard = ({ user, onView, onEdit, onDelete, onReactivate }) => {
  const roleInfo = ROLE_OPTIONS.find(r => r.value === user.role) || ROLE_OPTIONS[2];
  const RoleIcon = roleInfo.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`glass-card rounded-xl p-5 border border-slate-800 hover:border-gold/50 transition-all ${!user.is_active ? 'opacity-60' : ''}`}
      data-testid={`user-card-${user.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-lg">
            {user.full_name[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-white">{user.full_name}</h3>
            <p className="text-slate-400 text-sm">{user.email}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${roleInfo.color}`}>
          <RoleIcon size={12} />
          {roleInfo.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Briefcase size={14} />
          <span>{user.applications_count} candidatures</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar size={14} />
          <span>{user.interviews_count} entretiens</span>
        </div>
      </div>

      {/* Onboarding badge */}
      {user.onboarding_completed !== undefined && (
        <div className="mb-3">
          {user.onboarding_completed ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              <CheckCircle2 size={11} /> Onboarding terminé
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock size={11} /> Onboarding en cours
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
        <span>Inscrit le {format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })}</span>
        {user.last_login && (
          <span>Dernière connexion: {format(new Date(user.last_login), 'dd/MM/yy HH:mm')}</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <div className="flex items-center gap-1">
          {user.is_active ? (
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <UserCheck size={14} /> Actif
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 text-xs">
              <UserX size={14} /> Désactivé
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(user)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-gold"
            title="Voir détails"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => onEdit(user)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="Modifier"
          >
            <Edit2 size={16} />
          </button>
          {user.is_active ? (
            <button
              onClick={() => onDelete(user)}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-slate-400 hover:text-red-400"
              title="Désactiver"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <button
              onClick={() => onReactivate(user)}
              className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-slate-400 hover:text-green-400"
              title="Réactiver"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// User Detail Modal
const UserDetailModal = ({ user, isOpen, onClose, stats }) => {
  if (!user) return null;
  const roleInfo = ROLE_OPTIONS.find(r => r.value === user.role) || ROLE_OPTIONS[2];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-xl">
              {user.full_name[0].toUpperCase()}
            </div>
            <div>
              <span className="text-white">{user.full_name}</span>
              <p className="text-slate-400 text-base font-normal">{user.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 mt-4 pr-2 custom-scrollbar">
          {/* Status & Risk Signals */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
            {user.is_active ? (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500/20 text-green-400">
                Actif
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400">
                Désactivé
              </span>
            )}
            {user.extension_connected && (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400 flex items-center gap-1.5">
                <Puzzle size={14} /> Extension OK
              </span>
            )}
          </div>

          {/* Risk Signals Alert */}
          {user.risk_signals && user.risk_signals.length > 0 && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                <AlertTriangle size={18} />
                <span>Signaux d'attention</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.risk_signals.map(signal => (
                  <span key={signal} className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Candidate Profile Info */}
          {(user.job_title || user.monthly_goal) && (
            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <Target size={14} className="text-gold" />
                Profil Candidat
              </p>
              <div className="grid grid-cols-2 gap-4">
                {user.job_title && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 bg-slate-800 rounded-lg text-slate-400">
                      <Briefcase size={14} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Poste ciblé</p>
                      <p className="text-sm font-medium text-white">{user.job_title}</p>
                    </div>
                  </div>
                )}
                {user.monthly_goal && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 bg-slate-800 rounded-lg text-slate-400">
                      <Target size={14} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Objectif mensuel</p>
                      <p className="text-sm font-medium text-white">{user.monthly_goal} candidatures</p>
                    </div>
                  </div>
                )}
                {user.experience_level && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 bg-slate-800 rounded-lg text-slate-400">
                      <GraduationCap size={14} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Niveau</p>
                      <p className="text-sm font-medium text-white capitalize">{user.experience_level}</p>
                    </div>
                  </div>
                )}
                {user.sector && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 bg-slate-800 rounded-lg text-slate-400">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Secteur</p>
                      <p className="text-sm font-medium text-white">{user.sector}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Candidatures</p>
              <p className="text-xl font-bold text-white">{user.applications_count}</p>
            </div>
            <div className="p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Entretiens</p>
              <p className="text-xl font-bold text-white">{user.interviews_count}</p>
            </div>
            <div className="p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Documents</p>
              <p className="text-xl font-bold text-white">{user.documents_count || 0}</p>
            </div>
            <div className="p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Usage IA (Total)</p>
              <p className="text-xl font-bold text-amber-400 flex items-center gap-1">
                <Zap size={16} /> {user.ai_calls_total || 0}
              </p>
            </div>
          </div>

          {/* AI Usage Today */}
          <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" /> Usage IA aujourd'hui
              </p>
              <span className="text-xs font-mono font-bold text-white">
                {user.ai_calls_today || 0} appels
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 rounded-full transition-all" 
                style={{ width: `${Math.min(100, (user.ai_calls_today || 0) * 10)}%` }} 
              />
            </div>
          </div>

          {/* Timeline Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <p className="text-xs text-slate-500 mb-1">Dernière candidature</p>
              <p className="text-sm text-white flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                {user.last_application_date 
                  ? format(new Date(user.last_application_date), 'dd MMMM yyyy', { locale: fr })
                  : 'Aucune'
                }
              </p>
            </div>
            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <p className="text-xs text-slate-500 mb-1">Dernière connexion</p>
              <p className="text-sm text-white flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                {user.last_login 
                  ? format(new Date(user.last_login), 'dd MMMM yyyy à HH:mm', { locale: fr })
                  : 'Jamais'
                }
              </p>
            </div>
          </div>

          {/* API Keys */}
          <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Clés API Personnelles</p>
            <div className="flex gap-3">
              <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${user.has_google_ai_key ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-500'}`}>
                Google AI {user.has_google_ai_key ? '✓' : '✗'}
              </span>
              <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${user.has_openai_key ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-500'}`}>
                OpenAI {user.has_openai_key ? '✓' : '✗'}
              </span>
              <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${user.has_groq_key ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-500'}`}>
                Groq {user.has_groq_key ? '✓' : '✗'}
              </span>
            </div>
          </div>

          {/* Onboarding Progression */}
          {user.onboarding_steps && (
            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Progression Onboarding</p>
                {user.onboarding_completed ? (
                  <span className="text-xs text-green-400 flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> Terminé
                  </span>
                ) : (
                  <span className="text-xs text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Clock size={12} /> Incomplet
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'goal', label: 'Objectif' },
                  { key: 'profile', label: 'Profil' },
                  { key: 'extension', label: 'Extension' },
                  { key: 'first_application', label: '1ère App' }
                ].map(({ key, label }) => {
                  const step = user.onboarding_steps[key];
                  return (
                    <div key={key} className={`flex items-center justify-between p-2 rounded-lg border ${step?.completed ? 'bg-green-500/5 border-green-500/20' : step?.skipped ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-900 border-slate-800'}`}>
                      <span className={`text-xs ${step?.completed ? 'text-green-400 font-medium' : 'text-slate-500'}`}>{label}</span>
                      {step?.completed ? (
                        <CheckCircle2 size={14} className="text-green-400" />
                      ) : step?.skipped ? (
                        <SkipForward size={14} className="text-slate-500" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Applications by Status */}
          {stats?.applications_by_status && Object.keys(stats.applications_by_status).length > 0 && (
            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Répartition des candidatures</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.applications_by_status).map(([status, count]) => (
                  <span key={status} className="px-3 py-1 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                    {status}: <span className="text-white font-bold">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
};

// Edit User Modal
const EditUserModal = ({ user, isOpen, onClose, onSave, loading }) => {
  const [role, setRole] = useState(user?.role || 'standard');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);

  useEffect(() => {
    if (user) {
      setRole(user.role || 'standard');
      setIsActive(user.is_active ?? true);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = () => {
    onSave({
      role: role,
      is_active: isActive
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Modifier l'utilisateur</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <p className="text-slate-400 text-sm mb-1">Utilisateur</p>
            <p className="text-white font-medium">{user.full_name}</p>
            <p className="text-slate-500 text-sm">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Rôle</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Statut</label>
            <Select value={isActive ? 'active' : 'inactive'} onValueChange={(v) => setIsActive(v === 'active')}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Désactivé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-700 text-slate-300"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-gold hover:bg-gold-light text-[#020817]"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Create User Modal
const CreateUserModal = ({ isOpen, onClose, onCreate, loading }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('standard');
  const [error, setError] = useState('');

  const handleCreate = () => {
    setError('');
    
    if (!fullName.trim()) {
      setError('Le nom complet est requis');
      return;
    }
    if (!email.trim()) {
      setError("L'email est requis");
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    onCreate({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      role: role
    });
  };

  const handleClose = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('standard');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <UserPlus size={20} className="text-gold" />
            Créer un utilisateur
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nom complet *</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jean Dupont"
              className="bg-slate-900/50 border-slate-700 text-white"
              data-testid="create-user-fullname"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dupont@example.com"
              className="bg-slate-900/50 border-slate-700 text-white"
              data-testid="create-user-email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mot de passe *</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              className="bg-slate-900/50 border-slate-700 text-white"
              data-testid="create-user-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Rôle</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white" data-testid="create-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-slate-700 text-slate-300"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 bg-gold hover:bg-gold-light text-[#020817]"
              data-testid="create-user-submit"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Créer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function AdminUsersPage() {
  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'quotas'
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: quotaStats, isLoading: quotaLoading, refetch: refetchQuotas } = useQuery({
    queryKey: ['admin', 'ai-quota-stats'],
    queryFn: () => api.get('/api/admin/ai-quota-stats').then(r => r.data),
    enabled: activeTab === 'quotas',
    staleTime: 30 * 1000,
  });
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingUserStats, setViewingUserStats] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const usersParams = {
    page: currentPage,
    ...(searchQuery && { search: searchQuery }),
    ...(roleFilter !== 'all' && { role: roleFilter }),
    ...(statusFilter !== 'all' && { is_active: statusFilter === 'active' }),
  };

  const { data: usersData, isLoading: loading } = useAdminUsers(usersParams);
  const users = usersData?.items ?? [];
  const usersPagination = {
    page: usersData?.page ?? 1,
    per_page: usersData?.per_page ?? 20,
    total: usersData?.total ?? 0,
    total_pages: usersData?.total_pages ?? 0,
  };
  const { updateUser, deleteUser, reactivateUser, createUser, exportStats } = useAdminMutations();

  const handleViewUser = async (user) => {
    try {
      const detail = await api.get(`/api/admin/users/${user.id}`).then(r => r.data);
      setViewingUser(detail.user);
      setViewingUserStats(detail.stats);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleSaveUser = async (data) => {
    setSaving(true);
    try {
      await updateUser.mutateAsync({ userId: editingUser.id, data });
      setEditingUser(null);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = await showConfirm({
      title: 'Désactiver l\'utilisateur',
      message: `Êtes-vous sûr de vouloir désactiver le compte de ${user.full_name} ? L'utilisateur ne pourra plus se connecter.`,
      type: 'danger',
      confirmText: 'Désactiver',
      cancelText: 'Annuler',
    });
    if (confirmed) {
      await deleteUser.mutateAsync(user.id);
    }
  };

  const handleReactivateUser = async (user) => {
    const confirmed = await showConfirm({
      title: 'Réactiver l\'utilisateur',
      message: `Voulez-vous réactiver le compte de ${user.full_name} ?`,
      type: 'warning',
      confirmText: 'Réactiver',
      cancelText: 'Annuler',
    });
    if (confirmed) {
      await reactivateUser.mutateAsync(user.id);
    }
  };

  const handleCreateUser = async (userData) => {
    setSaving(true);
    setCreateError('');
    try {
      await createUser.mutateAsync(userData);
      setShowCreateModal(false);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Erreur lors de la création';
      setCreateError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportStats();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin_stats_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export:', err);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Gestion des Utilisateurs</h1>
          <p className="text-slate-400 mt-1">{usersPagination.total} utilisateur(s) au total</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'users' && (
            <>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gold hover:bg-gold-light text-[#020817]" data-testid="create-user-button">
                <UserPlus size={18} className="mr-2" />
                Créer un utilisateur
              </Button>
              <Button onClick={handleExport} variant="outline" className="border-slate-700">
                <Download size={18} className="mr-2" />
                Exporter
              </Button>
            </>
          )}
          {activeTab === 'quotas' && (
            <Button onClick={() => refetchQuotas()} variant="outline" className="border-slate-700">
              <RefreshCw size={16} className="mr-2" />
              Actualiser
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Users size={16} />
          Utilisateurs
        </button>
        <button
          onClick={() => setActiveTab('quotas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'quotas' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Sparkles size={16} />
          Quotas IA
        </button>
      </div>

      {/* Quota View */}
      {activeTab === 'quotas' && (
        <div className="space-y-4">
          {quotaLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Chargement...
            </div>
          ) : quotaStats ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total utilisateurs', value: quotaStats.total_users, icon: Users, color: 'text-blue-400' },
                  { label: 'Requêtes aujourd\'hui', value: quotaStats.total_calls_today, icon: Sparkles, color: 'text-gold' },
                  { label: 'Quota atteint', value: quotaStats.users_at_limit, icon: ShieldX, color: 'text-red-400' },
                  { label: 'Quota / jour', value: quotaStats.quota_daily, icon: Shield, color: 'text-green-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className={color} />
                      <span className="text-xs text-slate-400">{label}</span>
                    </div>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Users table */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                      <th className="text-left px-4 py-3">Utilisateur</th>
                      <th className="text-left px-4 py-3">Rôle</th>
                      <th className="text-left px-4 py-3">Clé perso</th>
                      <th className="text-center px-4 py-3">Appels aujourd'hui</th>
                      <th className="text-left px-4 py-3 w-40">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotaStats.users.map((u) => {
                      const pct = u.is_exempt ? 100 : Math.min(100, (u.calls_today / u.quota_daily) * 100);
                      const barColor = u.is_exempt ? 'bg-green-500' : pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-gold';
                      return (
                        <tr key={u.user_id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{u.full_name}</p>
                            <p className="text-slate-500 text-xs">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-gold/10 text-gold' : 'bg-slate-700 text-slate-300'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {u.has_own_key
                              ? <Key size={14} className="text-green-400" />
                              : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {u.is_exempt
                              ? <Infinity size={14} className="text-slate-400 mx-auto" />
                              : <span className={`font-mono font-bold ${pct >= 100 ? 'text-red-400' : 'text-white'}`}>{u.calls_today}/{u.quota_daily}</span>}
                          </td>
                          <td className="px-4 py-3">
                            {u.is_exempt ? (
                              <span className="text-xs text-green-400">Illimité</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-slate-400 w-8 text-right">{Math.round(pct)}%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {activeTab === 'users' && <div className="space-y-6">

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="pl-10 bg-slate-900/50 border-slate-700 text-white"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px] bg-slate-900/50 border-slate-700 text-white">
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ROLE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-slate-900/50 border-slate-700 text-white">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Désactivés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6" data-testid="users-skeleton-grid">
          <UserCardSkeleton />
          <UserCardSkeleton />
          <UserCardSkeleton />
          <UserCardSkeleton />
          <UserCardSkeleton />
          <UserCardSkeleton />
        </div>
      ) : users.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
            <AnimatePresence>
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onView={handleViewUser}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                  onReactivate={handleReactivateUser}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {usersPagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(usersPagination.page - 1)}
                disabled={usersPagination.page <= 1}
                className="border-slate-700"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-slate-400 px-4">
                {usersPagination.page} / {usersPagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(usersPagination.page + 1)}
                disabled={usersPagination.page >= usersPagination.total_pages}
                className="border-slate-700"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-500">Aucun utilisateur trouvé</p>
        </div>
      )}

      {/* View User Modal */}
      <UserDetailModal
        user={viewingUser}
        stats={viewingUserStats}
        isOpen={!!viewingUser}
        onClose={() => { setViewingUser(null); setViewingUserStats(null); }}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSave={handleSaveUser}
        loading={saving}
      />

      </div>}

      {/* Modals — always mounted */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateUser}
        loading={saving}
      />

      {/* Confirm Dialog */}
      {ConfirmDialog}
    </div>
  );
}
