import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Briefcase, Calendar, BarChart3, 
  Sparkles, Settings, User, ShieldCheck,
  Plus, FileText, FolderSync, Command, X,
  ExternalLink, ArrowRight, MessageSquare,
  LogOut, LayoutDashboard, Bell
} from 'lucide-react';


import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';

const CommandPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();

  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const t = {
    fr: {
      placeholder: 'Rechercher une page, une entreprise...',
      pages: 'Pages',
      data: 'Données',
      noResults: 'Aucun résultat trouvé',
      actions: 'Actions rapides',
      searchHint: 'Utilisez les flèches pour naviguer, Entrée pour valider',
      types: {
        application: 'Candidature',
        interview: 'Entretien',
        user: 'Utilisateur',
        page: 'Page'
      }
    },
    en: {
      placeholder: 'Search for a page, a company...',
      pages: 'Pages',
      data: 'Data',
      noResults: 'No results found',
      actions: 'Quick actions',
      searchHint: 'Use arrows to navigate, Enter to select',
      types: {
        application: 'Application',
        interview: 'Interview',
        user: 'User',
        page: 'Page'
      }
    }
  }[language];

  const staticPages = [
    { id: 'p1', type: 'page', title: language === 'fr' ? 'Tableau de bord' : 'Dashboard', icon: LayoutDashboard, url: '/dashboard', keywords: 'home accueil' },
    { id: 'p2', type: 'page', title: language === 'fr' ? 'Mes Candidatures' : 'Applications', icon: Briefcase, url: '/dashboard/applications', keywords: 'jobs offres postuler' },
    { id: 'p3', type: 'page', title: language === 'fr' ? 'Entretiens' : 'Interviews', icon: Calendar, url: '/dashboard/interviews', keywords: 'rdv meeting' },
    { id: 'p4', type: 'page', title: language === 'fr' ? 'Statistiques' : 'Statistics', icon: BarChart3, url: '/dashboard/statistics', keywords: 'charts graphiques analyse' },
    { id: 'p5', type: 'page', title: language === 'fr' ? 'Assistant IA' : 'AI Advisor', icon: Sparkles, url: '/dashboard/ai-advisor', keywords: 'ia bot conseil' },
    { id: 'p6', type: 'page', title: language === 'fr' ? 'Documents' : 'Documents', icon: FileText, url: '/dashboard/documents', keywords: 'cv lettre motivation' },
    { id: 'p7', type: 'page', title: language === 'fr' ? 'Import/Export' : 'Import/Export', icon: FolderSync, url: '/dashboard/import-export', keywords: 'csv data excel' },
    { id: 'p8', type: 'page', title: language === 'fr' ? 'Paramètres' : 'Settings', icon: Settings, url: '/dashboard/settings', keywords: 'compte theme dark' },
    { id: 'p9', type: 'page', title: language === 'fr' ? 'Profil' : 'Profile', icon: User, url: '/dashboard/profile', keywords: 'me moi' },
    { id: 'p_logout', type: 'action', title: language === 'fr' ? 'Déconnexion' : 'Logout', icon: LogOut, action: 'logout', keywords: 'quitter exit' },
  ];

  if (isAdmin) {
    staticPages.push({ id: 'p10', type: 'page', title: 'Admin : Dashboard', icon: ShieldCheck, url: '/admin' });
    staticPages.push({ id: 'p11', type: 'page', title: 'Admin : Utilisateurs', icon: ShieldCheck, url: '/admin/users' });
    staticPages.push({ id: 'p12', type: 'page', title: 'Admin : Support', icon: MessageSquare, url: '/admin/support' });
  }

  const searchData = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://job-tracker-steel-eight.vercel.app'}/api/search/global?q=${encodeURIComponent(searchQuery)}`, {

        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error.message || error);
    } finally {

      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchData(query);
      else setResults([]);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchData]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredPages = staticPages.filter(page => 
    page.title.toLowerCase().includes(query.toLowerCase()) ||
    (page.keywords && page.keywords.toLowerCase().includes(query.toLowerCase()))
  );


  const allItems = [...filteredPages, ...results];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % allItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelect(allItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (item) => {
    if (item.action === 'logout') {
      logout();
      onClose();
      return;
    }
    navigate(item.url);
    onClose();
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Palette Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-slate-800">
          <Search size={20} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            className="flex-1 px-4 py-5 bg-transparent border-none text-white focus:outline-none text-lg"
          />
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent" />
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400 font-mono">
              <Command size={10} /> K
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="max-h-[500px] overflow-y-auto p-2 custom-scrollbar">

          {allItems.length === 0 && query && (
            <div className="p-8 text-center text-slate-500">
              <X size={40} className="mx-auto mb-3 opacity-20" />
              <p>{t.noResults}</p>
            </div>
          )}

          {allItems.length === 0 && !query && (
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                {t.pages}
              </p>
              {staticPages.map((page, idx) => (
                <ResultItem 
                  key={page.id} 
                  item={page} 
                  isSelected={selectedIndex === idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelect(page)}
                  language={language}
                />
              ))}
            </div>
          )}

          {query && (
            <div className="p-2 space-y-4">
              {filteredPages.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                    {t.pages}
                  </p>
                  {filteredPages.map((page, idx) => (
                    <ResultItem 
                      key={page.id} 
                      item={page} 
                      isSelected={selectedIndex === idx}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelect(page)}
                      language={language}
                    />
                  ))}
                </div>
              )}

              {results.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                    {t.data}
                  </p>
                  {results.map((result, idx) => (
                    <ResultItem 
                      key={result.id} 
                      item={result} 
                      isSelected={selectedIndex === idx + filteredPages.length}
                      onMouseEnter={() => setSelectedIndex(idx + filteredPages.length)}
                      onClick={() => handleSelect(result)}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono">↑↓</kbd> Naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono">Enter</kbd> Ouvrir
            </span>
          </div>
          <span>{t.searchHint}</span>
        </div>
      </motion.div>
    </div>
  );
};

const ResultItem = ({ item, isSelected, onMouseEnter, onClick, language }) => {
  const getIcon = () => {
    if (item.icon) return item.icon;
    switch (item.type) {
      case 'application': return Briefcase;
      case 'interview': return Calendar;
      case 'document': return FileText;
      case 'letter': return Sparkles;
      case 'notification': return Bell;
      case 'user': return User;
      case 'support': return MessageSquare;
      default: return Search;
    }
  };

  const Icon = getIcon();
  
  const getTypeLabel = () => {
    const labels = {
      fr: {
        application: 'Candidature',
        interview: 'Entretien',
        document: 'Document',
        letter: 'Lettre IA',
        notification: 'Alerte',
        user: 'Utilisateur',
        support: 'Ticket',
        page: 'Page',
        action: 'Action'
      },
      en: {
        application: 'Application',
        interview: 'Interview',
        document: 'Document',
        letter: 'AI Letter',
        notification: 'Alert',
        user: 'User',
        support: 'Ticket',
        page: 'Page',
        action: 'Action'
      }
    };
    return labels[language]?.[item.type] || item.type;
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
        ${isSelected ? 'bg-gold/10 text-gold border border-gold/20' : 'text-slate-300 hover:bg-slate-800/50 border border-transparent'}
      `}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
        ${isSelected ? 'bg-gold/20 text-gold' : 'bg-slate-800 text-slate-400'}
      `}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-medium truncate">{item.title}</p>
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold
            ${isSelected ? 'bg-gold/20 text-gold' : 'bg-slate-800 text-slate-500'}
          `}>
            {getTypeLabel()}
          </span>
        </div>
        <p className={`text-xs truncate ${isSelected ? 'text-gold/70' : 'text-slate-500'}`}>
          {item.subtitle}
        </p>
      </div>
      {isSelected && (
        <ArrowRight size={14} className="text-gold animate-pulse" />
      )}
    </div>
  );
};

export default CommandPalette;
