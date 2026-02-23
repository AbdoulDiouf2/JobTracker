import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Bot, User, Loader2, Sparkles, MessageSquare, Trash2, Settings2, ChevronDown,
  Upload, Award, Target, TrendingUp, CheckCircle, AlertCircle, Briefcase, Lightbulb, FileUp,
  History, FileText, Clock, Eye, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import axios from 'axios';
import Markdown from 'react-markdown';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AIAdvisorPage() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('advisor'); // 'advisor', 'chatbot', 'cv'
  const [sessionId, setSessionId] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelUsed, setModelUsed] = useState(null);
  
  // CV Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState(null);
  const [cvHistory, setCvHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [existingCVs, setExistingCVs] = useState([]);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const cvInputRef = useRef(null);
  
  const messagesEndRef = useRef(null);

  const t = {
    fr: {
      title: 'Assistant IA',
      subtitle: 'Votre conseiller carrière personnel',
      advisorTab: 'Conseiller Carrière',
      chatbotTab: 'Assistant',
      cvTab: 'Analyse CV',
      placeholder: 'Posez votre question...',
      send: 'Envoyer',
      clearChat: 'Effacer',
      welcomeAdvisor: 'Bonjour ! Je suis votre conseiller carrière IA. Je peux analyser vos candidatures et vous donner des conseils personnalisés. Que souhaitez-vous savoir ?',
      welcomeChatbot: 'Bonjour ! Je suis votre assistant IA. Je peux vous aider avec la rédaction de CV, la préparation d\'entretiens, et bien plus. Comment puis-je vous aider ?',
      suggestionsTitle: 'Suggestions',
      suggestions: [
        'Analyse mes candidatures et donne-moi des conseils',
        'Comment améliorer mon taux de réponse ?',
        'Aide-moi à préparer un entretien technique',
        'Comment négocier mon salaire ?'
      ],
      selectModel: 'Sélectionner un modèle',
      noModels: 'Aucun modèle disponible. Configurez vos clés API dans les paramètres.',
      modelUsed: 'Modèle utilisé',
      // CV Analysis Translations
      cvTitle: 'Analyse de CV',
      cvDesc: 'Analysez votre CV avec l\'IA',
      uploadCv: 'Uploader un nouveau CV',
      selectExistingCv: 'Ou choisir un CV existant',
      selectCvPlaceholder: 'Sélectionner un CV...',
      noCvAvailable: 'Aucun CV disponible',
      cvFormats: 'Formats: PDF, DOCX, TXT',
      analyzing: 'Analyse en cours...',
      score: 'Score global',
      summary: 'Résumé',
      skills: 'Compétences détectées',
      strengths: 'Points forts',
      improvements: 'Améliorations suggérées',
      matchingJobs: 'Postes recommandés',
      recommendations: 'Recommandations',
      experience: 'Années d\'expérience',
      analyzeSelected: 'Analyser ce CV',
      history: 'Historique des analyses',
      viewHistory: 'Voir l\'historique',
      hideHistory: 'Masquer l\'historique',
      noHistory: 'Aucune analyse précédente',
      viewAnalysis: 'Voir l\'analyse',
      deleteAnalysis: 'Supprimer',
      analyzedOn: 'Analysé le',
      usedModel: 'Modèle utilisé'
    },
    en: {
      title: 'AI Assistant',
      subtitle: 'Your personal career advisor',
      advisorTab: 'Career Advisor',
      chatbotTab: 'Assistant',
      cvTab: 'CV Analysis',
      placeholder: 'Ask your question...',
      send: 'Send',
      clearChat: 'Clear',
      welcomeAdvisor: 'Hello! I\'m your AI career advisor. I can analyze your applications and give you personalized advice. What would you like to know?',
      welcomeChatbot: 'Hello! I\'m your AI assistant. I can help you with CV writing, interview preparation, and more. How can I help you?',
      suggestionsTitle: 'Suggestions',
      suggestions: [
        'Analyze my applications and give me advice',
        'How can I improve my response rate?',
        'Help me prepare for a technical interview',
        'How to negotiate my salary?'
      ],
      selectModel: 'Select a model',
      noModels: 'No models available. Configure your API keys in settings.',
      modelUsed: 'Model used',
      // CV Analysis Translations
      cvTitle: 'CV Analysis',
      cvDesc: 'Analyze your CV with AI',
      uploadCv: 'Upload a new CV',
      selectExistingCv: 'Or choose an existing CV',
      selectCvPlaceholder: 'Select a CV...',
      noCvAvailable: 'No CV available',
      cvFormats: 'Formats: PDF, DOCX, TXT',
      analyzing: 'Analyzing...',
      score: 'Overall score',
      summary: 'Summary',
      skills: 'Detected skills',
      strengths: 'Strengths',
      improvements: 'Suggested improvements',
      matchingJobs: 'Recommended jobs',
      recommendations: 'Recommendations',
      experience: 'Years of experience',
      analyzeSelected: 'Analyze this CV',
      history: 'Analysis history',
      viewHistory: 'View history',
      hideHistory: 'Hide history',
      noHistory: 'No previous analysis',
      viewAnalysis: 'View analysis',
      deleteAnalysis: 'Delete',
      analyzedOn: 'Analyzed on',
      usedModel: 'Model used'
    }
  }[language];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/ai/available-models`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAvailableModels(response.data.models || []);
        if (response.data.default_model) {
          setSelectedModel(response.data.default_model);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };
    fetchModels();
  }, []);

  // Fetch existing CVs and history when CV tab is active
  useEffect(() => {
    if (activeTab === 'cv') {
      fetchExistingCVs();
      fetchCVHistory();
    }
  }, [activeTab]);

  const fetchExistingCVs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/documents/cv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExistingCVs(response.data || []);
    } catch (error) {
      console.error('Error fetching CVs:', error);
    }
  };

  const fetchCVHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/import/cv-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCvHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching CV history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/import/cv-history/${analysisId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCVHistory();
    } catch (error) {
      console.error('Error deleting analysis:', error);
    }
  };

  const handleViewHistoryAnalysis = (analysis) => {
    setCvAnalysis(analysis.analysis);
    setShowHistory(false);
  };

  useEffect(() => {
    // Reset messages when switching tabs
    if (activeTab !== 'cv') {
      setMessages([{
        role: 'assistant',
        content: activeTab === 'advisor' ? t.welcomeAdvisor : t.welcomeChatbot
      }]);
      setSessionId(null);
    }
  }, [activeTab, t.welcomeAdvisor, t.welcomeChatbot]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const endpoint = activeTab === 'advisor' ? '/api/ai/career-advisor' : '/api/ai/chatbot';
      const payload = activeTab === 'advisor' 
        ? { 
            question: input, 
            include_applications: true,
            model_provider: selectedModel?.provider,
            model_name: selectedModel?.model_id
          }
        : { 
            message: input, 
            session_id: sessionId,
            model_provider: selectedModel?.provider,
            model_name: selectedModel?.model_id
          };

      const response = await axios.post(`${API_URL}${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.advice || response.data.response
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (response.data.session_id) {
        setSessionId(response.data.session_id);
      }
      if (response.data.model_used) {
        setModelUsed(response.data.model_used);
      }
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'fr' 
          ? 'Désolé, une erreur est survenue. Veuillez réessayer.'
          : 'Sorry, an error occurred. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: activeTab === 'advisor' ? t.welcomeAdvisor : t.welcomeChatbot
    }]);
    setSessionId(null);
    setModelUsed(null);
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setCvAnalysis(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      // Pass selected model if available
      if (selectedModel) {
        formData.append('model_provider', selectedModel.provider);
        formData.append('model_name', selectedModel.model_id);
      }

      const response = await axios.post(`${API_URL}/api/import/analyze-cv`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setCvAnalysis(response.data);
    } catch (error) {
      console.error('CV Analysis error:', error);
      setCvAnalysis({
        score: 0,
        summary: error.response?.data?.detail || 'Erreur lors de l\'analyse',
        skills: [],
        strengths: [],
        improvements: [],
        matching_jobs: [],
        recommendations: ''
      });
    } finally {
      setAnalyzing(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  // Group models by provider
  const modelsByProvider = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {});

  const providerLabels = {
    openai: 'OpenAI',
    google: 'Google',
    groq: 'Groq'
  };

  const providerColors = {
    openai: 'text-green-400',
    google: 'text-blue-400',
    groq: 'text-orange-400'
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col" data-testid="ai-advisor-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-gold" size={28} />
            {t.title}
          </h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        
        {/* Tab Toggle & Model Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Model Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-700 text-slate-300 gap-2 justify-between sm:justify-center">
                <div className="flex items-center gap-2">
                  <Settings2 size={16} />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    {selectedModel ? selectedModel.display_name : t.selectModel}
                  </span>
                </div>
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-700 w-64">
              {Object.keys(modelsByProvider).length === 0 ? (
                <div className="p-3 text-xs text-slate-500">{t.noModels}</div>
              ) : (
                Object.entries(modelsByProvider).map(([provider, models]) => (
                  <div key={provider}>
                    <DropdownMenuLabel className={`${providerColors[provider]} font-semibold flex items-center justify-between`}>
                      <span>{providerLabels[provider]}</span>
                      {models[0]?.key_source === 'platform' && (
                        <span className="text-xs text-slate-500 font-normal">(plateforme)</span>
                      )}
                      {models[0]?.key_source === 'user' && (
                        <span className="text-xs text-green-500 font-normal">(votre clé)</span>
                      )}
                    </DropdownMenuLabel>
                    {models.map((model) => (
                      <DropdownMenuItem
                        key={model.model_id}
                        onClick={() => setSelectedModel(model)}
                        className={`cursor-pointer ${!model.is_available ? 'opacity-50' : ''} ${
                          selectedModel?.model_id === model.model_id ? 'bg-slate-800' : ''
                        }`}
                        disabled={!model.is_available}
                      >
                        <div className="flex flex-col">
                          <span className="text-white">{model.display_name}</span>
                          <span className="text-xs text-slate-500">{model.description}</span>
                        </div>
                        {selectedModel?.model_id === model.model_id && (
                          <span className="ml-auto text-gold">✓</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-slate-700" />
                  </div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('advisor')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
                ${activeTab === 'advisor' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
            >
              <Sparkles size={16} />
              <span className="whitespace-nowrap">{t.advisorTab}</span>
            </button>
            <button
              onClick={() => setActiveTab('chatbot')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
                ${activeTab === 'chatbot' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
            >
              <MessageSquare size={16} />
              <span className="whitespace-nowrap">{t.chatbotTab}</span>
            </button>
            <button
              onClick={() => setActiveTab('cv')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
                ${activeTab === 'cv' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
            >
              <FileUp size={16} />
              <span className="whitespace-nowrap">{t.cvTab}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'cv' ? (
          // CV Analysis View
          <motion.div
            key="cv"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 overflow-y-auto space-y-6"
          >
            {/* Upload Section */}
            <div className="glass-card rounded-xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center">
                  <Sparkles className="text-gold" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{t.cvTitle}</h2>
                  <p className="text-slate-400 text-sm">{t.cvDesc}</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-gold/50 transition-colors">
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleCVUpload}
                  className="hidden"
                  id="cv-file"
                />
                <label htmlFor="cv-file" className="cursor-pointer">
                  <FileUp size={48} className="mx-auto text-gold/50 mb-4" />
                  <p className="text-white font-medium mb-2">{t.uploadCv}</p>
                  <p className="text-slate-500 text-sm">{t.cvFormats}</p>
                </label>
              </div>

              {analyzing && (
                <div className="mt-4 flex items-center justify-center gap-3 text-gold py-8">
                  <Loader2 className="animate-spin" size={24} />
                  <span className="text-lg">{t.analyzing}</span>
                </div>
              )}
            </div>

            {/* Analysis Results */}
            {cvAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 pb-6"
              >
                {/* Score Card */}
                <div className="glass-card rounded-xl border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Award className="text-gold" size={28} />
                      <h3 className="text-xl font-semibold text-white">{t.score}</h3>
                    </div>
                    <div className={`text-5xl font-bold ${getScoreColor(cvAnalysis.score)}`}>
                      {cvAnalysis.score}
                      <span className="text-2xl text-slate-500">/100</span>
                    </div>
                  </div>
                  <Progress value={cvAnalysis.score} className="h-3" />
                  {cvAnalysis.experience_years && (
                    <p className="text-slate-400 mt-4">
                      {t.experience}: <span className="text-white font-medium">{cvAnalysis.experience_years} ans</span>
                    </p>
                  )}
                </div>

                {/* Summary */}
                {cvAnalysis.summary && (
                  <div className="glass-card rounded-xl border border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Target className="text-blue-400" size={20} />
                      {t.summary}
                    </h3>
                    <p className="text-slate-300 leading-relaxed">{cvAnalysis.summary}</p>
                  </div>
                )}

                {/* Skills */}
                {cvAnalysis.skills?.length > 0 && (
                  <div className="glass-card rounded-xl border border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <TrendingUp className="text-green-400" size={20} />
                      {t.skills}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {cvAnalysis.skills.map((skill, i) => (
                        <span key={i} className="px-3 py-1.5 bg-slate-800 rounded-full text-sm text-slate-300">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Improvements */}
                <div className="grid md:grid-cols-2 gap-6">
                  {cvAnalysis.strengths?.length > 0 && (
                    <div className="glass-card rounded-xl border border-green-500/30 p-6">
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <CheckCircle size={20} />
                        {t.strengths}
                      </h3>
                      <ul className="space-y-2">
                        {cvAnalysis.strengths.map((item, i) => (
                          <li key={i} className="text-slate-300 flex items-start gap-2">
                            <span className="text-green-400 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {cvAnalysis.improvements?.length > 0 && (
                    <div className="glass-card rounded-xl border border-yellow-500/30 p-6">
                      <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                        <AlertCircle size={20} />
                        {t.improvements}
                      </h3>
                      <ul className="space-y-2">
                        {cvAnalysis.improvements.map((item, i) => (
                          <li key={i} className="text-slate-300 flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Matching Jobs */}
                {cvAnalysis.matching_jobs?.length > 0 && (
                  <div className="glass-card rounded-xl border border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Briefcase className="text-gold" size={20} />
                      {t.matchingJobs}
                    </h3>
                    <div className="space-y-3">
                      {cvAnalysis.matching_jobs.map((job, i) => (
                        <div key={i} className="p-4 bg-slate-800/50 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white font-medium">{job.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              job.match_score >= 80 ? 'bg-green-500/20 text-green-400' :
                              job.match_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {job.match_score}% match
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm">{job.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {cvAnalysis.recommendations && (
                  <div className="glass-card rounded-xl border border-gold/30 p-6">
                    <h3 className="text-lg font-semibold text-gold mb-3 flex items-center gap-2">
                      <Lightbulb size={20} />
                      {t.recommendations}
                    </h3>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{cvAnalysis.recommendations}</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          // Chat View (Advisor & Chatbot)
          <div className="flex-1 flex flex-col glass-card rounded-xl border border-slate-800 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center flex-shrink-0">
                        <Bot size={18} className="text-gold" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-gold text-[#020817]' 
                        : 'bg-slate-800/80 text-white'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none prose-headings:text-gold prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-white prose-a:text-gold">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-slate-300" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                    <Bot size={18} className="text-gold" />
                  </div>
                  <div className="bg-slate-800/80 rounded-xl px-4 py-3">
                    <Loader2 className="animate-spin text-gold" size={20} />
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions (show only at start) */}
            {messages.length <= 1 && (
              <div className="px-4 pb-4">
                <p className="text-slate-500 text-xs mb-2">{t.suggestionsTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {t.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-full text-xs text-slate-300 hover:text-white transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
              {modelUsed && (
                <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Settings2 size={12} />
                  {t.modelUsed}: <span className="text-gold">{modelUsed}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={clearChat}
                  className="border-slate-700 text-slate-400 hover:text-red-400"
                  title={t.clearChat}
                >
                  <Trash2 size={18} />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={t.placeholder}
                  className="flex-1 bg-slate-800/50 border-slate-700 text-white"
                  disabled={loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="bg-gold hover:bg-gold-light text-[#020817]"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
