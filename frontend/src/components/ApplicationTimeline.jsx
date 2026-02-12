import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Send, CheckCircle, XCircle, Clock, Calendar, MessageSquare, 
  Bell, RefreshCw, Target, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { useTracking } from '../hooks/useTracking';

// Mapping des types d'événements vers les icônes et couleurs
const EVENT_CONFIG = {
  application_created: {
    icon: Send,
    color: 'bg-blue-500',
    label: 'Candidature envoyée'
  },
  status_change: {
    icon: RefreshCw,
    color: 'bg-gold',
    label: 'Changement de statut'
  },
  interview_scheduled: {
    icon: Calendar,
    color: 'bg-purple-500',
    label: 'Entretien planifié'
  },
  interview_completed: {
    icon: CheckCircle,
    color: 'bg-green-500',
    label: 'Entretien effectué'
  },
  reminder_sent: {
    icon: Bell,
    color: 'bg-yellow-500',
    label: 'Rappel envoyé'
  },
  followup_sent: {
    icon: MessageSquare,
    color: 'bg-orange-500',
    label: 'Relance envoyée'
  },
  matching_calculated: {
    icon: Target,
    color: 'bg-cyan-500',
    label: 'Score calculé'
  },
  note_added: {
    icon: MessageSquare,
    color: 'bg-slate-500',
    label: 'Note ajoutée'
  }
};

// Status labels
const STATUS_LABELS = {
  pending: { label: 'En attente', color: 'text-yellow-400' },
  positive: { label: 'Réponse positive', color: 'text-green-400' },
  negative: { label: 'Réponse négative', color: 'text-red-400' },
  no_response: { label: 'Pas de réponse', color: 'text-slate-400' },
  cancelled: { label: 'Annulée', color: 'text-red-400' }
};

const TimelineEvent = ({ event, isLast }) => {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.note_added;
  const Icon = config.icon;
  
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const getStatusLabel = (status) => {
    return STATUS_LABELS[status]?.label || status;
  };

  return (
    <div className="flex gap-4">
      {/* Timeline line and icon */}
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center shadow-lg`}>
          <Icon size={18} className="text-white" />
        </div>
        {!isLast && (
          <div className="w-0.5 h-full bg-slate-700 mt-2" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-white">{config.label}</span>
            <span className="text-xs text-slate-500">{formatDate(event.timestamp)}</span>
          </div>
          
          {event.event_type === 'status_change' && (
            <div className="flex items-center gap-2 text-sm">
              <span className={STATUS_LABELS[event.old_value]?.color || 'text-slate-400'}>
                {getStatusLabel(event.old_value)}
              </span>
              <span className="text-slate-500">→</span>
              <span className={STATUS_LABELS[event.new_value]?.color || 'text-slate-400'}>
                {getStatusLabel(event.new_value)}
              </span>
            </div>
          )}
          
          {event.event_type === 'matching_calculated' && (
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-gold">{event.new_value}%</div>
              <span className="text-sm text-slate-400">de compatibilité</span>
            </div>
          )}
          
          {event.details && event.event_type !== 'status_change' && (
            <p className="text-sm text-slate-400 mt-1">{event.details}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export const ApplicationTimeline = ({ applicationId, isOpen, onClose }) => {
  const { getTimeline, loading } = useTracking();
  const [timeline, setTimeline] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const loadTimeline = useCallback(async () => {
    try {
      const data = await getTimeline(applicationId);
      setTimeline(data);
    } catch (err) {
      console.error('Erreur chargement timeline:', err);
    }
  }, [getTimeline, applicationId]);

  useEffect(() => {
    if (applicationId && isOpen) {
      loadTimeline();
    }
  }, [applicationId, isOpen, loadTimeline]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4"
    >
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-gold" />
            <span className="font-medium text-white">Historique de la candidature</span>
            {timeline && (
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                {timeline.timeline?.length || 0} événements
              </span>
            )}
          </div>
          {expanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </button>

        {/* Timeline Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-gold" size={24} />
                  </div>
                ) : timeline?.timeline?.length > 0 ? (
                  <div className="space-y-0">
                    {timeline.timeline.map((event, index) => (
                      <TimelineEvent 
                        key={`${event.event_type}-${event.timestamp}-${index}`}
                        event={event}
                        isLast={index === timeline.timeline.length - 1}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">
                    Aucun événement dans l'historique
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ApplicationTimeline;
