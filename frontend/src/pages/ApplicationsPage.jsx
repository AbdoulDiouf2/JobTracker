import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { 
  Plus, Search, Star, Trash2, Edit2, ExternalLink,
  ChevronLeft, ChevronRight, X, Loader2, MapPin,
  Calendar, MessageSquare, LayoutGrid, List, Eye, ChevronDown
} from 'lucide-react';
import { useApplications } from '../hooks/useApplications';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useConfirmDialog } from '../components/ui/confirm-dialog';
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

const applicationSchema = z.object({
  entreprise: z.string().min(1, 'Entreprise requise'),
  poste: z.string().min(1, 'Poste requis'),
  type_poste: z.string(),
  lieu: z.string().optional(),
  moyen: z.string().optional(),
  date_candidature: z.string(),
  lien: z.string().url().optional().or(z.literal('')),
  commentaire: z.string().optional()
});

const STATUS_OPTIONS = [
  { value: 'pending', label: '⏳ En attente', color: 'bg-yellow-500/20 text-yellow-400', dotColor: 'bg-yellow-400' },
  { value: 'positive', label: '✅ Positive', color: 'bg-green-500/20 text-green-400', dotColor: 'bg-green-400' },
  { value: 'negative', label: '❌ Négative', color: 'bg-red-500/20 text-red-400', dotColor: 'bg-red-400' },
  { value: 'no_response', label: '🔇 Pas de réponse', color: 'bg-slate-500/20 text-slate-400', dotColor: 'bg-slate-400' },
  { value: 'cancelled', label: '🚫 Annulé', color: 'bg-red-500/20 text-red-400', dotColor: 'bg-red-400' }
];

const TYPE_OPTIONS = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'stage', label: 'Stage' },
  { value: 'alternance', label: 'Alternance' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'interim', label: 'Intérim' }
];

const METHOD_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'company_website', label: 'Site entreprise' },
  { value: 'email', label: 'Email' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'apec', label: 'APEC' },
  { value: 'pole_emploi', label: 'France Travail' },
  { value: 'welcome_to_jungle', label: 'Welcome to the Jungle' },
  { value: 'other', label: 'Autre' }
];

// Application Card Component
const ApplicationCard = ({ app, onEdit, onDelete, onToggleFavorite, onStatusChange, onViewDetails, t }) => {
  const statusInfo = STATUS_OPTIONS.find(s => s.value === app.reponse) || STATUS_OPTIONS[0];
  const { language } = useLanguage();
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card rounded-xl p-5 border border-slate-800 hover:border-gold/50 transition-all cursor-pointer group"
      onClick={() => onViewDetails(app)}
      data-testid={`application-card-${app.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-lg">
            {app.entreprise[0]}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-gold transition-colors">{app.entreprise}</h3>
            <p className="text-gold text-sm">{app.poste}</p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(app.id); }}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          data-testid={`favorite-btn-${app.id}`}
        >
          <Star size={18} className={app.is_favorite ? 'text-gold fill-gold' : 'text-slate-500'} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
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
                onClick={(e) => { e.stopPropagation(); onStatusChange(app.id, opt.value); }}
                className={`${opt.color} cursor-pointer`}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
          {TYPE_OPTIONS.find(t => t.value === app.type_poste)?.label || app.type_poste}
        </span>
        {app.lieu && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300 flex items-center gap-1">
            <MapPin size={12} /> {app.lieu}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar size={14} />
          {format(new Date(app.date_candidature), 'dd MMM yyyy', { locale: language === 'fr' ? fr : enUS })}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {app.lien && (
            <a 
              href={app.lien} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ExternalLink size={16} />
            </a>
          )}
          <button
            onClick={() => onViewDetails(app)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-gold"
            data-testid={`view-details-btn-${app.id}`}
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => onEdit(app)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            data-testid={`edit-btn-${app.id}`}
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(app.id)}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-slate-400 hover:text-red-400"
            data-testid={`delete-btn-${app.id}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {app.interviews_count > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800 text-sm text-slate-400">
          📅 {app.interviews_count} entretien(s)
        </div>
      )}
    </motion.div>
  );
};

