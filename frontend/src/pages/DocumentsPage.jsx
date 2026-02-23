import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Upload, Link as LinkIcon, Trash2, Download, Edit2, 
  Plus, Star, StarOff, File, ExternalLink, Github, Linkedin, Globe,
  FolderOpen, FileCheck, Copy, Check, X, Loader2, Eye
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DocumentsPage() {
  const { language } = useLanguage();
  const [documents, setDocuments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cv');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const t = {
    fr: {
      title: 'Mes Documents',
      subtitle: 'Gérez vos CV, lettres de motivation et liens portfolio',
      cvTab: 'CV',
      coverLettersTab: 'Lettres de motivation',
      portfolioTab: 'Portfolio & Liens',
      uploadCV: 'Uploader un CV',
      addLink: 'Ajouter un lien',
      addTemplate: 'Créer un template',
      noCVs: 'Aucun CV uploadé',
      noLinks: 'Aucun lien ajouté',
      noTemplates: 'Aucun template créé',
      uploadTitle: 'Uploader un document',
      linkTitle: 'Ajouter un lien portfolio',
      templateTitle: 'Template de lettre de motivation',
      name: 'Nom',
      label: 'Étiquette',
      labelPlaceholder: 'Ex: CV Tech, CV Data, CV Finance...',
      description: 'Description',
      url: 'URL',
      urlPlaceholder: 'https://...',
      file: 'Fichier',
      selectFile: 'Sélectionner un fichier',
      setAsDefault: 'Définir comme défaut',
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      download: 'Télécharger',
      edit: 'Modifier',
      default: 'Par défaut',
      size: 'Taille',
      created: 'Créé le',
      templateContent: 'Contenu du template',
      templateVariables: 'Variables disponibles: {entreprise}, {poste}, {date}, {nom}, {email}',
      copied: 'Copié !',
      confirmDelete: 'Êtes-vous sûr de vouloir supprimer ce document ?',
      uploadSuccess: 'Document uploadé avec succès',
      linkSuccess: 'Lien ajouté avec succès',
      templateSuccess: 'Template créé avec succès',
      deleteSuccess: 'Document supprimé',
      error: 'Une erreur est survenue',
      maxSize: 'Taille max: 10 MB',
      allowedTypes: 'Formats: PDF, DOC, DOCX, PNG, JPG',
      preview: 'Aperçu',
      close: 'Fermer',
      noPreview: 'Aperçu non disponible pour ce type de fichier',
      downloadToView: 'Télécharger pour voir'
    },
    en: {
      title: 'My Documents',
      subtitle: 'Manage your CVs, cover letters and portfolio links',
      cvTab: 'CV',
      coverLettersTab: 'Cover Letters',
      portfolioTab: 'Portfolio & Links',
      uploadCV: 'Upload CV',
      addLink: 'Add link',
      addTemplate: 'Create template',
      noCVs: 'No CV uploaded',
      noLinks: 'No link added',
      noTemplates: 'No template created',
      uploadTitle: 'Upload document',
      linkTitle: 'Add portfolio link',
      templateTitle: 'Cover letter template',
      name: 'Name',
      label: 'Label',
      labelPlaceholder: 'Ex: Tech CV, Data CV, Finance CV...',
      description: 'Description',
      url: 'URL',
      urlPlaceholder: 'https://...',
      file: 'File',
      selectFile: 'Select file',
      setAsDefault: 'Set as default',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      download: 'Download',
      edit: 'Edit',
      default: 'Default',
      size: 'Size',
      created: 'Created',
      templateContent: 'Template content',
      templateVariables: 'Available variables: {entreprise}, {poste}, {date}, {nom}, {email}',
      copied: 'Copied!',
      confirmDelete: 'Are you sure you want to delete this document?',
      uploadSuccess: 'Document uploaded successfully',
      linkSuccess: 'Link added successfully',
      templateSuccess: 'Template created successfully',
      deleteSuccess: 'Document deleted',
      error: 'An error occurred',
      maxSize: 'Max size: 10 MB',
      allowedTypes: 'Formats: PDF, DOC, DOCX, PNG, JPG',
      preview: 'Preview',
      close: 'Close',
      noPreview: 'Preview not available for this file type',
      downloadToView: 'Download to view'
    }
  }[language];

  // Define fetch functions first
  const fetchDocuments = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/documents/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/documents/templates/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
  }, [fetchDocuments, fetchTemplates]);

  const handleUpload = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/documents/upload`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(t.uploadSuccess);
      setUploadModalOpen(false);
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error(error.response?.data?.detail || t.error);
    }
  };

  const handleAddLink = async (data) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/documents/link`, null, {
        headers: { Authorization: `Bearer ${token}` },
        params: data
      });
      toast.success(t.linkSuccess);
      setLinkModalOpen(false);
      fetchDocuments();
    } catch (error) {
      console.error('Error adding link:', error);
      toast.error(error.response?.data?.detail || t.error);
    }
  };

  const handleCreateTemplate = async (data) => {
    try {
      const token = localStorage.getItem('token');
      if (editingTemplate) {
        await axios.put(`${API_URL}/api/documents/templates/${editingTemplate.id}`, null, {
          headers: { Authorization: `Bearer ${token}` },
          params: data
        });
      } else {
        await axios.post(`${API_URL}/api/documents/templates`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      toast.success(t.templateSuccess);
      setTemplateModalOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error with template:', error);
      toast.error(error.response?.data?.detail || t.error);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm(t.confirmDelete)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t.deleteSuccess);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(error.response?.data?.detail || t.error);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm(t.confirmDelete)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/documents/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t.deleteSuccess);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error.response?.data?.detail || t.error);
    }
  };

  const handleSetDefault = async (documentId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/documents/${documentId}`, 
        { is_default: true },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      fetchDocuments();
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error(t.error);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.original_filename || `${doc.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error(t.error);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleViewDocument = (document) => {
    setViewingDocument(document);
    setViewModalOpen(true);
  };

  const cvDocuments = documents.filter(d => d.document_type === 'cv');
  const portfolioLinks = documents.filter(d => d.document_type === 'portfolio_link');

  const getLinkIcon = (url) => {
    if (!url) return <Globe size={20} />;
    if (url.includes('github')) return <Github size={20} />;
    if (url.includes('linkedin')) return <Linkedin size={20} />;
    return <Globe size={20} />;
  };

  // Skeleton components for loading state
  const DocumentCardSkeleton = () => (
    <div className="glass-card rounded-xl p-4 border border-slate-800">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg bg-slate-700" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 bg-slate-700" />
            <Skeleton className="h-3 w-20 bg-slate-700" />
          </div>
        </div>
        <Skeleton className="h-4 w-4 rounded-full bg-slate-700" />
      </div>
      <Skeleton className="h-3 w-full mb-2 bg-slate-700" />
      <Skeleton className="h-3 w-3/4 mb-3 bg-slate-700" />
      <div className="space-y-2 mb-3">
        <Skeleton className="h-3 w-24 bg-slate-700" />
        <Skeleton className="h-3 w-28 bg-slate-700" />
      </div>
      <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
        <Skeleton className="h-8 w-24 bg-slate-700 rounded" />
        <Skeleton className="h-8 w-20 bg-slate-700 rounded" />
        <Skeleton className="h-8 w-8 bg-slate-700 rounded ml-auto" />
      </div>
    </div>
  );

  const TemplateCardSkeleton = () => (
    <div className="glass-card rounded-xl p-4 border border-slate-800">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg bg-slate-700" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 bg-slate-700" />
            <Skeleton className="h-3 w-16 bg-slate-700" />
          </div>
        </div>
      </div>
      <Skeleton className="h-20 w-full mb-3 bg-slate-700 rounded" />
      <Skeleton className="h-3 w-32 mb-3 bg-slate-700" />
      <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
        <Skeleton className="h-8 w-20 bg-slate-700 rounded" />
        <Skeleton className="h-8 w-8 bg-slate-700 rounded ml-auto" />
      </div>
    </div>
  );

  const LinkCardSkeleton = () => (
    <div className="glass-card rounded-xl p-4 border border-slate-800">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg bg-slate-700" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 bg-slate-700" />
            <Skeleton className="h-3 w-16 bg-slate-700" />
          </div>
        </div>
        <Skeleton className="h-4 w-4 rounded-full bg-slate-700" />
      </div>
      <Skeleton className="h-3 w-full mb-3 bg-slate-700" />
      <Skeleton className="h-3 w-48 mb-3 bg-slate-700" />
      <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
        <Skeleton className="h-8 w-8 bg-slate-700 rounded" />
        <Skeleton className="h-8 w-8 bg-slate-700 rounded" />
        <Skeleton className="h-8 w-8 bg-slate-700 rounded ml-auto" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="bg-slate-800/50 w-max min-w-full sm:min-w-0 justify-start">
            <TabsTrigger value="cv" className="data-[state=active]:bg-gold data-[state=active]:text-[#020817]">
              <FileText size={16} className="mr-2" />
              {t.cvTab}
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-gold data-[state=active]:text-[#020817]">
              <FileCheck size={16} className="mr-2" />
              {t.coverLettersTab}
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="data-[state=active]:bg-gold data-[state=active]:text-[#020817]">
              <LinkIcon size={16} className="mr-2" />
              {t.portfolioTab}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* CV Tab */}
        <TabsContent value="cv" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setUploadModalOpen(true)} className="bg-gold hover:bg-gold/90 text-[#020817]">
              <Upload size={16} className="mr-2" />
              {t.uploadCV}
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <DocumentCardSkeleton key={i} />
              ))}
            </div>
          ) : cvDocuments.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center border border-slate-800">
              <FolderOpen size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">{t.noCVs}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cvDocuments.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl p-4 border border-slate-800 hover:border-gold/50 transition-colors cursor-pointer"
                  onClick={() => handleViewDocument(doc)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gold/20 rounded-lg">
                        <FileText size={24} className="text-gold" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{doc.name}</h3>
                        {doc.label && (
                          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                            {doc.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {doc.is_default && (
                      <Star size={16} className="text-gold fill-gold" />
                    )}
                  </div>
                  
                  {doc.description && (
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">{doc.description}</p>
                  )}
                  
                  <div className="text-xs text-slate-500 mb-3 space-y-1">
                    <div>{t.size}: {formatFileSize(doc.file_size)}</div>
                    <div>{t.created}: {new Date(doc.created_at).toLocaleDateString()}</div>
                  </div>
                  
                  <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Download size={14} className="mr-1" />
                      {t.download}
                    </Button>
                    {!doc.is_default && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={(e) => { e.stopPropagation(); handleSetDefault(doc.id); }}
                        className="text-slate-400 hover:text-gold"
                      >
                        <Star size={14} className="mr-1" />
                        {t.default}
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="text-slate-400 hover:text-red-400 ml-auto"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setEditingTemplate(null); setTemplateModalOpen(true); }} className="bg-gold hover:bg-gold/90 text-[#020817]">
              <Plus size={16} className="mr-2" />
              {t.addTemplate}
            </Button>
          </div>
          
          {templates.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center border border-slate-800">
              <FileCheck size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">{t.noTemplates}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl p-4 border border-slate-800 hover:border-gold/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <FileCheck size={24} className="text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{template.name}</h3>
                        {template.is_default && (
                          <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                            {t.default}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-400 mb-3 line-clamp-3 font-mono bg-slate-900/50 p-2 rounded">
                    {template.content.substring(0, 200)}...
                  </p>
                  
                  <div className="text-xs text-slate-500 mb-3">
                    {t.created}: {new Date(template.created_at).toLocaleDateString()}
                  </div>
                  
                  <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => { setEditingTemplate(template); setTemplateModalOpen(true); }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit2 size={14} className="mr-1" />
                      {t.edit}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-slate-400 hover:text-red-400 ml-auto"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setLinkModalOpen(true)} className="bg-gold hover:bg-gold/90 text-[#020817]">
              <Plus size={16} className="mr-2" />
              {t.addLink}
            </Button>
          </div>
          
          {portfolioLinks.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center border border-slate-800">
              <LinkIcon size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">{t.noLinks}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolioLinks.map((link) => (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl p-4 border border-slate-800 hover:border-gold/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        {getLinkIcon(link.url)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{link.name}</h3>
                        {link.label && (
                          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                            {link.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {link.is_default && (
                      <Star size={16} className="text-gold fill-gold" />
                    )}
                  </div>
                  
                  {link.description && (
                    <p className="text-sm text-slate-400 mb-3">{link.description}</p>
                  )}
                  
                  <a 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-gold hover:underline flex items-center gap-1 mb-3"
                  >
                    {link.url?.substring(0, 40)}...
                    <ExternalLink size={12} />
                  </a>
                  
                  <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        navigator.clipboard.writeText(link.url);
                        toast.success(t.copied);
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Copy size={14} className="mr-1" />
                    </Button>
                    {!link.is_default && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleSetDefault(link.id)}
                        className="text-slate-400 hover:text-gold"
                      >
                        <Star size={14} />
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDelete(link.id)}
                      className="text-slate-400 hover:text-red-400 ml-auto"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <UploadModal 
        open={uploadModalOpen} 
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        t={t}
      />

      {/* Link Modal */}
      <LinkModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSave={handleAddLink}
        t={t}
      />

      {/* Template Modal */}
      <TemplateModal
        open={templateModalOpen}
        onClose={() => { setTemplateModalOpen(false); setEditingTemplate(null); }}
        onSave={handleCreateTemplate}
        template={editingTemplate}
        t={t}
      />

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        open={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setViewingDocument(null);
        }}
        document={viewingDocument}
        t={t}
      />
    </div>
  );
}

// Upload Modal Component
function UploadModal({ open, onClose, onUpload, t }) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !name) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('document_type', 'cv');
    formData.append('label', label);
    formData.append('description', description);
    formData.append('is_default', isDefault);

    await onUpload(formData);
    setLoading(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setLabel('');
    setDescription('');
    setIsDefault(false);
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={20} className="text-gold" />
            {t.uploadTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t.file} *</Label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 border-2 border-dashed border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-gold/50 transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-gold">
                  <FileText size={20} />
                  <span>{file.name}</span>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Upload size={24} className="mx-auto mb-2" />
                  <p>{t.selectFile}</p>
                  <p className="text-xs mt-1">{t.maxSize} • {t.allowedTypes}</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>

          <div>
            <Label>{t.name} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon CV"
              className="bg-slate-800 border-slate-700"
              required
            />
          </div>

          <div>
            <Label>{t.label}</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t.labelPlaceholder}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div>
            <Label>{t.description}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle..."
              className="bg-slate-800 border-slate-700"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-700"
            />
            <Label htmlFor="isDefault" className="cursor-pointer">{t.setAsDefault}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700">
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!file || !name || loading} className="bg-gold hover:bg-gold/90 text-[#020817]">
              {loading ? '...' : t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Link Modal Component
function LinkModal({ open, onClose, onSave, t }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !url) return;

    setLoading(true);
    await onSave({ name, url, label, description, is_default: isDefault });
    setLoading(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setUrl('');
    setLabel('');
    setDescription('');
    setIsDefault(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon size={20} className="text-gold" />
            {t.linkTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t.name} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GitHub, LinkedIn, Portfolio..."
              className="bg-slate-800 border-slate-700"
              required
            />
          </div>

          <div>
            <Label>{t.url} *</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.urlPlaceholder}
              className="bg-slate-800 border-slate-700"
              required
            />
          </div>

          <div>
            <Label>{t.label}</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Personnel, Pro..."
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div>
            <Label>{t.description}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle..."
              className="bg-slate-800 border-slate-700"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="linkDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-700"
            />
            <Label htmlFor="linkDefault" className="cursor-pointer">{t.setAsDefault}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700">
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!name || !url || loading} className="bg-gold hover:bg-gold/90 text-[#020817]">
              {loading ? '...' : t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Template Modal Component
function TemplateModal({ open, onClose, onSave, template, t }) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setContent(template.content);
      setIsDefault(template.is_default);
    } else {
      resetForm();
    }
  }, [template]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !content) return;

    setLoading(true);
    await onSave({ name, content, is_default: isDefault });
    setLoading(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setContent('');
    setIsDefault(false);
  };

  const defaultTemplate = `Madame, Monsieur,

Actuellement à la recherche d'un emploi dans le secteur {secteur}, je me permets de vous adresser ma candidature pour le poste de {poste} au sein de {entreprise}.

[Votre parcours et motivations...]

Je reste à votre disposition pour un entretien afin de vous présenter plus en détail mon parcours et mes motivations.

Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

{nom}
{email}
{date}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck size={20} className="text-gold" />
            {t.templateTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t.name} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template standard, Template tech..."
              className="bg-slate-800 border-slate-700"
              required
            />
          </div>

          <div>
            <Label>{t.templateContent} *</Label>
            <p className="text-xs text-slate-500 mb-2">{t.templateVariables}</p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={defaultTemplate}
              className="bg-slate-800 border-slate-700 font-mono text-sm"
              rows={12}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="templateDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-700"
            />
            <Label htmlFor="templateDefault" className="cursor-pointer">{t.setAsDefault}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700">
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!name || !content || loading} className="bg-gold hover:bg-gold/90 text-[#020817]">
              {loading ? '...' : t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Document Viewer Modal Component
function DocumentViewerModal({ open, onClose, document: doc, t }) {
  const [contentUrl, setContentUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activeUrl = null;

    const fetchDocumentContent = async () => {
      if (!open || !doc) return;

      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/documents/${doc.id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        
        // Use document's saved mime_type as priority, fallback to response header, or guess by extension
        let fileType = doc.mime_type || response.headers['content-type'];
        
        // If it's a known previewable type but the mime type is generic, force it
        const lowerName = (doc.original_filename || doc.name || '').toLowerCase();
        if (lowerName.endsWith('.pdf')) {
          fileType = 'application/pdf';
        } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
          fileType = 'image/jpeg';
        } else if (lowerName.endsWith('.png')) {
          fileType = 'image/png';
        }
        
        const blob = new Blob([response.data], { type: fileType });
        const url = URL.createObjectURL(blob);
        activeUrl = url;
        setContentUrl(url);
      } catch (err) {
        console.error('Error fetching document content:', err);
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    if (open && doc) {
      fetchDocumentContent();
    }

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [open, doc, t]);

  if (!doc) return null;

  const isPdf = doc.original_filename?.toLowerCase().endsWith('.pdf') || doc.name?.toLowerCase().endsWith('.pdf');
  const isImage = /\.(jpg|jpeg|png)$/i.test(doc.original_filename || doc.name);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] bg-slate-900 border-slate-700 text-white flex flex-col p-0 overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">
              <FileText size={20} className="text-gold" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{doc.name}</h3>
              {doc.original_filename && (
                <p className="text-xs text-slate-400">{doc.original_filename}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-800 rounded-full">
            <X size={20} className="text-slate-400" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-hidden relative bg-slate-950/50 flex items-center justify-center p-4">
          {loading ? (
            <div className="text-center">
              <Loader2 className="animate-spin text-gold mx-auto mb-4" size={48} />
              <p className="text-slate-400">Chargement du document...</p>
            </div>
          ) : error ? (
            <div className="text-center bg-red-500/10 p-8 rounded-xl border border-red-500/20">
              <FileText className="mx-auto mb-4 text-red-400" size={48} />
              <p className="text-red-400 mb-2">{error}</p>
              <Button onClick={onClose} variant="outline" className="border-red-500/20 hover:bg-red-500/10 text-red-400">
                {t.close}
              </Button>
            </div>
          ) : (
            <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-inner">
              {isPdf ? (
                <iframe 
                  src={contentUrl} 
                  className="w-full h-full" 
                  title={doc.name}
                  style={{ border: 'none' }}
                />
              ) : isImage ? (
                <img 
                  src={contentUrl} 
                  className="w-full h-full object-contain" 
                  alt={doc.name} 
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <FileText size={64} className="text-slate-700 mb-6" />
                  <p className="text-xl font-semibold mb-2 text-slate-300">{t.noPreview}</p>
                  <p className="text-slate-500 mb-8 max-w-md">
                    Ce format de fichier ne peut pas être prévisualisé directement dans le navigateur.
                  </p>
                  <Button 
                    variant="outline" 
                    className="border-gold/20 text-gold hover:bg-gold/10"
                    onClick={() => {
                        const link = window.document.createElement('a');
                        link.href = contentUrl;
                        link.setAttribute('download', doc.original_filename || `${doc.name}`);
                        window.document.body.appendChild(link);
                        link.click();
                        link.remove();
                    }}
                  >
                    <Download size={18} className="mr-2" />
                    {t.downloadToView}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
