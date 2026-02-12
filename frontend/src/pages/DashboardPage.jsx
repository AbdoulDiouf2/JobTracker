import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Briefcase, Clock, CheckCircle, XCircle, Star, Calendar,
  TrendingUp, ArrowRight, Plus
} from 'lucide-react';
import { useStatistics } from '../hooks/useStatistics';
import { useInterviews } from '../hooks/useInterviews';
import { useApplications } from '../hooks/useApplications';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, change, color = "gold" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-xl p-6 border border-slate-800"
  >
    <div className="flex items-start justify-between">
      <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center`}>
        <Icon size={24} className={`text-${color}`} />
      </div>
      {change && (
        <span className={`text-sm font-medium ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change > 0 ? '+' : ''}{change}%
        </span>
      )}
    </div>
    <p className="text-3xl font-bold text-white mt-4">{value}</p>
    <p className="text-slate-400 text-sm mt-1">{label}</p>
  </motion.div>
);

// Upcoming Interview Card
const InterviewCard = ({ interview }) => {
  const urgencyColors = {
    danger: 'border-red-500 bg-red-500/10',
    warning: 'border-yellow-500 bg-yellow-500/10',
    info: 'border-blue-500 bg-blue-500/10',
    normal: 'border-slate-700 bg-slate-800/50'
  };

  return (
    <div className={`rounded-xl p-4 border ${urgencyColors[interview.urgency] || urgencyColors.normal}`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-white">{interview.entreprise}</h4>
          <p className="text-slate-400 text-sm">{interview.poste}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium
          ${interview.urgency === 'danger' ? 'bg-red-500/20 text-red-400' : 
            interview.urgency === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 
            'bg-blue-500/20 text-blue-400'}`}>
          {interview.time_remaining}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
        <span>{interview.type_entretien}</span>
        <span>•</span>
        <span>{interview.format_entretien}</span>
      </div>
    </div>
  );
};

// Recent Application Card
const RecentAppCard = ({ app }) => {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    positive: 'bg-green-500/20 text-green-400',
    negative: 'bg-red-500/20 text-red-400',
    no_response: 'bg-slate-500/20 text-slate-400',
    cancelled: 'bg-red-500/20 text-red-400'
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-navy flex items-center justify-center text-gold font-bold">
          {app.entreprise[0]}
        </div>
        <div>
          <h4 className="font-medium text-white">{app.entreprise}</h4>
          <p className="text-slate-500 text-sm">{app.poste}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {app.is_favorite && <Star size={16} className="text-gold fill-gold" />}
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[app.reponse]}`}>
          {app.reponse}
        </span>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { dashboard, fetchDashboard, loading: statsLoading } = useStatistics();
  const { upcomingInterviews, fetchUpcoming } = useInterviews();
  const { applications, fetchApplications } = useApplications();
  const { language } = useLanguage();

  const t = {
    fr: {
      welcome: 'Tableau de bord',
      totalApplications: 'Total candidatures',
      pending: 'En attente',
      withInterview: 'Avec entretien',
      positive: 'Acceptées',
      negative: 'Refusées',
      responseRate: 'Taux de réponse',
      upcomingInterviews: 'Prochains entretiens',
      recentApplications: 'Candidatures récentes',
      viewAll: 'Voir tout',
      newApplication: 'Nouvelle candidature',
      noInterviews: 'Aucun entretien planifié',
      noApplications: 'Aucune candidature'
    },
    en: {
      welcome: 'Dashboard',
      totalApplications: 'Total applications',
      pending: 'Pending',
      withInterview: 'With interview',
      positive: 'Accepted',
      negative: 'Rejected',
      responseRate: 'Response rate',
      upcomingInterviews: 'Upcoming interviews',
      recentApplications: 'Recent applications',
      viewAll: 'View all',
      newApplication: 'New application',
      noInterviews: 'No scheduled interviews',
      noApplications: 'No applications'
    }
  }[language];

  useEffect(() => {
    fetchDashboard();
    fetchUpcoming(5);
    fetchApplications({ per_page: 5 });
  }, [fetchDashboard, fetchUpcoming, fetchApplications]);

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">{t.welcome}</h1>
          <p className="text-slate-400 mt-1">
            {new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}
          </p>
        </div>
        <Link to="/dashboard/applications">
          <Button className="bg-gold hover:bg-gold-light text-[#020817]">
            <Plus size={18} className="mr-2" />
            {t.newApplication}
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="stats-grid">
        <StatCard 
          icon={Briefcase} 
          label={t.totalApplications} 
          value={dashboard?.total_applications || 0} 
        />
        <StatCard 
          icon={Clock} 
          label={t.pending} 
          value={dashboard?.pending || 0}
        />
        <StatCard 
          icon={Calendar} 
          label={t.withInterview} 
          value={dashboard?.with_interview || 0}
        />
        <StatCard 
          icon={TrendingUp} 
          label={t.responseRate} 
          value={`${dashboard?.response_rate || 0}%`}
        />
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Interviews */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl font-semibold text-white flex items-center gap-2">
              <Calendar size={20} className="text-gold" />
              {t.upcomingInterviews}
            </h2>
            <Link to="/dashboard/interviews" className="text-gold text-sm hover:underline flex items-center">
              {t.viewAll} <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingInterviews.length > 0 ? (
              upcomingInterviews.map((interview) => (
                <InterviewCard key={interview.id} interview={interview} />
              ))
            ) : (
              <p className="text-slate-500 text-center py-8">{t.noInterviews}</p>
            )}
          </div>
        </div>

        {/* Recent Applications */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl font-semibold text-white flex items-center gap-2">
              <Briefcase size={20} className="text-gold" />
              {t.recentApplications}
            </h2>
            <Link to="/dashboard/applications" className="text-gold text-sm hover:underline flex items-center">
              {t.viewAll} <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>
          <div className="space-y-5">
            {applications.length > 0 ? (
              applications.slice(0, 5).map((app) => (
                <RecentAppCard key={app.id} app={app} />
              ))
            ) : (
              <p className="text-slate-500 text-center py-8">{t.noApplications}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
