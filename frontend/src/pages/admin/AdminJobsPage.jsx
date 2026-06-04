import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  Clock, Play, CheckCircle2, XCircle, RefreshCw,
  Zap, Mail, Calendar, AlertTriangle, Activity
} from 'lucide-react';
import { useSchedulerStatus, useJobTriggers } from '../../hooks/useAdmin';
import { toast } from 'sonner';

const JOB_META = {
  interview_reminders: {
    label: 'Rappels entretiens',
    description: 'Notifications push/in-app 24h et 1h avant chaque entretien',
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  onboarding_reminders: {
    label: 'Rappels onboarding',
    description: 'Emails aux utilisateurs qui n\'ont pas terminé leur configuration',
    icon: Mail,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
};

const TRIGGER_LABEL = {
  interview_reminders: 'Déclencher rappels entretiens',
  onboarding_reminders: 'Déclencher rappels onboarding',
};

function formatRelative(isoString) {
  if (!isoString) return '—';
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function StatBadge({ label, value, highlight }) {
  return (
    <div className={`px-3 py-1.5 rounded-lg text-sm ${highlight ? 'bg-gold/10 text-gold' : 'bg-slate-800 text-slate-300'}`}>
      <span className="text-slate-500 mr-1">{label}</span>
      <span className="font-semibold">{value ?? '—'}</span>
    </div>
  );
}

function RunLog({ log }) {
  const success = log.success;
  const stats = log.stats || {};
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${success ? 'bg-slate-800/50' : 'bg-red-500/5 border border-red-500/20'}`}>
      {success
        ? <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />
        : <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-1.5">{formatRelative(log.timestamp)}</p>
        {stats.error
          ? <p className="text-xs text-red-400 font-mono truncate">{stats.error}</p>
          : <div className="flex flex-wrap gap-2">
              {Object.entries(stats).map(([k, v]) => (
                <span key={k} className="text-xs text-slate-400">
                  <span className="text-slate-500">{k}: </span>{v}
                </span>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

function JobCard({ job, onTrigger, triggering }) {
  const [expanded, setExpanded] = useState(false);
  const meta = JOB_META[job.id] || { label: job.name, icon: Zap, color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700' };
  const Icon = meta.icon;
  const lastRun = job.last_run;
  const logs = job.recent_logs || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-xl border ${meta.border} overflow-hidden`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
              <Icon size={20} className={meta.color} />
            </div>
            <div>
              <h3 className="font-semibold text-white">{meta.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
            </div>
          </div>
          <button
            onClick={onTrigger}
            disabled={triggering}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${triggering
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : `${meta.bg} ${meta.color} hover:opacity-80 border ${meta.border}`
              }`}
          >
            {triggering
              ? <RefreshCw size={14} className="animate-spin" />
              : <Play size={14} />}
            {triggering ? 'En cours…' : 'Lancer'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Prochaine exécution</p>
            <p className="text-sm text-white font-medium">
              {job.next_run ? formatRelative(job.next_run).replace('il y a', 'dans') : '—'}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              {job.next_run ? new Date(job.next_run).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Dernière exécution</p>
            <p className="text-sm text-white font-medium">{lastRun ? formatRelative(lastRun.timestamp) : 'Jamais'}</p>
            {lastRun && (
              <div className="flex items-center gap-1 mt-0.5">
                {lastRun.success
                  ? <CheckCircle2 size={11} className="text-green-400" />
                  : <XCircle size={11} className="text-red-400" />}
                <span className={`text-xs ${lastRun.success ? 'text-green-400' : 'text-red-400'}`}>
                  {lastRun.success ? 'Succès' : 'Erreur'}
                </span>
              </div>
            )}
          </div>
        </div>

        {lastRun?.stats && !lastRun.stats.error && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(lastRun.stats).map(([k, v]) => (
              <StatBadge key={k} label={k} value={v} highlight={k === 'sent'} />
            ))}
          </div>
        )}

        <p className="text-xs text-slate-600 mb-3 font-mono">{job.trigger}</p>

        {logs.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <Activity size={12} />
            {expanded ? 'Masquer' : `Voir ${logs.length} exécution(s)`}
          </button>
        )}
      </div>

      {expanded && logs.length > 0 && (
        <div className="border-t border-slate-800 p-4 space-y-2">
          {logs.map((log, i) => <RunLog key={i} log={log} />)}
        </div>
      )}
    </motion.div>
  );
}

export default function AdminJobsPage() {
  const { data, isLoading, refetch } = useSchedulerStatus();
  const { triggerInterviews, triggerOnboarding } = useJobTriggers();

  const handleTrigger = async (jobId) => {
    try {
      const mutation = jobId === 'interview_reminders' ? triggerInterviews : triggerOnboarding;
      const result = await mutation.mutateAsync();
      toast.success(`Job "${JOB_META[jobId]?.label || jobId}" exécuté`, {
        description: result.stats ? `${result.stats.sent ?? 0} envoi(s)` : undefined,
      });
    } catch {
      toast.error('Erreur lors du déclenchement');
    }
  };

  const jobs = data?.jobs || [];
  const running = data?.scheduler_running;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Jobs automatiques</h1>
          <p className="text-slate-400 mt-1">Suivi et déclenchement manuel des tâches planifiées</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium
            ${running === false
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : running === true
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            {running === false
              ? <><XCircle size={14} /> Arrêté</>
              : running === true
                ? <><CheckCircle2 size={14} /> Actif</>
                : <><Clock size={14} /> …</>
            }
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {running === false && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          <AlertTriangle size={18} />
          <p className="text-sm">Le scheduler est arrêté — les jobs ne s'exécutent pas automatiquement. Redémarre le serveur.</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="glass-card rounded-xl border border-slate-800 p-5 h-48 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-card rounded-xl border border-slate-800 p-12 text-center">
          <Clock size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucun job enregistré</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onTrigger={() => handleTrigger(job.id)}
              triggering={
                (job.id === 'interview_reminders' && triggerInterviews.isPending) ||
                (job.id === 'onboarding_reminders' && triggerOnboarding.isPending)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
