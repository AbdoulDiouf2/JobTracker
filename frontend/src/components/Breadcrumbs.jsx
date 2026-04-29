import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '../i18n';

const Breadcrumbs = () => {
  const location = useLocation();
  const { language } = useLanguage();
  
  const pathnames = location.pathname.split('/').filter((x) => x);

  const t = {
    fr: {
      dashboard: 'Tableau de bord',
      applications: 'Candidatures',
      interviews: 'Entretiens',
      statistics: 'Statistiques',
      'ai-advisor': 'Assistant IA',
      documents: 'Documents',
      settings: 'Paramètres',
      profile: 'Profil',
      admin: 'Administration',
      users: 'Utilisateurs',
      support: 'Support',
      'import-export': 'Import/Export'
    },
    en: {
      dashboard: 'Dashboard',
      applications: 'Applications',
      interviews: 'Interviews',
      statistics: 'Statistics',
      'ai-advisor': 'AI Advisor',
      documents: 'Documents',
      settings: 'Settings',
      profile: 'Profile',
      admin: 'Administration',
      users: 'Users',
      support: 'Support',
      'import-export': 'Import/Export'
    }
  }[language];

  const getLabel = (path) => {
    // If it's a UUID (detail page), show "Détails" or something generic
    if (path.length > 20 && /[0-9a-f-]/.test(path)) {
      return language === 'fr' ? 'Détails' : 'Details';
    }
    return t[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <nav className="flex items-center space-x-2 text-sm text-slate-400 overflow-x-auto whitespace-nowrap scrollbar-none">
      <Link 
        to="/dashboard" 
        className="hover:text-white transition-colors flex items-center gap-1.5"
      >
        <Home size={14} />
      </Link>
      
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;

        return (
          <React.Fragment key={to}>
            <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />
            {last ? (
              <span className="text-white font-medium">{getLabel(value)}</span>
            ) : (
              <Link 
                to={to} 
                className="hover:text-white transition-colors"
              >
                {getLabel(value)}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
