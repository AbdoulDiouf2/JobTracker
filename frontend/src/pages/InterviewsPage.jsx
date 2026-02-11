import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { 
  Plus, Calendar, Clock, MapPin, User, Edit2, Trash2, 
  Phone, Video, Building, Loader2, AlertCircle
} from 'lucide-react';
import { useInterviews } from '../hooks/useInterviews';
import { useApplications } from '../hooks/useApplications';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const TYPE_OPTIONS = [
  { value: 'rh', label: 'RH', icon: User },
  { value: 'technical', label: 'Technique', icon: Building },
  { value: 'manager', label: 'Manager', icon: User },
  { value: 'final', label: 'Final', icon: AlertCircle },
  { value: 'other', label: 'Autre', icon: Calendar }
];

const FORMAT_OPTIONS = [
  { value: 'phone', label: '📞 Téléphone', icon: Phone },
  { value: 'video', label: '💻 Visio', icon: Video },
  { value: 'in_person', label: '🏢 Présentiel', icon: Building }
];

const STATUS_OPTIONS = [
  { value: 'planned', label: '🔄 Planifié', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'completed', label: '✅ Effectué', color: 'bg-green-500/20 text-green-400' },
  { value: 'cancelled', label: '❌ Annulé', color: 'bg-red-500/20 text-red-400' }
];

