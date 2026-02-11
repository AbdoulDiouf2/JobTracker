import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { 
  Plus, Calendar, Clock, MapPin, User, Edit2, Trash2, 
  Phone, Video, Building, Loader2, AlertCircle, Eye,
  ChevronLeft, ChevronRight, LayoutGrid, CalendarDays, ChevronDown, X
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

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
  { value: 'planned', label: '🔄 Planifié', color: 'bg-blue-500/20 text-blue-400', dotColor: 'bg-blue-400' },
  { value: 'completed', label: '✅ Effectué', color: 'bg-green-500/20 text-green-400', dotColor: 'bg-green-400' },
  { value: 'cancelled', label: '❌ Annulé', color: 'bg-red-500/20 text-red-400', dotColor: 'bg-red-400' }
];

// Interview Card
const InterviewCard = ({ interview, onEdit, onDelete, onViewDetails, onStatusChange }) => {
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
      className={`glass-card rounded-xl p-5 border border-slate-800 border-l-4 ${urgencyColors[interview.urgency] || urgencyColors.normal} hover:border-gold/50 cursor-pointer group`}
      onClick={() => onViewDetails(interview)}
      data-testid={`interview-card-${interview.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white group-hover:text-gold transition-colors">{interview.entreprise}</h3>
          <p className="text-gold text-sm">{interview.poste}</p>
        </div>
        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color} flex items-center gap-1 hover:opacity-80`}>
              {statusInfo.label}
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-900 border-slate-700">
            {STATUS_OPTIONS.map(opt => (
              <DropdownMenuItem 
                key={opt.value}
                onClick={(e) => { e.stopPropagation(); onStatusChange(interview.id, opt.value); }}
                className={`${opt.color} cursor-pointer`}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onViewDetails(interview)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-gold"
          data-testid={`view-interview-btn-${interview.id}`}
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => onEdit(interview)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          data-testid={`edit-interview-btn-${interview.id}`}
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => onDelete(interview.id)}
          className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-slate-400 hover:text-red-400"
          data-testid={`delete-interview-btn-${interview.id}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
};

// Calendar View Component
const CalendarView = ({ interviews, currentMonth, onMonthChange, onDayClick, onInterviewClick, language }) => {
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });
  
  // Get first day of week offset (Monday = 0)
  const startDayOfWeek = (start.getDay() + 6) % 7;
  const emptyDays = Array(startDayOfWeek).fill(null);
  
  const weekDays = language === 'fr' 
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getInterviewsForDay = (day) => {
    return interviews.filter(i => isSameDay(new Date(i.date_entretien), day));
  };

  return (
    <div className="glass-card rounded-xl border border-slate-800 p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="font-heading text-xl font-semibold text-white">
          {format(currentMonth, 'MMMM yyyy', { locale: language === 'fr' ? fr : enUS })}
        </h3>
        <button 
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for offset */}
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square p-1"></div>
        ))}
        
        {/* Day cells */}
        {days.map(day => {
          const dayInterviews = getInterviewsForDay(day);
          const isToday = isSameDay(day, new Date());
          const hasInterviews = dayInterviews.length > 0;
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => hasInterviews && onDayClick(day, dayInterviews)}
              className={`
                aspect-square p-1 rounded-lg transition-all relative
                ${isToday ? 'bg-gold/10 border border-gold/30' : 'hover:bg-slate-800/50'}
                ${hasInterviews ? 'cursor-pointer' : ''}
              `}
            >
              <div className={`
                text-sm text-center mb-1
                ${isToday ? 'text-gold font-bold' : 'text-slate-400'}
              `}>
                {format(day, 'd')}
              </div>
              
              {/* Interview indicators */}
              {dayInterviews.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {dayInterviews.slice(0, 3).map((interview, idx) => {
                    const statusInfo = STATUS_OPTIONS.find(s => s.value === interview.statut);
                    return (
                      <div
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); onInterviewClick(interview); }}
                        className={`w-2 h-2 rounded-full ${statusInfo?.dotColor || 'bg-blue-400'} cursor-pointer hover:scale-125 transition-transform`}
                        title={`${interview.entreprise} - ${interview.poste}`}
                      />
                    );
                  })}
                  {dayInterviews.length > 3 && (
                    <span className="text-[10px] text-slate-500">+{dayInterviews.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-center gap-4">
        {STATUS_OPTIONS.map(opt => (
          <div key={opt.value} className="flex items-center gap-1 text-xs text-slate-400">
            <div className={`w-2 h-2 rounded-full ${opt.dotColor}`}></div>
            {opt.label.split(' ')[1] || opt.label}
          </div>
        ))}
      </div>
    </div>
  );
};

// Interview Detail Modal
const InterviewDetailModal = ({ interview, isOpen, onClose, onEdit, onStatusChange, t, language }) => {
  if (!interview) return null;
  
  const statusInfo = STATUS_OPTIONS.find(s => s.value === interview.statut) || STATUS_OPTIONS[0];
  const typeInfo = TYPE_OPTIONS.find(t => t.value === interview.type_entretien);
  const formatInfo = FORMAT_OPTIONS.find(f => f.value === interview.format_entretien);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            <span className="text-white">{interview.entreprise}</span>
            <p className="text-gold text-base font-normal">{interview.poste}</p>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status & Actions */}
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
            <div>
              <p className="text-slate-400 text-sm mb-1">{t.status}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`px-3 py-2 rounded-lg text-sm font-medium ${statusInfo.color} flex items-center gap-2`}>
                    {statusInfo.label}
                    <ChevronDown size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-700">
                  {STATUS_OPTIONS.map(opt => (
                    <DropdownMenuItem 
                      key={opt.value}
                      onClick={() => onStatusChange(interview.id, opt.value)}
                      className={`${opt.color} cursor-pointer`}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button onClick={() => { onClose(); onEdit(interview); }} variant="outline" className="border-slate-700">
              <Edit2 size={16} className="mr-2" />
              {t.edit}
            </Button>
          </div>

          {/* Date & Time */}
          <div className="p-4 bg-gold/10 rounded-xl border border-gold/20">
            <div className="flex items-center gap-3 text-gold">
              <Calendar size={20} />
              <span className="font-medium text-lg">
                {format(new Date(interview.date_entretien), "EEEE dd MMMM yyyy 'à' HH:mm", { 
                  locale: language === 'fr' ? fr : enUS 
                })}
              </span>
            </div>
            {interview.time_remaining && interview.statut === 'planned' && (
              <p className={`mt-2 text-sm ${
                interview.urgency === 'danger' ? 'text-red-400' : 
                interview.urgency === 'warning' ? 'text-yellow-400' : 'text-blue-400'
              }`}>
                <Clock size={14} className="inline mr-1" />
                Dans {interview.time_remaining}
              </p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">{t.type}</p>
              <p className="text-white font-medium">{typeInfo?.label || interview.type_entretien}</p>
            </div>
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">{t.format}</p>
              <p className="text-white font-medium">{formatInfo?.label || interview.format_entretien}</p>
            </div>
          </div>

          {/* Location */}
          {interview.lieu_entretien && (
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                <MapPin size={14} />
                {t.location}
              </p>
              <p className="text-white break-all">{interview.lieu_entretien}</p>
            </div>
          )}

          {/* Interviewer */}
          {interview.interviewer && (
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                <User size={14} />
                {t.interviewer}
              </p>
              <p className="text-white">{interview.interviewer}</p>
            </div>
          )}

          {/* Comment */}
          {interview.commentaire && (
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-2">{t.comment}</p>
              <p className="text-white whitespace-pre-wrap">{interview.commentaire}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Day Interviews Modal (when clicking a day with multiple interviews)
const DayInterviewsModal = ({ date, interviews, isOpen, onClose, onInterviewClick, language }) => {
  if (!date) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-gold">
            {format(date, 'EEEE dd MMMM yyyy', { locale: language === 'fr' ? fr : enUS })}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {interviews.map(interview => {
            const statusInfo = STATUS_OPTIONS.find(s => s.value === interview.statut);
            return (
              <div
                key={interview.id}
                onClick={() => { onClose(); onInterviewClick(interview); }}
                className="p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-gold/50 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{interview.entreprise}</span>
                  <span className={`px-2 py-1 rounded text-xs ${statusInfo?.color}`}>
                    {statusInfo?.label}
                  </span>
                </div>
                <p className="text-gold text-sm">{interview.poste}</p>
                <p className="text-slate-400 text-sm mt-1">
                  {format(new Date(interview.date_entretien), 'HH:mm')}
                </p>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
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
  const [viewingInterview, setViewingInterview] = useState(null);
  const [filter, setFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dayModalData, setDayModalData] = useState({ date: null, interviews: [] });

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
      edit: 'Modifier',
      all: 'Tous',
      planned: 'Planifiés',
      completed: 'Effectués',
      noResults: 'Aucun entretien',
      cardView: 'Vue liste',
      calendarView: 'Vue calendrier'
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
      edit: 'Edit',
      all: 'All',
      planned: 'Planned',
      completed: 'Completed',
      noResults: 'No interviews',
      cardView: 'List view',
      calendarView: 'Calendar view'
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

  const handleStatusChange = async (id, newStatus) => {
    await updateInterview(id, { statut: newStatus });
    fetchInterviews(filter !== 'all' ? { status: filter } : {});
    // Update viewing interview if open
    if (viewingInterview && viewingInterview.id === id) {
      setViewingInterview(prev => ({ ...prev, statut: newStatus }));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer cet entretien ?')) {
      await deleteInterview(id);
    }
  };

  const handleDayClick = (date, dayInterviews) => {
    if (dayInterviews.length === 1) {
      setViewingInterview(dayInterviews[0]);
    } else {
      setDayModalData({ date, interviews: dayInterviews });
    }
  };

  return (
    <div className="space-y-6" data-testid="interviews-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
              title={t.cardView}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
              title={t.calendarView}
            >
              <CalendarDays size={18} />
            </button>
          </div>
          <Button 
            onClick={() => { setEditingInterview(null); setIsModalOpen(true); }}
            className="bg-gold hover:bg-gold-light text-[#020817]"
          >
            <Plus size={18} className="mr-2" />
            {t.newInterview}
          </Button>
        </div>
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

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      ) : viewMode === 'calendar' ? (
        /* Calendar View */
        <div className="mt-6">
        <CalendarView
          interviews={interviews}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onDayClick={handleDayClick}
          onInterviewClick={setViewingInterview}
          language={language}
        />
      ) : interviews.length > 0 ? (
        /* Card View */
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
          <AnimatePresence>
            {interviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                onEdit={(i) => { setEditingInterview(i); setIsModalOpen(true); }}
                onDelete={handleDelete}
                onViewDetails={setViewingInterview}
                onStatusChange={handleStatusChange}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-500">{t.noResults}</p>
        </div>
      )}

      {/* Form Modal */}
      <InterviewFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingInterview(null); }}
        onSubmit={handleSubmit}
        editingInterview={editingInterview}
        applications={applications}
        loading={submitting}
        t={t}
      />

      {/* Detail Modal */}
      <InterviewDetailModal
        interview={viewingInterview}
        isOpen={!!viewingInterview}
        onClose={() => setViewingInterview(null)}
        onEdit={(i) => { setEditingInterview(i); setIsModalOpen(true); }}
        onStatusChange={handleStatusChange}
        t={t}
        language={language}
      />

      {/* Day Interviews Modal */}
      <DayInterviewsModal
        date={dayModalData.date}
        interviews={dayModalData.interviews}
        isOpen={!!dayModalData.date}
        onClose={() => setDayModalData({ date: null, interviews: [] })}
        onInterviewClick={setViewingInterview}
        language={language}
      />
    </div>
  );
}