// Application Table Row Component
const ApplicationTableRow = ({ app, onEdit, onDelete, onToggleFavorite, onStatusChange, onViewDetails, t }) => {
  const statusInfo = STATUS_OPTIONS.find(s => s.value === app.reponse) || STATUS_OPTIONS[0];
  const { language } = useLanguage();
  
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer"
      onClick={() => onViewDetails(app)}
      data-testid={`application-row-${app.id}`}
    >
      <td className="py-3 px-4">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(app.id); }}
          className="p-1"
        >
          <Star size={16} className={app.is_favorite ? 'text-gold fill-gold' : 'text-slate-600'} />
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center text-gold font-bold text-sm">
            {app.entreprise[0]}
          </div>
          <span className="text-white font-medium">{app.entreprise}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-slate-300">{app.poste}</td>
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color} flex items-center gap-1`}>
              <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`}></span>
              {statusInfo.label.split(' ')[1] || statusInfo.label}
              <ChevronDown size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-900 border-slate-700">
            {STATUS_OPTIONS.map(opt => (
              <DropdownMenuItem 
                key={opt.value}
                onClick={() => onStatusChange(app.id, opt.value)}
                className="cursor-pointer text-slate-300 hover:text-white"
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
      <td className="py-3 px-4 text-slate-400">
        {TYPE_OPTIONS.find(t => t.value === app.type_poste)?.label || app.type_poste}
      </td>
      <td className="py-3 px-4 text-slate-400">{app.lieu || '-'}</td>
      <td className="py-3 px-4 text-slate-400">
        {format(new Date(app.date_candidature), 'dd/MM/yyyy', { locale: language === 'fr' ? fr : enUS })}
      </td>
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button onClick={() => onViewDetails(app)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-gold">
            <Eye size={14} />
          </button>
          <button onClick={() => onEdit(app)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(app.id)} className="p-1.5 hover:bg-red-500/10 rounded text-slate-400 hover:text-red-400">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

// Application Detail Modal
const ApplicationDetailModal = ({ app, isOpen, onClose, onEdit, onStatusChange, t }) => {
  const { language } = useLanguage();
  if (!app) return null;
  
  const statusInfo = STATUS_OPTIONS.find(s => s.value === app.reponse) || STATUS_OPTIONS[0];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-lg">
              {app.entreprise[0]}
            </div>
            <div>
              <span className="text-white">{app.entreprise}</span>
              <p className="text-gold text-base font-normal">{app.poste}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status Section */}
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
                      onClick={() => onStatusChange(app.id, opt.value)}
                      className={`${opt.color} cursor-pointer`}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button onClick={() => { onClose(); onEdit(app); }} variant="outline" className="border-slate-700">
              <Edit2 size={16} className="mr-2" />
              {t.edit}
            </Button>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">{t.jobType}</p>
              <p className="text-white font-medium">
                {TYPE_OPTIONS.find(t => t.value === app.type_poste)?.label || app.type_poste}
              </p>
            </div>
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">{t.location}</p>
              <p className="text-white font-medium">{app.lieu || '-'}</p>
            </div>
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">{t.method}</p>
              <p className="text-white font-medium">
                {METHOD_OPTIONS.find(m => m.value === app.moyen)?.label || app.moyen || '-'}
              </p>
            </div>
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">{t.date}</p>
              <p className="text-white font-medium">
                {format(new Date(app.date_candidature), 'dd MMMM yyyy', { locale: language === 'fr' ? fr : enUS })}
              </p>
            </div>
          </div>

          {/* Link */}
          {app.lien && (
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-2">{t.link}</p>
              <a 
                href={app.lien}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold-light flex items-center gap-2 break-all"
              >
                <ExternalLink size={16} />
                {app.lien}
              </a>
            </div>
          )}

          {/* Comment */}
          {app.commentaire && (
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                <MessageSquare size={14} />
                {t.comment}
              </p>
              <p className="text-white whitespace-pre-wrap">{app.commentaire}</p>
            </div>
          )}

          {/* Interviews Count */}
          {app.interviews_count > 0 && (
            <div className="p-4 bg-gold/10 rounded-xl border border-gold/20">
              <p className="text-gold font-medium">
                📅 {app.interviews_count} entretien(s) planifié(s)
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Application Form Modal
const ApplicationFormModal = ({ isOpen, onClose, onSubmit, editingApp, loading, t }) => {
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      type_poste: 'cdi',
      date_candidature: new Date().toISOString().split('T')[0]
    }
  });

  useEffect(() => {
    if (editingApp) {
      Object.entries(editingApp).forEach(([key, value]) => {
        if (key === 'date_candidature' && value) {
          setValue(key, value.split('T')[0]);
        } else if (value !== null && value !== undefined) {
          setValue(key, value);
        }
      });
    } else {
      reset({
        type_poste: 'cdi',
        date_candidature: new Date().toISOString().split('T')[0]
      });
    }
  }, [editingApp, setValue, reset]);

  const handleFormSubmit = (data) => {
    const formattedData = {
      ...data,
      date_candidature: new Date(data.date_candidature).toISOString(),
      lien: data.lien || null,
      lieu: data.lieu || null,
      moyen: data.moyen || null,
      commentaire: data.commentaire || null
    };
    onSubmit(formattedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {editingApp ? t.editApplication : t.newApplication}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.company} *</label>
              <Input
                {...register('entreprise')}
                placeholder="Google, Stripe..."
                className="bg-slate-900/50 border-slate-700 text-white"
              />
              {errors.entreprise && <p className="text-red-400 text-xs mt-1">{errors.entreprise.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.position} *</label>
              <Input
                {...register('poste')}
                placeholder="Développeur Full Stack..."
                className="bg-slate-900/50 border-slate-700 text-white"
              />
              {errors.poste && <p className="text-red-400 text-xs mt-1">{errors.poste.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.jobType}</label>
              <Select onValueChange={(v) => setValue('type_poste', v)} defaultValue={watch('type_poste')}>
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
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.location}</label>
              <Input
                {...register('lieu')}
                placeholder="Paris, Remote..."
                className="bg-slate-900/50 border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.method}</label>
              <Select onValueChange={(v) => setValue('moyen', v)} defaultValue={watch('moyen')}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {METHOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.date}</label>
              <Input
                {...register('date_candidature')}
                type="date"
                className="bg-slate-900/50 border-slate-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t.link}</label>
            <Input
              {...register('lien')}
              placeholder="https://..."
              className="bg-slate-900/50 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t.comment}</label>
            <textarea
              {...register('commentaire')}
              rows={3}
              placeholder="Notes, contact..."
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white resize-none focus:outline-none focus:border-gold"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gold hover:bg-gold-light text-[#020817]"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (editingApp ? t.save : t.create)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function ApplicationsPage() {
  const { 
    applications, loading, pagination, 
    fetchApplications, createApplication, updateApplication, 
    deleteApplication, toggleFavorite 
  } = useApplications();
  const { language } = useLanguage();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [viewingApp, setViewingApp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'

  const t = {
    fr: {
      title: 'Candidatures',
      subtitle: 'Gérez toutes vos candidatures',
      newApplication: 'Nouvelle candidature',
      editApplication: 'Modifier la candidature',
      search: 'Rechercher entreprise, poste...',
      company: 'Entreprise',
      position: 'Poste',
      jobType: 'Type de poste',
      location: 'Lieu',
      method: 'Moyen',
      date: 'Date',
      link: 'Lien offre',
      comment: 'Commentaire',
      status: 'Statut',
      cancel: 'Annuler',
      create: 'Créer',
      save: 'Enregistrer',
      edit: 'Modifier',
      noResults: 'Aucune candidature trouvée',
      deleteConfirm: 'Supprimer cette candidature ?',
      cardView: 'Vue carte',
      tableView: 'Vue table',
      actions: 'Actions'
    },
    en: {
      title: 'Applications',
      subtitle: 'Manage all your applications',
      newApplication: 'New application',
      editApplication: 'Edit application',
      search: 'Search company, position...',
      company: 'Company',
      position: 'Position',
      jobType: 'Job type',
      location: 'Location',
      method: 'Method',
      date: 'Date',
      link: 'Job link',
      comment: 'Comment',
      status: 'Status',
      cancel: 'Cancel',
      create: 'Create',
      save: 'Save',
      edit: 'Edit',
      noResults: 'No applications found',
      deleteConfirm: 'Delete this application?',
      cardView: 'Card view',
      tableView: 'Table view',
      actions: 'Actions'
    }
  }[language];

  useEffect(() => {
    fetchApplications({ search: searchQuery, ...filters });
  }, [fetchApplications, searchQuery, filters]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    if (editingApp) {
      await updateApplication(editingApp.id, data);
    } else {
      await createApplication(data);
    }
    setSubmitting(false);
    setIsModalOpen(false);
    setEditingApp(null);
    fetchApplications({ search: searchQuery, ...filters });
  };

  const handleEdit = (app) => {
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t.deleteConfirm)) {
      await deleteApplication(id);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    await updateApplication(id, { reponse: newStatus });
    fetchApplications({ search: searchQuery, ...filters });
    // Update viewing app if open
    if (viewingApp && viewingApp.id === id) {
      setViewingApp(prev => ({ ...prev, reponse: newStatus }));
    }
  };

  const handleViewDetails = (app) => {
    setViewingApp(app);
  };

  const handlePageChange = (page) => {
    fetchApplications({ page, search: searchQuery, ...filters });
  };

  return (
    <div className="space-y-6" data-testid="applications-page">
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
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
              title={t.tableView}
            >
              <List size={18} />
            </button>
          </div>
          <Button 
            onClick={() => { setEditingApp(null); setIsModalOpen(true); }}
            className="bg-gold hover:bg-gold-light text-[#020817]"
          >
            <Plus size={18} className="mr-2" />
            {t.newApplication}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search}
            className="pl-10 bg-slate-900/50 border-slate-700 text-white"
          />
        </div>
        <Select onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[180px] bg-slate-900/50 border-slate-700 text-white">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">Tous</SelectItem>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      ) : applications.length > 0 ? (
        <>
          {viewMode === 'card' ? (
            /* Card View */
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
              <AnimatePresence>
                {applications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFavorite={toggleFavorite}
                    onStatusChange={handleStatusChange}
                    onViewDetails={handleViewDetails}
                    t={t}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            /* Table View */
            <div className="mt-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 text-left">
                    <th className="py-3 px-4 text-slate-400 font-medium w-12">⭐</th>
                    <th className="py-3 px-4 text-slate-400 font-medium">{t.company}</th>
                    <th className="py-3 px-4 text-slate-400 font-medium">{t.position}</th>
                    <th className="py-3 px-4 text-slate-400 font-medium">{t.status}</th>
                    <th className="py-3 px-4 text-slate-400 font-medium">{t.jobType}</th>
                    <th className="py-3 px-4 text-slate-400 font-medium">{t.location}</th>
                    <th className="py-3 px-4 text-slate-400 font-medium">{t.date}</th>
                    <th className="py-3 px-4 text-slate-400 font-medium">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {applications.map((app) => (
                      <ApplicationTableRow
                        key={app.id}
                        app={app}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleFavorite={toggleFavorite}
                        onStatusChange={handleStatusChange}
                        onViewDetails={handleViewDetails}
                        t={t}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="border-slate-700"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-slate-400 px-4">
                {pagination.page} / {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="border-slate-700"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-500">{t.noResults}</p>
        </div>
      )}

      {/* Form Modal */}
      <ApplicationFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingApp(null); }}
        onSubmit={handleSubmit}
        editingApp={editingApp}
        loading={submitting}
        t={t}
      />

      {/* Detail Modal */}
      <ApplicationDetailModal
        app={viewingApp}
        isOpen={!!viewingApp}
        onClose={() => setViewingApp(null)}
        onEdit={handleEdit}
        onStatusChange={handleStatusChange}
        t={t}
      />
    </div>
  );
}
