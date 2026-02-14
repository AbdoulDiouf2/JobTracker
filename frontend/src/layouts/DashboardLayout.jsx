import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Briefcase, Calendar, BarChart3, 
  Settings, LogOut, Menu, X, ChevronRight, User, Sparkles, FolderSync,
  ShieldCheck, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';
import NotificationBell from '../components/NotificationBell';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

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
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center">
              <User size={20} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.full_name}</p>
              <p className="text-slate-500 text-sm truncate">{user?.email}</p>
            </div>
          </div>
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

export default function DashboardLayout() {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
          <NotificationBell />
        </header>

        {/* Desktop header with notification */}
        <header className="hidden lg:flex flex-shrink-0 items-center justify-end p-4 border-b border-slate-800 bg-[#020817]">
          <NotificationBell />
        </header>

        {/* Main content - only this part scrolls */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
