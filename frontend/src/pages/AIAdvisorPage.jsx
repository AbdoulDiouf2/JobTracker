import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Sparkles, MessageSquare, Trash2, Settings2, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import axios from 'axios';
import Markdown from 'react-markdown';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AIAdvisorPage() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('advisor'); // 'advisor' or 'chatbot'
  const [sessionId, setSessionId] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelUsed, setModelUsed] = useState(null);
  const messagesEndRef = useRef(null);

  const t = {
    fr: {
      title: 'Assistant IA',
      subtitle: 'Votre conseiller carrière personnel',
      advisorTab: 'Conseiller Carrière',
      chatbotTab: 'Assistant',
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
      modelUsed: 'Modèle utilisé'
    },
    en: {
      title: 'AI Assistant',
      subtitle: 'Your personal career advisor',
      advisorTab: 'Career Advisor',
      chatbotTab: 'Assistant',
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
      modelUsed: 'Model used'
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

  useEffect(() => {
    // Reset messages when switching tabs
    setMessages([{
      role: 'assistant',
      content: activeTab === 'advisor' ? t.welcomeAdvisor : t.welcomeChatbot
    }]);
    setSessionId(null);
  }, [activeTab]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-gold" size={28} />
            {t.title}
          </h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        
        {/* Tab Toggle */}
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-700 text-slate-300 gap-2">
                <Settings2 size={16} />
                {selectedModel ? selectedModel.display_name : t.selectModel}
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-700 w-64">
              {Object.keys(modelsByProvider).length === 0 ? (
                <div className="p-3 text-xs text-slate-500">{t.noModels}</div>
              ) : (
                Object.entries(modelsByProvider).map(([provider, models]) => (
                  <div key={provider}>
                    <DropdownMenuLabel className={`${providerColors[provider]} font-semibold`}>
                      {providerLabels[provider]}
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
          
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('advisor')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                ${activeTab === 'advisor' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
            >
              <Sparkles size={16} />
              {t.advisorTab}
            </button>
            <button
              onClick={() => setActiveTab('chatbot')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                ${activeTab === 'chatbot' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
            >
              <MessageSquare size={16} />
              {t.chatbotTab}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Container */}
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
    </div>
  );
}