// Interview Card
const InterviewCard = ({ interview, onEdit, onDelete }) => {
  const { language } = useLanguage();
  const statusInfo = STATUS_OPTIONS.find(s => s.value === interview.statut) || STATUS_OPTIONS[0];
  const typeInfo = TYPE_OPTIONS.find(t => t.value === interview.type_entretien);
  const formatInfo = FORMAT_OPTIONS.find(f => f.value === interview.format_entretien);
  
  const urgencyColors = {
    danger: 'border-l-red-500',
    warning: 'border-l-yellow-500',
    info: 'border-l-blue-500',
    normal: 'border-l-slate-600',
    passed: 'border-l-slate-700'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`glass-card rounded-xl p-5 border border-slate-800 border-l-4 ${urgencyColors[interview.urgency] || urgencyColors.normal}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{interview.entreprise}</h3>
          <p className="text-gold text-sm">{interview.poste}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <Calendar size={14} className="text-slate-500" />
          {format(new Date(interview.date_entretien), 'EEEE dd MMMM yyyy à HH:mm', { 
            locale: language === 'fr' ? fr : enUS 
          })}
        </div>
        
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1">
            {typeInfo?.label || interview.type_entretien}
          </span>
          <span>•</span>
          <span>{formatInfo?.label || interview.format_entretien}</span>
        </div>

        {interview.lieu_entretien && (
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin size={14} />
            {interview.lieu_entretien}
          </div>
        )}

        {interview.interviewer && (
          <div className="flex items-center gap-2 text-slate-400">
            <User size={14} />
            {interview.interviewer}
          </div>
        )}
      </div>

      {interview.time_remaining && interview.statut === 'planned' && (
        <div className={`mt-3 pt-3 border-t border-slate-800 flex items-center gap-2
          ${interview.urgency === 'danger' ? 'text-red-400' : 
            interview.urgency === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`}>
          <Clock size={14} />
          <span className="text-sm font-medium">Dans {interview.time_remaining}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
        <button
          onClick={() => onEdit(interview)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => onDelete(interview.id)}
          className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-slate-400 hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
};

// Interview Form Modal
const InterviewFormModal = ({ isOpen, onClose, onSubmit, editingInterview, applications, loading, t }) => {
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    if (editingInterview) {
      Object.entries(editingInterview).forEach(([key, value]) => {
        if (key === 'date_entretien' && value) {
          setValue(key, value.slice(0, 16));
        } else if (value) {
          setValue(key, value);
        }
      });
    } else {
      reset({
        type_entretien: 'technical',
        format_entretien: 'video',
        date_entretien: new Date().toISOString().slice(0, 16)
      });
    }
  }, [editingInterview, setValue, reset]);

  const handleFormSubmit = (data) => {
    const formattedData = {
      ...data,
      date_entretien: new Date(data.date_entretien).toISOString()
    };
    onSubmit(formattedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {editingInterview ? t.editInterview : t.newInterview}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 mt-4">
          {!editingInterview && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.application} *</label>
              <Select onValueChange={(v) => setValue('candidature_id', v)}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                  <SelectValue placeholder="Sélectionner une candidature..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                  {applications.map(app => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.entreprise} - {app.poste}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t.dateTime} *</label>
            <Input
              {...register('date_entretien')}
              type="datetime-local"
              className="bg-slate-900/50 border-slate-700 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.type}</label>
              <Select onValueChange={(v) => setValue('type_entretien', v)} defaultValue={watch('type_entretien')}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.format}</label>
              <Select onValueChange={(v) => setValue('format_entretien', v)} defaultValue={watch('format_entretien')}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {FORMAT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t.location}</label>
            <Input
              {...register('lieu_entretien')}
              placeholder="Lien Zoom, adresse..."
              className="bg-slate-900/50 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t.interviewer}</label>
            <Input
              {...register('interviewer')}
              placeholder="Nom du recruteur..."
              className="bg-slate-900/50 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t.comment}</label>
            <textarea
              {...register('commentaire')}
              rows={2}
              placeholder="Notes..."
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white resize-none"
            />
          </div>

          {editingInterview && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.status}</label>
              <Select onValueChange={(v) => setValue('statut', v)} defaultValue={watch('statut')}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-700 text-slate-300"
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gold hover:bg-gold-light text-[#020817]"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (editingInterview ? t.save : t.create)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function InterviewsPage() {
  const { interviews, loading, fetchInterviews, createInterview, updateInterview, deleteInterview } = useInterviews();
  const { applications, fetchApplications } = useApplications();
  const { language } = useLanguage();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);
  const [filter, setFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  const t = {
    fr: {
      title: 'Entretiens',
      subtitle: 'Gérez vos entretiens',
      newInterview: 'Nouvel entretien',
      editInterview: 'Modifier l\'entretien',
      application: 'Candidature',
      dateTime: 'Date et heure',
      type: 'Type',
      format: 'Format',
      location: 'Lieu / Lien',
      interviewer: 'Recruteur',
      comment: 'Commentaire',
      status: 'Statut',
      cancel: 'Annuler',
      create: 'Créer',
      save: 'Enregistrer',
      all: 'Tous',
      planned: 'Planifiés',
      completed: 'Effectués',
      noResults: 'Aucun entretien'
    },
    en: {
      title: 'Interviews',
      subtitle: 'Manage your interviews',
      newInterview: 'New interview',
      editInterview: 'Edit interview',
      application: 'Application',
      dateTime: 'Date and time',
      type: 'Type',
      format: 'Format',
      location: 'Location / Link',
      interviewer: 'Interviewer',
      comment: 'Comment',
      status: 'Status',
      cancel: 'Cancel',
      create: 'Create',
      save: 'Save',
      all: 'All',
      planned: 'Planned',
      completed: 'Completed',
      noResults: 'No interviews'
    }
  }[language];

  useEffect(() => {
    fetchInterviews(filter !== 'all' ? { status: filter } : {});
    fetchApplications({ per_page: 100 });
  }, [fetchInterviews, fetchApplications, filter]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    if (editingInterview) {
      await updateInterview(editingInterview.id, data);
    } else {
      await createInterview(data);
    }
    setSubmitting(false);
    setIsModalOpen(false);
    setEditingInterview(null);
    fetchInterviews(filter !== 'all' ? { status: filter } : {});
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer cet entretien ?')) {
      await deleteInterview(id);
    }
  };

  return (
    <div className="space-y-6" data-testid="interviews-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        <Button 
          onClick={() => { setEditingInterview(null); setIsModalOpen(true); }}
          className="bg-gold hover:bg-gold-light text-[#020817]"
        >
          <Plus size={18} className="mr-2" />
          {t.newInterview}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: t.all },
          { value: 'planned', label: t.planned },
          { value: 'completed', label: t.completed }
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors
              ${filter === opt.value 
                ? 'bg-gold text-[#020817]' 
                : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Interviews Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      ) : interviews.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {interviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                onEdit={(i) => { setEditingInterview(i); setIsModalOpen(true); }}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-500">{t.noResults}</p>
        </div>
      )}

      <InterviewFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingInterview(null); }}
        onSubmit={handleSubmit}
        editingInterview={editingInterview}
        applications={applications}
        loading={submitting}
        t={t}
      />
    </div>
  );
}
