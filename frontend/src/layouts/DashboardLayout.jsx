import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Briefcase, Calendar, BarChart3, 
  Settings, LogOut, Menu, X, ChevronRight, User, Sparkles, FolderSync
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { language } = useLanguage();

  const t = {
    fr: {
      dashboard: 'Tableau de bord',
      applications: 'Candidatures',
      interviews: 'Entretiens',
      statistics: 'Statistiques',
      aiAdvisor: 'Assistant IA',
      importExport: 'Import/Export',
      settings: 'Paramètres',
      logout: 'Déconnexion'
    },
    en: {
      dashboard: 'Dashboard',
      applications: 'Applications',
      interviews: 'Interviews',
      statistics: 'Statistics',
      aiAdvisor: 'AI Assistant',
      importExport: 'Import/Export',
      settings: 'Settings',
      logout: 'Logout'
    }
  }[language];

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t.dashboard },
    { path: '/dashboard/applications', icon: Briefcase, label: t.applications },
    { path: '/dashboard/interviews', icon: Calendar, label: t.interviews },
    { path: '/dashboard/statistics', icon: BarChart3, label: t.statistics },
    { path: '/dashboard/ai-advisor', icon: Sparkles, label: t.aiAdvisor },
    { path: '/dashboard/settings', icon: Settings, label: t.settings },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0a0f1a] border-r border-slate-800 flex flex-col
          transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_careernav-3/artifacts/2hooa0lk_logo_maadec_copie.png" 
              alt="MAADEC" 
              className="h-10"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive(item.path) 
                  ? 'bg-gold/10 text-gold border border-gold/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
              {isActive(item.path) && <ChevronRight size={16} className="ml-auto" />}
            </Link>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-slate-800">
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
    <div className="min-h-screen bg-[#020817] flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-[#0a0f1a]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-white"
            data-testid="mobile-menu-btn"
          >
            <Menu size={24} />
          </button>
          <img 
            src="https://customer-assets.emergentagent.com/job_careernav-3/artifacts/2hooa0lk_logo_maadec_copie.png" 
            alt="MAADEC" 
            className="h-8"
          />
          <div className="w-10" />
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
