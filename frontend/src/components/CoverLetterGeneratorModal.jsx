import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Copy, Check, Loader2, RefreshCw,
  Download, Wand2, Eye
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from './ui/select';
import { Dialog, DialogContent } from './ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { useAIUsage } from '../hooks/useAIUsage';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function stripAiSignature(text) {
  // Supprime la signature finale générée par l'IA (Cordialement, Nom\nEmail)
  // pour éviter le doublon avec la signature du template HTML
  return text
    .replace(/\n*Cordialement,?\s*\n[\s\S]*$/i, '')
    .replace(/\n*Sincèrement,?\s*\n[\s\S]*$/i, '')
    .trim();
}

function injectVars(html, vars) {
  if (!html) return '';
  // Supprime les blocs Jinja2 conditionnels non supportés côté frontend
  let result = html
    .replace(/\{%[^%]*%\}/g, '')         // {% if ... %} {% endif %} etc.
    .replace(/\{\{[^}]*\}\}/g, (match) => { // {{ var }} → remplace si connu
      const key = match.replace(/\{\{\s*|\s*\}\}/g, '').trim();
      return vars[key] !== undefined ? vars[key] : '';
    });
  // Remplace aussi le format {var}
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return result;
}


export default function CoverLetterGeneratorModal({
  open,
  onClose,
  entreprise: initialEntreprise = '',
  poste: initialPoste = '',
  jobDescription,
  applicationId,
  language = 'fr',
}) {
  // ── Data
  const [cvs, setCvs] = useState([]);
  const [systemTemplates, setSystemTemplates] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userInfo, setUserInfo] = useState({ nom: '', email: '', telephone: '' });

  // ── Form
  const [entreprise, setEntreprise] = useState(initialEntreprise);
  const [poste, setPoste] = useState(initialPoste);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [tone, setTone] = useState('professional');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // ── Preview
  const [previewHtml, setPreviewHtml] = useState('');
  const [leftWidth, setLeftWidth] = useState(400);
  const isDragging = useRef(false);
  const bodyRef = useRef(null);

  // ── Result
  const [generatedContent, setGeneratedContent] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isResult = !!generatedContent;
  const { data: aiUsage } = useAIUsage();
  const isQuotaReached = aiUsage && aiUsage.calls_today >= aiUsage.quota_daily && !aiUsage.has_own_key;

  // ── Reset & fetch on open
  useEffect(() => {
    if (!open) return;
    setGeneratedContent('');
    setDownloadUrl(null);
    setPreviewHtml('');
    setEntreprise(initialEntreprise);
    setPoste(initialPoste);

    const load = async () => {
      setLoadingData(true);
      try {
        const token = localStorage.getItem('token');
        const h = { Authorization: `Bearer ${token}` };
        const [cvsRes, tplRes] = await Promise.all([
          axios.get(`${API_URL}/api/documents`, { headers: h }),
          axios.get(`${API_URL}/api/documents/templates/system`, { headers: h }),
        ]);
        const allCvs = cvsRes.data.filter(d => d.document_type === 'cv');
        setCvs(allCvs);
        setSystemTemplates(tplRes.data);
        const def = allCvs.find(c => c.is_default);
        if (def) setSelectedCvId(def.id);
        if (tplRes.data.length > 0) setSelectedTemplateId(tplRes.data[0].id);

        // Charger les infos user
        const userRes = await axios.get(`${API_URL}/api/auth/me`, { headers: h });
        setUserInfo({
          nom: userRes.data.full_name || '',
          email: userRes.data.email || '',
          telephone: userRes.data.telephone || '',
        });
      } catch {
        toast.error('Erreur de chargement');
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [open, initialEntreprise, initialPoste]);

  // ── Fetch html when template selected
  useEffect(() => {
    if (!selectedTemplateId) {
      setPreviewHtml('');
      return;
    }
    const fetch = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${API_URL}/api/documents/templates/system/${selectedTemplateId}/preview`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPreviewHtml(res.data.html_content || '');
      } catch {
        setPreviewHtml('');
      }
    };
    fetch();
  }, [selectedTemplateId]);


  const handleGenerate = async () => {
    if (!entreprise || !poste) {
      toast.error('Entreprise et poste requis');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/api/documents/generate-cover-letter-ai`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            entreprise,
            poste,
            cv_id: selectedCvId && selectedCvId !== 'none' ? selectedCvId : undefined,
            job_description: jobDescription || undefined,
            tone,
            template_id: selectedTemplateId || undefined,
            is_system_template: !!selectedTemplateId,
            application_id: applicationId || undefined,
          },
        }
      );
      setGeneratedContent(res.data.content);
      setDownloadUrl(res.data.download_url);
      toast.success('Lettre générée !');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur de génération');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    toast.success('Copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);


  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 280), 700);
      setLeftWidth(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [leftWidth]);

  const today = new Date().toLocaleDateString('fr-FR');

  // Preview avant génération — données fictives
  const previewVars = {
    nom: 'Jean Dupont',
    email: 'jean.dupont@email.com',
    telephone: '',
    date: today,
    entreprise: entreprise || 'Entreprise',
    poste: poste || 'Poste',
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  };

  // Résultat — vraies infos user + contenu IA avec \n → <br/>
  const aiContent = previewHtml
    ? stripAiSignature(generatedContent).replace(/\n/g, '<br/>')
    : generatedContent;

  const liveVars = {
    nom: userInfo.nom,
    email: userInfo.email,
    telephone: userInfo.telephone,
    date: today,
    entreprise,
    poste,
    content: aiContent,
  };

  const renderedPreview = injectVars(previewHtml, previewVars);
  const renderedResult = injectVars(previewHtml, liveVars);

  // Largeur de la modal selon l'état
  const modalWidth = isResult && previewHtml
    ? 'max-w-[85vw]'
    : previewHtml
      ? 'max-w-[75vw]'
      : 'max-w-[42vw]';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={`w-full ${modalWidth} max-w-none transition-all duration-500 bg-[#020817] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden p-0 gap-0`}
        style={{ maxHeight: '92vh', minHeight: '600px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <Sparkles size={16} className="text-gold" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {isResult ? 'Lettre générée' : 'Générer une lettre de motivation'}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isResult
                  ? 'Modifiez et téléchargez votre lettre'
                  : 'Configurez puis générez avec l\'IA'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Panneau principal ── */}
          <div
            className="flex flex-col overflow-y-auto custom-scrollbar shrink-0"
            style={{ width: previewHtml ? `${leftWidth}px` : '100%' }}
          >

            <AnimatePresence mode="wait">
              {!isResult ? (
                /* ── FORMULAIRE ── */
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6 space-y-5"
                >
                  {/* Ligne 1 */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Entreprise" step="1">
                      <Input
                        value={entreprise}
                        onChange={e => setEntreprise(e.target.value)}
                        placeholder="Ex: Google"
                        className="bg-slate-900/60 border-slate-700 focus:border-gold/50 text-sm"
                      />
                    </Field>
                    <Field label="Poste" step="2">
                      <Input
                        value={poste}
                        onChange={e => setPoste(e.target.value)}
                        placeholder="Ex: Software Engineer"
                        className="bg-slate-900/60 border-slate-700 focus:border-gold/50 text-sm"
                      />
                    </Field>
                  </div>

                  {/* Ligne 2 */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="CV" step="3">
                      <Select value={selectedCvId} onValueChange={setSelectedCvId}>
                        <SelectTrigger className="bg-slate-900/60 border-slate-700 text-sm">
                          <SelectValue placeholder="Aucun CV" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="none">Aucun CV</SelectItem>
                          {cvs.map(cv => (
                            <SelectItem key={cv.id} value={cv.id}>{cv.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Ton" step="4">
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger className="bg-slate-900/60 border-slate-700 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="professional">Professionnel</SelectItem>
                          <SelectItem value="enthusiastic">Enthousiaste</SelectItem>
                          <SelectItem value="formal">Formel</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {/* Templates */}
                  <div>
                    <div className="mb-4">
                      <Label className="text-slate-300 font-semibold flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-gold/10 text-gold flex items-center justify-center text-[10px] font-bold">5</span>
                        Design & Mise en page
                      </Label>
                    </div>

                    {loadingData ? (
                      <div className="grid grid-cols-2 gap-3">
                        {[0, 1].map(i => <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />)}
                      </div>
                    ) : systemTemplates.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">Aucun template disponible</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {systemTemplates.map(tmpl => {
                          const active = selectedTemplateId === tmpl.id;
                          return (
                            <button
                              key={tmpl.id}
                              onClick={() => setSelectedTemplateId(active ? '' : tmpl.id)}
                              className={`text-left p-3 rounded-xl border transition-all
                                ${active
                                  ? 'bg-gold/10 border-gold shadow-[0_0_12px_rgba(196,160,82,0.12)]'
                                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'
                                }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Sparkles size={12} className={active ? 'text-gold shrink-0' : 'text-slate-500 shrink-0'} />
                                  <span className={`text-sm font-medium truncate ${active ? 'text-gold' : 'text-slate-200'}`}>
                                    {tmpl.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded border border-gold/20 font-bold uppercase tracking-wide">
                                    Premium
                                  </span>
                                  {active && <Check size={12} className="text-gold" />}
                                </div>
                              </div>
                              {tmpl.description && (
                                <p className="text-[10px] text-slate-500 mt-1 truncate">{tmpl.description}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </motion.div>
              ) : (
                /* ── RÉSULTAT : texte éditable ── */
                <motion.div
                  key="result"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 flex flex-col flex-1 min-h-0"
                >
                  <Textarea
                    value={generatedContent}
                    onChange={e => setGeneratedContent(e.target.value)}
                    onWheel={e => e.stopPropagation()}
                    className="flex-1 min-h-0 bg-slate-950/60 border-slate-800 font-mono text-sm leading-relaxed focus:border-gold/30 resize-none overflow-y-auto"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Panneau preview ── */}
          <AnimatePresence>
            {!!previewHtml && (
              <>
                {/* Divider draggable */}
                <div
                  onMouseDown={onDividerMouseDown}
                  className="w-1 shrink-0 bg-slate-800 hover:bg-gold/50 transition-colors cursor-col-resize relative group"
                >
                  <div className="absolute inset-y-0 -left-1 -right-1" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-slate-600 group-hover:bg-gold/70 transition-colors" />
                </div>

                <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="p-4 flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <Eye size={12} className="text-gold" />
                    <span className="text-[11px] text-slate-400 font-medium">
                      {isResult ? 'Rendu final' : 'Aperçu du template'}
                    </span>
                    {isResult && (
                      <span className="ml-auto text-[10px] text-slate-600">Mis à jour en temps réel</span>
                    )}
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 bg-white min-h-0 relative">
                    <iframe
                      srcDoc={isResult ? renderedResult : renderedPreview}
                      title="preview"
                      sandbox="allow-same-origin allow-scripts"
                      style={{
                        width: '115%',
                        height: '115%',
                        transform: 'scale(0.87)',
                        transformOrigin: 'top left',
                        border: 'none',
                      }}
                    />
                  </div>
                  {!isResult && (
                    <p className="text-[10px] text-slate-600 text-center mt-3 shrink-0">
                      Données fictives — le contenu réel sera généré par l'IA
                    </p>
                  )}
                </div>
              </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0">
          <Button variant="ghost" onClick={handleClose} className="text-slate-500 hover:text-white text-sm h-9">
            {isResult ? 'Fermer' : 'Annuler'}
          </Button>
          {!isResult && (
            <Button
              onClick={handleGenerate}
              disabled={loading || !entreprise || !poste || isQuotaReached}
              title={isQuotaReached ? 'Quota journalier atteint' : undefined}
              className="bg-gold hover:bg-gold/90 text-[#020817] font-bold h-9 shadow-lg shadow-gold/10"
            >
              {loading
                ? <><Loader2 className="animate-spin mr-2" size={15} />Génération en cours...</>
                : <><Wand2 size={15} className="mr-2" />Générer ma lettre</>
              }
            </Button>
          )}
          {isResult && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                className="text-slate-400 hover:text-white h-9"
              >
                {copied ? <Check size={14} className="mr-1.5 text-green-400" /> : <Copy size={14} className="mr-1.5" />}
                {copied ? 'Copié !' : 'Copier'}
              </Button>
              {downloadUrl && (
                <Button
                  size="sm"
                  onClick={() => window.open(downloadUrl, '_blank')}
                  className="bg-gold hover:bg-gold/90 text-[#020817] font-bold h-9 shadow-lg shadow-gold/10"
                >
                  <Download size={14} className="mr-1.5" />
                  Télécharger PDF
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={loading}
                className="border-slate-700 text-slate-300 hover:text-white h-9"
              >
                <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Régénérer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, step, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-gold/10 text-gold flex items-center justify-center text-[9px] font-bold">
          {step}
        </span>
        {label}
      </Label>
      {children}
    </div>
  );
}
