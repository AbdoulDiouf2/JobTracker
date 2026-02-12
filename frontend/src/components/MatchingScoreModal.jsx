import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, CheckCircle, XCircle, Lightbulb, Loader2, RefreshCw,
  ChevronDown, ChevronUp, FileText, Sparkles
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
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-700"
        />
        {/* Progress circle */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className={getScoreColor(score)}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</span>
        <span className="text-xs text-slate-400">compatibilité</span>
      </div>
    </div>
  );
};

export const MatchingScoreModal = ({ application, isOpen, onClose }) => {
  const { calculateMatchingScore, getMatchingScore, loading } = useTracking();
  const [matchData, setMatchData] = useState(null);
  const [cvText, setCvText] = useState('');
  const [showCvInput, setShowCvInput] = useState(false);
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
    }
  }, [getMatchingScore, application?.id]);

  useEffect(() => {
    if (isOpen && application?.id) {
      loadExistingScore();
    }
  }, [isOpen, application?.id, loadExistingScore]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const result = await calculateMatchingScore(application.id, cvText || null);
      setMatchData(result);
      setShowCvInput(false);
    } catch (err) {
      console.error('Erreur calcul matching:', err);
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

        <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
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
              className="space-y-4"
            >
              {/* Main Score */}
              <div className={`p-6 rounded-xl border ${getScoreBgColor(matchData.score)} flex items-center justify-between`}>
                <div>
                  <h3 className={`text-2xl font-bold ${getScoreColor(matchData.score)}`}>
                    {getScoreLabel(matchData.score)}
                  </h3>
                  <p className="text-slate-400 mt-1">{matchData.summary}</p>
                </div>
                <ScoreCircle score={matchData.score} />
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
                onClick={() => setMatchData(null)}
                variant="outline" 
                className="w-full border-slate-700"
              >
                <RefreshCw className="mr-2" size={16} />
                Recalculer le score
              </Button>
            </motion.div>
          )}

          {/* Calculate Form */}
          {!matchData && hasJobDescription && (
            <div className="space-y-4">
              {/* CV Input Toggle */}
              <button
                onClick={() => setShowCvInput(!showCvInput)}
                className="w-full p-4 bg-slate-800/30 rounded-xl flex items-center justify-between hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-slate-400" />
                  <span className="text-white">Fournir le texte du CV (optionnel)</span>
                </div>
                {showCvInput ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {showCvInput && (
                <Textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Collez ici le texte de votre CV..."
                  className="min-h-[150px] bg-slate-900/50 border-slate-700 text-white"
                />
              )}

              <p className="text-sm text-slate-500">
                {showCvInput 
                  ? "Le texte fourni sera utilisé pour l'analyse."
                  : "Si vous ne fournissez pas de CV, le dernier CV analysé sera utilisé."
                }
              </p>

              <Button 
                onClick={handleCalculate}
                disabled={calculating || !hasJobDescription}
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
