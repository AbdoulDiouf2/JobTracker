import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileText, Copy, Check, Loader2, RefreshCw, Download, FileCheck, Wand2 } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CoverLetterGeneratorModal({ 
  open, 
  onClose, 
  entreprise: initialEntreprise = '', 
  poste: initialPoste = '', 
  jobDescription,
  applicationId,
  language = 'fr',
  preselectedTemplateId = null
}) {
  const [cvs, setCvs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [tone, setTone] = useState('professional');
  const [generatedContent, setGeneratedContent] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState(preselectedTemplateId ? 'template' : 'ai');
  
  // Form fields for template generation
  const [entreprise, setEntreprise] = useState(initialEntreprise);
  const [poste, setPoste] = useState(initialPoste);

  const t = {
    fr: {
      title: 'Générer une Lettre de Motivation',
      subtitle: 'Choisissez votre méthode de génération',
      tabAI: 'Génération IA',
      tabTemplate: 'Depuis un Template',
      selectCV: 'Sélectionner un CV (optionnel)',
      selectTemplate: 'Sélectionner un template',
      noCV: 'Aucun CV',
      noTemplate: 'Aucun template disponible',
      createTemplate: 'Créez d\'abord un template dans Documents',
      tone: 'Ton de la lettre',
      tones: {
        professional: 'Professionnel',
        enthusiastic: 'Enthousiaste',
        formal: 'Formel'
      },
      generate: 'Générer avec l\'IA',
      generateFromTemplate: 'Générer depuis le template',
      regenerate: 'Régénérer',
      copy: 'Copier',
      copied: 'Copié !',
      download: 'Télécharger PDF',
      close: 'Fermer',
      generating: 'Génération en cours...',
      error: 'Erreur de génération',
      success: 'Lettre générée avec succès !',
      forCompany: 'Entreprise',
      position: 'Poste',
      aiDescription: 'L\'IA génère une lettre personnalisée basée sur vos informations',
      templateDescription: 'Utilisez un de vos templates avec remplacement automatique des variables',
      variables: 'Variables: {entreprise}, {poste}, {date}, {nom}, {email}',
      preview: 'Aperçu du template'
    },
    en: {
      title: 'Generate Cover Letter',
      subtitle: 'Choose your generation method',
      tabAI: 'AI Generation',
      tabTemplate: 'From Template',
      selectCV: 'Select a CV (optional)',
      selectTemplate: 'Select a template',
      noCV: 'No CV',
      noTemplate: 'No template available',
      createTemplate: 'Create a template first in Documents',
      tone: 'Letter tone',
      tones: {
        professional: 'Professional',
        enthusiastic: 'Enthusiastic',
        formal: 'Formal'
      },
      generate: 'Generate with AI',
      generateFromTemplate: 'Generate from template',
      regenerate: 'Regenerate',
      copy: 'Copy',
      copied: 'Copied!',
      download: 'Download PDF',
      close: 'Close',
      generating: 'Generating...',
      error: 'Generation error',
      success: 'Letter generated successfully!',
      forCompany: 'Company',
      position: 'Position',
      aiDescription: 'AI generates a personalized letter based on your information',
      templateDescription: 'Use one of your templates with automatic variable replacement',
      variables: 'Variables: {entreprise}, {poste}, {date}, {nom}, {email}',
      preview: 'Template preview'
    }
  }[language];

  // Fetch CVs and templates on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const [cvsRes, templatesRes] = await Promise.all([
          axios.get(`${API_URL}/api/documents/cv`, { headers }),
          axios.get(`${API_URL}/api/documents/templates`, { headers })
        ]);
        
        setCvs(cvsRes.data);
        setTemplates(templatesRes.data);
        
        // Auto-select default CV
        const defaultCv = cvsRes.data.find(cv => cv.is_default);
        if (defaultCv) {
          setSelectedCvId(defaultCv.id);
        }
        
        // Auto-select template if preselected or default
        if (preselectedTemplateId) {
          setSelectedTemplateId(preselectedTemplateId);
          setActiveTab('template');
        } else {
          const defaultTemplate = templatesRes.data.find(t => t.is_default);
          if (defaultTemplate) {
            setSelectedTemplateId(defaultTemplate.id);
          } else if (templatesRes.data.length > 0) {
            setSelectedTemplateId(templatesRes.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    if (open) {
      setLoadingData(true);
      fetchData();
      setGeneratedContent('');
      setDownloadUrl(null);
      setEntreprise(initialEntreprise);
      setPoste(initialPoste);
    }
  }, [open, initialEntreprise, initialPoste, preselectedTemplateId]);

  const handleGenerateAI = async () => {
    if (!entreprise || !poste) {
      toast.error(language === 'fr' ? 'Entreprise et poste requis' : 'Company and position required');
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/documents/generate-cover-letter-ai`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            entreprise,
            poste,
            cv_id: selectedCvId || undefined,
            job_description: jobDescription || undefined,
            tone,
            application_id: applicationId || undefined
          }
        }
      );
      
      setGeneratedContent(response.data.content);
      setDownloadUrl(response.data.download_url);
      toast.success(t.success);
    } catch (error) {
      console.error('Error generating cover letter:', error);
      toast.error(error.response?.data?.detail || t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error(language === 'fr' ? 'Sélectionnez un template' : 'Select a template');
      return;
    }
    if (!entreprise || !poste) {
      toast.error(language === 'fr' ? 'Entreprise et poste requis' : 'Company and position required');
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/documents/templates/${selectedTemplateId}/generate`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            entreprise,
            poste,
            application_id: applicationId || undefined,
            save_as_pdf: true
          }
        }
      );
      
      setGeneratedContent(response.data.content);
      setDownloadUrl(response.data.download_url);
      toast.success(t.success);
    } catch (error) {
      console.error('Error generating from template:', error);
      toast.error(error.response?.data?.detail || t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-gold" size={24} />
            {t.title}
          </DialogTitle>
          <p className="text-sm text-slate-400">{t.subtitle}</p>
        </DialogHeader>

        {/* Tabs for AI vs Template */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-slate-800/50 w-full grid grid-cols-2">
            <TabsTrigger value="ai" className="data-[state=active]:bg-gold data-[state=active]:text-[#020817]">
              <Wand2 size={16} className="mr-2" />
              {t.tabAI}
            </TabsTrigger>
            <TabsTrigger value="template" className="data-[state=active]:bg-gold data-[state=active]:text-[#020817]">
              <FileCheck size={16} className="mr-2" />
              {t.tabTemplate}
            </TabsTrigger>
          </TabsList>

          {/* Company & Position fields - shared */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-slate-300">{t.forCompany} *</Label>
              <Input
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                placeholder="Google, Microsoft..."
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">{t.position} *</Label>
              <Input
                value={poste}
                onChange={(e) => setPoste(e.target.value)}
                placeholder="Développeur, Designer..."
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>
          </div>

          {/* AI Tab */}
          <TabsContent value="ai" className="flex-1 flex flex-col overflow-hidden mt-4 space-y-4">
            <p className="text-sm text-slate-400 bg-slate-800/30 p-3 rounded-lg">
              <Wand2 size={14} className="inline mr-2 text-gold" />
              {t.aiDescription}
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">
                  <FileText size={14} className="inline mr-1" />
                  {t.selectCV}
                </Label>
                <Select value={selectedCvId || "none"} onValueChange={(v) => setSelectedCvId(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
                    <SelectValue placeholder={loadingData ? "..." : t.noCV} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="none">{t.noCV}</SelectItem>
                    {cvs.map(cv => (
                      <SelectItem key={cv.id} value={cv.id}>
                        {cv.name} {cv.label && `(${cv.label})`} {cv.is_default && '⭐'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-slate-300">{t.tone}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="professional">{t.tones.professional}</SelectItem>
                    <SelectItem value="enthusiastic">{t.tones.enthusiastic}</SelectItem>
                    <SelectItem value="formal">{t.tones.formal}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!generatedContent && (
              <Button 
                onClick={handleGenerateAI} 
                disabled={loading || !entreprise || !poste}
                className="bg-gold hover:bg-gold/90 text-[#020817] w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    {t.generating}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="mr-2" />
                    {t.generate}
                  </>
                )}
              </Button>
            )}
          </TabsContent>

          {/* Template Tab */}
          <TabsContent value="template" className="flex-1 flex flex-col overflow-hidden mt-4 space-y-4">
            <p className="text-sm text-slate-400 bg-slate-800/30 p-3 rounded-lg">
              <FileCheck size={14} className="inline mr-2 text-green-400" />
              {t.templateDescription}
              <br />
              <span className="text-xs text-slate-500 mt-1 block">{t.variables}</span>
            </p>

            {templates.length === 0 ? (
              <div className="text-center py-8 bg-slate-800/30 rounded-lg">
                <FileCheck size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">{t.noTemplate}</p>
                <p className="text-sm text-slate-500 mt-1">{t.createTemplate}</p>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-slate-300">{t.selectTemplate} *</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
                      <SelectValue placeholder={t.noTemplate} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} {template.is_default && '⭐'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Template preview */}
                {selectedTemplate && (
                  <div className="bg-slate-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-slate-500 mb-2">{t.preview}:</p>
                    <p className="text-sm text-slate-300 font-mono whitespace-pre-wrap line-clamp-4">
                      {selectedTemplate.content.substring(0, 300)}...
                    </p>
                  </div>
                )}

                {!generatedContent && (
                  <Button 
                    onClick={handleGenerateFromTemplate} 
                    disabled={loading || !selectedTemplateId || !entreprise || !poste}
                    className="bg-green-600 hover:bg-green-700 text-white w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
                        {t.generating}
                      </>
                    ) : (
                      <>
                        <FileCheck size={18} className="mr-2" />
                        {t.generateFromTemplate}
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </TabsContent>

          {/* Generated Content - shown for both tabs */}
          <AnimatePresence>
            {generatedContent && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-hidden flex flex-col border-t border-slate-800 pt-4 mt-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">
                    {language === 'fr' ? 'Lettre générée:' : 'Generated letter:'}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={activeTab === 'ai' ? handleGenerateAI : handleGenerateFromTemplate}
                      disabled={loading}
                      className="border-slate-700 text-slate-300"
                    >
                      <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                      {t.regenerate}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopy}
                      className="border-slate-700 text-slate-300"
                    >
                      {copied ? <Check size={14} className="mr-1 text-green-400" /> : <Copy size={14} className="mr-1" />}
                      {copied ? t.copied : t.copy}
                    </Button>
                    {downloadUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownload}
                        className="border-gold/50 text-gold hover:bg-gold/10"
                      >
                        <Download size={14} className="mr-1" />
                        {t.download}
                      </Button>
                    )}
                  </div>
                </div>
                
                <Textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="flex-1 min-h-[200px] bg-slate-800 border-slate-700 text-white font-mono text-sm"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} className="border-slate-700">
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
