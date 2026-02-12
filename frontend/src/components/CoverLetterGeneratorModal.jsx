import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, FileText, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
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
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CoverLetterGeneratorModal({ 
  open, 
  onClose, 
  entreprise, 
  poste, 
  jobDescription,
  applicationId,
  language = 'fr'
}) {
  const [cvs, setCvs] = useState([]);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [tone, setTone] = useState('professional');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingCvs, setLoadingCvs] = useState(true);

  const t = {
    fr: {
      title: 'Générer une Lettre de Motivation',
      subtitle: 'L\'IA va créer une lettre personnalisée',
      selectCV: 'Sélectionner un CV (optionnel)',
      noCV: 'Aucun CV',
      tone: 'Ton de la lettre',
      tones: {
        professional: 'Professionnel',
        enthusiastic: 'Enthousiaste',
        formal: 'Formel'
      },
      generate: 'Générer avec l\'IA',
      regenerate: 'Régénérer',
      copy: 'Copier',
      copied: 'Copié !',
      close: 'Fermer',
      generating: 'Génération en cours...',
      error: 'Erreur de génération',
      success: 'Lettre générée avec succès !',
      forCompany: 'Pour',
      position: 'Poste'
    },
    en: {
      title: 'Generate Cover Letter',
      subtitle: 'AI will create a personalized letter',
      selectCV: 'Select a CV (optional)',
      noCV: 'No CV',
      tone: 'Letter tone',
      tones: {
        professional: 'Professional',
        enthusiastic: 'Enthusiastic',
        formal: 'Formal'
      },
      generate: 'Generate with AI',
      regenerate: 'Regenerate',
      copy: 'Copy',
      copied: 'Copied!',
      close: 'Close',
      generating: 'Generating...',
      error: 'Generation error',
      success: 'Letter generated successfully!',
      forCompany: 'For',
      position: 'Position'
    }
  }[language];

  // Fetch CVs on mount
  useEffect(() => {
    const fetchCvs = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/documents/cv`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCvs(response.data);
        // Auto-select default CV
        const defaultCv = response.data.find(cv => cv.is_default);
        if (defaultCv) {
          setSelectedCvId(defaultCv.id);
        }
      } catch (error) {
        console.error('Error fetching CVs:', error);
      } finally {
        setLoadingCvs(false);
      }
    };

    if (open) {
      fetchCvs();
      setGeneratedContent('');
    }
  }, [open]);

  const handleGenerate = async () => {
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
      toast.success(t.success);
    } catch (error) {
      console.error('Error generating cover letter:', error);
      toast.error(error.response?.data?.detail || t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

        {/* Info */}
        <div className="bg-slate-800/50 rounded-lg p-3 flex gap-4 text-sm">
          <div>
            <span className="text-slate-400">{t.forCompany}:</span>
            <span className="text-white ml-2 font-medium">{entreprise}</span>
          </div>
          <div>
            <span className="text-slate-400">{t.position}:</span>
            <span className="text-white ml-2 font-medium">{poste}</span>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <FileText size={14} className="inline mr-1" />
              {t.selectCV}
            </label>
            <Select value={selectedCvId || "none"} onValueChange={(v) => setSelectedCvId(v === "none" ? "" : v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder={loadingCvs ? "..." : t.noCV} />
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
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t.tone}
            </label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
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

        {/* Generate Button */}
        {!generatedContent && (
          <Button 
            onClick={handleGenerate} 
            disabled={loading}
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

        {/* Generated Content */}
        {generatedContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Lettre générée:</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
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
              </div>
            </div>
            
            <Textarea
              value={generatedContent}
              onChange={(e) => setGeneratedContent(e.target.value)}
              className="flex-1 min-h-[300px] bg-slate-800 border-slate-700 text-white font-mono text-sm"
            />
          </motion.div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700">
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
