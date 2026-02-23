import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, BarChart3, Settings, LogOut, Menu, 
  ChevronRight, User, ShieldCheck, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

const AdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard Admin', exact: true },
    { path: '/admin/users', icon: Users, label: 'Utilisateurs' },
  ];

  const isActive = (path, exact) => {
    if (exact) return location.pathname === path;
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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0a0f1a] border-r border-red-900/30 flex flex-col h-screen
          transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo - Fixed at top */}
        <div className="flex-shrink-0 p-6 border-b border-red-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <ShieldCheck size={24} className="text-red-400" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-white">Admin Panel</h2>
              <p className="text-red-400/70 text-xs">JobTracker</p>
            </div>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="p-4 border-b border-slate-800">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Retour au Dashboard</span>
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
                ${isActive(item.path, item.exact) 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
              {isActive(item.path, item.exact) && <ChevronRight size={16} className="ml-auto" />}
            </Link>
          ))}
        </nav>

        {/* User & Logout - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-[#0a0f1a]">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <ShieldCheck size={20} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.full_name}</p>
              <p className="text-red-400/70 text-xs">Administrateur</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default function AdminLayout() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="h-screen bg-[#020817] flex overflow-hidden">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex-shrink-0 flex items-center justify-between p-4 border-b border-red-900/30 bg-[#0a0f1a]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-white"
            data-testid="mobile-menu-btn"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-red-400" />
            <span className="font-bold text-white">Admin</span>
          </div>
          <NotificationBell />
        </header>

        {/* Desktop header with notification */}
        <header className="hidden lg:flex flex-shrink-0 items-center justify-between p-4 border-b border-slate-800 bg-[#020817]">
          <div className="flex items-center gap-2 text-red-400">
            <ShieldCheck size={20} />
            <span className="text-sm font-medium">Mode Administration</span>
          </div>
          <NotificationBell />
        </header>

        {/* Main content - only this part scrolls */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
