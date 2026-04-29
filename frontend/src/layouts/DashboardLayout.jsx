import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Briefcase, Calendar, BarChart3, 
  Settings, LogOut, Menu, X, ChevronRight, User, Sparkles, FolderSync,
  ShieldCheck, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';
import NotificationBell from '../components/NotificationBell';
import RefreshButton from '../components/RefreshButton';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import { useReminders } from '../hooks/useReminders';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { useAIUsage } from '../hooks/useAIUsage';
import { Sparkles as SparklesIcon, Search, Command } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import CommandPalette from '../components/CommandPalette';


const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { language } = useLanguage();

  const t = {
    fr: {
      dashboard: 'Tableau de bord',
      applications: 'Candidatures',
      interviews: 'Entretiens',
      statistics: 'Statistiques',
      aiAdvisor: 'Assistant IA',
      documents: 'Documents',
      importExport: 'Import/Export',
      settings: 'Paramètres',
      logout: 'Déconnexion',
      admin: 'Administration'
    },
    en: {
      dashboard: 'Dashboard',
      applications: 'Applications',
      interviews: 'Interviews',
      statistics: 'Statistics',
      aiAdvisor: 'AI Assistant',
      documents: 'Documents',
      importExport: 'Import/Export',
      settings: 'Settings',
      logout: 'Logout',
      admin: 'Administration'
    }
  }[language];

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t.dashboard },
    { path: '/dashboard/applications', icon: Briefcase, label: t.applications },
    { path: '/dashboard/interviews', icon: Calendar, label: t.interviews },
    { path: '/dashboard/statistics', icon: BarChart3, label: t.statistics },
    { path: '/dashboard/ai-advisor', icon: Sparkles, label: t.aiAdvisor },
    { path: '/dashboard/documents', icon: FileText, label: t.documents },
    { path: '/dashboard/import-export', icon: FolderSync, label: t.importExport },
    { path: '/dashboard/settings', icon: Settings, label: t.settings },
  ];

  // Add admin link if user is admin
  if (isAdmin) {
    navItems.push({ path: '/admin', icon: ShieldCheck, label: t.admin, isAdmin: true });
  }

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/admin') return location.pathname.startsWith('/admin');
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Overlay mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0a0f1a] border-r border-slate-800 flex flex-col h-screen
          transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo - Fixed at top */}
        <div className="flex-shrink-0 p-6 border-b border-slate-800 flex justify-center">
          <Link to="/" className="flex items-center gap-3">
            <img 
              src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" 
              alt="MAADEC" 
              className="h-32"
            />
          </Link>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive(item.path) 
                  ? item.isAdmin 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-gold/10 text-gold border border-gold/20' 
                  : item.isAdmin
                    ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
              {isActive(item.path) && <ChevronRight size={16} className="ml-auto" />}
            </Link>
          ))}
        </nav>

        {/* User & Logout - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-[#0a0f1a]">
          <Link
            to="/dashboard/profile"
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-3 mb-2 rounded-xl transition-all duration-200 group
              ${location.pathname === '/dashboard/profile'
                ? 'bg-gold/10 border border-gold/20'
                : 'hover:bg-slate-800/50'
              }`}
          >
            <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center shrink-0">
              <User size={20} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate transition-colors ${location.pathname === '/dashboard/profile' ? 'text-gold' : 'text-white group-hover:text-white'}`}>
                {user?.full_name ? (() => {
                  const parts = user.full_name.trim().split(/\s+/);
                  if (parts.length <= 2) return user.full_name;
                  return `${parts[0]} ${parts[parts.length - 1]}`;
                })() : ''}
              </p>
              <p className="text-slate-500 text-sm truncate">{user?.email}</p>
            </div>
            <ChevronRight size={14} className={`shrink-0 transition-colors ${location.pathname === '/dashboard/profile' ? 'text-gold' : 'text-slate-600 group-hover:text-slate-400'}`} />
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">{t.logout}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

const AICreditsIndicator = () => {
  const { data: aiUsage } = useAIUsage();
  const { language } = useLanguage();

  if (!aiUsage || aiUsage.has_own_key) return null;

  const remaining = aiUsage.quota_daily - aiUsage.calls_today;
  const pct = (remaining / aiUsage.quota_daily) * 100;
  const color = pct > 50 ? 'text-green-400' : pct > 20 ? 'text-yellow-400' : 'text-red-400';
  const bgColor = pct > 50 ? 'bg-green-400' : pct > 20 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${pct > 50 ? 'border-green-500/20 bg-green-500/5' : pct > 20 ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-red-500/20 bg-red-500/5'}`}
      title={language === 'fr' ? `${remaining} requêtes IA restantes aujourd'hui` : `${remaining} AI requests left today`}
    >
      <SparklesIcon size={12} className={color} />
      <span className={`text-xs font-medium tabular-nums ${color}`}>{remaining}</span>
      <div className="flex gap-px">
        {Array.from({ length: aiUsage.quota_daily }).map((_, i) => (
          <div
            key={i}
            className={`w-1 h-2 rounded-sm ${i < remaining ? bgColor : 'bg-slate-700'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default function DashboardLayout() {
  const { isAuthenticated, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Process interview reminders automatically
  useReminders();

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Keyboard shortcut for palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // Swipe gesture handlers for mobile
  const handleSwipeRight = useCallback(() => {
    // Only open sidebar on mobile (when it's not already open)
    if (window.innerWidth < 1024 && !sidebarOpen) {
      setSidebarOpen(true);
    }
  }, [sidebarOpen]);

  const handleSwipeLeft = useCallback(() => {
    // Close sidebar on swipe left
    if (window.innerWidth < 1024 && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen]);

  // Enable swipe gestures - swipe from left edge to open, swipe anywhere to close
  useSwipeGesture({
    onSwipeRight: handleSwipeRight,
    onSwipeLeft: handleSwipeLeft,
    minSwipeDistance: 40, // Réduire la distance minimale pour plus de réactivité
    maxSwipeTime: 600,
    edgeWidth: 100, // 100px depuis le bord gauche pour ouvrir le menu
    edgeOnly: !sidebarOpen, // Only require edge swipe when sidebar is closed
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.onboarding_completed === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="h-screen bg-[#020817] flex overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-800 bg-[#0a0f1a]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-white"
            data-testid="mobile-menu-btn"
          >
            <Menu size={24} />
          </button>
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <img 
              src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" 
              alt="MAADEC" 
              className="h-12"
            />
          </Link>
          <div className="flex items-center gap-2">
            <AICreditsIndicator />
            <RefreshButton />
            <NotificationBell />
          </div>
        </header>

        {/* Desktop header with search and breadcrumbs */}
        <header className="hidden lg:flex flex-shrink-0 items-center justify-between p-4 border-b border-slate-800 bg-[#020817] sticky top-0 z-30">
          <div className="flex-1 flex items-center gap-8">
            <Breadcrumbs />
            <button 
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 transition-all w-full max-w-sm group"
            >
              <Search size={16} className="group-hover:text-gold transition-colors" />
              <span className="text-sm flex-1 text-left">Rechercher...</span>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono">
                <Command size={10} /> K
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <AICreditsIndicator />
            <RefreshButton />
            <NotificationBell />
          </div>
        </header>


        {/* Main content - only this part scrolls */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Command Palette */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
    </div>

  );
}
