import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, CheckCircle, XCircle, Lightbulb, Loader2, RefreshCw,
  ChevronDown, ChevronUp, FileText, Sparkles, Cpu
} from 'lucide-react';
import { useTracking } from '../hooks/useTracking';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { useAIUsage } from '../hooks/useAIUsage';

// Score color based on value
const getScoreColor = (score) => {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-gold';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
};

const getScoreBgColor = (score) => {
  if (score >= 80) return 'bg-green-500/20 border-green-500/30';
  if (score >= 60) return 'bg-gold/20 border-gold/30';
  if (score >= 40) return 'bg-yellow-500/20 border-yellow-500/30';
  return 'bg-red-500/20 border-red-500/30';
};

const getScoreLabel = (score) => {
  if (score >= 80) return 'Excellent match';
  if (score >= 60) return 'Bon match';
  if (score >= 40) return 'Match moyen';
  return 'Faible match';
};

// Score Circle Component
const ScoreCircle = ({ score }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-800/50"
        />
        {/* Progress circle */}
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          className={getScoreColor(score)}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}%</span>
        <span className="text-[10px] text-slate-400 font-medium">match</span>
      </div>
    </div>
  );
};

export const MatchingScoreModal = ({ application, isOpen, onClose }) => {
  const { calculateMatchingScore, getMatchingScore, getCVHistory, getCVDocuments, loading: trackingLoading } = useTracking();
  const { data: aiUsage } = useAIUsage();
  const isQuotaReached = aiUsage && aiUsage.calls_today >= aiUsage.quota_daily && !aiUsage.has_own_key;
  const [matchData, setMatchData] = useState(null);
  const [cvText, setCvText] = useState('');
  const [showCvInput, setShowCvInput] = useState(false);
  const [cvHistory, setCvHistory] = useState([]);
  const [cvDocuments, setCvDocuments] = useState([]);
  const [selectedCvSource, setSelectedCvSource] = useState('last'); // 'last', 'history', 'manual', 'docs'
  const [selectedCvId, setSelectedCvId] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [expanded, setExpanded] = useState({
    strengths: true,
    gaps: true,
    recommendations: true,
    keywords: false
  });

  const loadExistingScore = useCallback(async () => {
    try {
      const existing = await getMatchingScore(application.id);
      if (existing.has_score) {
        setMatchData(existing.details);
      }
    } catch (err) {
      console.error('Erreur chargement score:', err);
      toast.error('Impossible de charger le score de matching');
    }
  }, [getMatchingScore, application?.id]);

  const loadHistory = useCallback(async () => {
    try {
      const [history, docs] = await Promise.all([
        getCVHistory(),
        getCVDocuments()
      ]);
      setCvHistory(history || []);
      setCvDocuments(docs || []);
    } catch (err) {
      console.error('Erreur chargement historique CV:', err);
    }
  }, [getCVHistory, getCVDocuments]);

  const fetchModels = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${API_URL}/api/ai/available-models`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      const models = data.models || [];
      setAvailableModels(models);
      
      // Set default model if available
      if (data.default_model) {
        setSelectedModel(data.default_model);
      } else if (models.length > 0) {
        const firstAvailable = models.find(m => m.is_available);
        if (firstAvailable) setSelectedModel(firstAvailable);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  }, []);

  useEffect(() => {
    if (isOpen && application?.id) {
      loadExistingScore();
      loadHistory();
      fetchModels();
    }
  }, [isOpen, application?.id, loadExistingScore, loadHistory, fetchModels]);

  const handleCalculate = async () => {
    if (!application.description_poste && !cvText?.trim()) {
      toast.error('Ajoutez une description de poste ou collez votre CV pour lancer l\'analyse');
      return;
    }
    setCalculating(true);
    try {
      const result = await calculateMatchingScore(
        application.id, 
        cvText || null, 
        selectedCvSource === 'docs' ? selectedCvId : null,
        selectedModel?.provider,
        selectedModel?.model_id
      );
      setMatchData(result);
      setShowCvInput(false);
    } catch (err) {
      console.error('Erreur calcul matching:', err);
      toast.error(err?.response?.data?.detail || 'Erreur lors du calcul du matching');
    } finally {
      setCalculating(false);
    }
  };

  const hasJobDescription = !!application.description_poste;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Target className="text-gold" size={24} />
            Score de Matching CV / Offre
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 mt-4 pr-2">
          {/* Application Info */}
          <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-lg">
              {application.entreprise[0]}
            </div>
            <div>
              <h3 className="font-medium text-white">{application.entreprise}</h3>
              <p className="text-gold text-sm">{application.poste}</p>
            </div>
          </div>

          {/* No Job Description Warning */}
          {!hasJobDescription && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <FileText size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium">Description du poste manquante</p>
                  <p className="text-yellow-400/70 text-sm">
                    Ajoutez une description de poste dans les détails de la candidature pour calculer le score de matching.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Score Display */}
          {matchData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-4"
            >
              {/* Main Score */}
              <div className={`p-6 rounded-xl border ${getScoreBgColor(matchData.score)} flex items-center justify-between`}>
                <div>
                  <h3 className={`text-2xl font-bold ${getScoreColor(matchData.score)}`}>
                    {getScoreLabel(matchData.score)}
                  </h3>
                  <p className="text-slate-400 mt-1">{matchData.summary}</p>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <ScoreCircle score={matchData.score} />
                </div>
              </div>

              {/* Strengths */}
              {matchData.strengths?.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, strengths: !e.strengths }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={18} />
                      <span className="font-medium">Points forts ({matchData.strengths.length})</span>
                    </div>
                    {expanded.strengths ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {expanded.strengths && (
                    <ul className="px-4 pb-4 space-y-2">
                      {matchData.strengths.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <CheckCircle size={14} className="text-green-400 mt-1 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Gaps */}
              {matchData.gaps?.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, gaps: !e.gaps }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle size={18} />
                      <span className="font-medium">Lacunes identifiées ({matchData.gaps.length})</span>
                    </div>
                    {expanded.gaps ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {expanded.gaps && (
                    <ul className="px-4 pb-4 space-y-2">
                      {matchData.gaps.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <XCircle size={14} className="text-red-400 mt-1 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {matchData.recommendations?.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, recommendations: !e.recommendations }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2 text-gold">
                      <Lightbulb size={18} />
                      <span className="font-medium">Recommandations ({matchData.recommendations.length})</span>
                    </div>
                    {expanded.recommendations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {expanded.recommendations && (
                    <ul className="px-4 pb-4 space-y-2">
                      {matchData.recommendations.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <Lightbulb size={14} className="text-gold mt-1 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Keywords */}
              {(matchData.keywords_matched?.length > 0 || matchData.keywords_missing?.length > 0) && (
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, keywords: !e.keywords }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2 text-slate-300">
                      <Sparkles size={18} />
                      <span className="font-medium">Mots-clés analysés</span>
                    </div>
                    {expanded.keywords ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {expanded.keywords && (
                    <div className="px-4 pb-4 space-y-3">
                      {matchData.keywords_matched?.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500 mb-2">Trouvés dans votre CV</p>
                          <div className="flex flex-wrap gap-2">
                            {matchData.keywords_matched.map((kw, i) => (
                              <span key={i} className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {matchData.keywords_missing?.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500 mb-2">À ajouter</p>
                          <div className="flex flex-wrap gap-2">
                            {matchData.keywords_missing.map((kw, i) => (
                              <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recalculate Button */}
              <Button 
                onClick={() => {
                  setMatchData(null);
                  setSelectedCvSource('last');
                  setCvText('');
                }}
                variant="outline" 
                className="w-full border-slate-700"
              >
                <RefreshCw className="mr-2" size={16} />
                Recalculer avec un autre CV
              </Button>
            </motion.div>
          )}

          {/* Calculate Form */}
          {!matchData && hasJobDescription && (
            <div className="flex flex-col gap-6">
              {/* Analysis Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CV Source Selection */}
                <div className="bg-slate-800/30 rounded-xl p-4 flex flex-col gap-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                    <FileText size={14} />
                    <span>Source du CV</span>
                  </div>
                  <Select value={selectedCvSource} onValueChange={(val) => {
                    setSelectedCvSource(val);
                    if (val !== 'manual') setShowCvInput(false);
                  }}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-900 transition-colors h-11">
                      <SelectValue placeholder="Choisir un CV..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="last">Dernier CV analysé (Auto)</SelectItem>
                      {cvHistory.length > 0 && (
                        <SelectItem value="history">Analyses récentes</SelectItem>
                      )}
                      {cvDocuments.length > 0 && (
                        <SelectItem value="docs">Documents uploadés</SelectItem>
                      )}
                      <SelectItem value="manual">Texte manuel</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Sub-selectors for history or docs */}
                  {selectedCvSource === 'history' && (
                    <Select onValueChange={(val) => {
                      const analysis = cvHistory.find(h => (h.id || h.filename) === val);
                      if (analysis) setCvText(analysis.extracted_text || '');
                    }}>
                      <SelectTrigger className="bg-slate-900/80 border-slate-700 text-white mt-1 h-9 text-xs">
                        <SelectValue placeholder="Sélectionner une analyse..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {cvHistory.map((h, i) => (
                          <SelectItem key={h.id || i} value={h.id || h.filename}>
                            {h.filename} ({new Date(h.created_at).toLocaleDateString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {selectedCvSource === 'docs' && (
                    <Select onValueChange={(val) => {
                      setSelectedCvId(val);
                      const analysis = cvHistory.find(h => h.document_id === val);
                      if (analysis) {
                        setCvText(analysis.extracted_text || '');
                      } else {
                        setCvText('');
                      }
                    }}>
                      <SelectTrigger className="bg-slate-900/80 border-slate-700 text-white mt-1 h-9 text-xs">
                        <SelectValue placeholder="Sélectionner un document..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {cvDocuments.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.name} {doc.label ? `(${doc.label})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Model Selection */}
                {availableModels.length > 0 && (
                  <div className="bg-slate-800/30 rounded-xl p-4 flex flex-col gap-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                      <Cpu size={14} />
                      <span>Modèle IA</span>
                    </div>
                    <Select 
                      value={selectedModel ? `${selectedModel.provider}:${selectedModel.model_id}` : ''} 
                      onValueChange={(val) => {
                        const [provider, modelId] = val.split(':');
                        const model = availableModels.find(m => m.provider === provider && m.model_id === modelId);
                        if (model) setSelectedModel(model);
                      }}
                    >
                      <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white hover:bg-slate-900 transition-colors h-11">
                        <SelectValue placeholder="Choisir un modèle..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {availableModels.filter(m => m.is_available).map((m) => (
                          <SelectItem key={`${m.provider}:${m.model_id}`} value={`${m.provider}:${m.model_id}`}>
                            <div className="flex flex-col text-left">
                              <span className="font-medium">{m.display_name}</span>
                              <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">{m.provider}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {selectedCvSource === 'manual' && (
                <Textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Collez ici le texte de votre CV..."
                  className="min-h-[150px] bg-slate-900/50 border-slate-700 text-white"
                />
              )}

              <p className="text-sm text-slate-500">
                {selectedCvSource === 'manual' 
                  ? "Le texte fourni sera utilisé pour l'analyse."
                  : selectedCvSource === 'history'
                    ? "L'analyse sélectionnée sera utilisée comme base."
                    : "Le système utilisera automatiquement votre CV le plus récent."
                }
              </p>

              <Button 
                onClick={handleCalculate}
                disabled={calculating || !hasJobDescription || isQuotaReached}
                title={isQuotaReached ? 'Quota journalier atteint' : undefined}
                className="w-full bg-gold hover:bg-gold-light text-[#020817]"
              >
                {calculating ? (
                  <Loader2 className="animate-spin mr-2" size={18} />
                ) : (
                  <Target className="mr-2" size={18} />
                )}
                Calculer le score de matching
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchingScoreModal;
