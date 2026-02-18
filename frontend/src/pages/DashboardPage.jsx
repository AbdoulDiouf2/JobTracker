import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Briefcase, Clock, CheckCircle, XCircle, Star, Calendar,
  TrendingUp, TrendingDown, ArrowRight, Plus, Target, Trophy,
  Lightbulb, AlertTriangle, Zap, ChevronUp, ChevronDown
} from 'lucide-react';
import { useStatistics } from '../hooks/useStatistics';
import { useInterviews } from '../hooks/useInterviews';
import { useApplications } from '../hooks/useApplications';
import { useLanguage } from '../i18n';
import { useRefresh } from '../contexts/RefreshContext';
import { Button } from '../components/ui/button';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

// ============================================
// SKELETON COMPONENTS
// ============================================
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

const HeroSkeleton = () => (
  <div className="grid lg:grid-cols-2 gap-4">
    <div className="glass-card rounded-xl p-6 border border-slate-800">
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-12 w-24 mb-2" />
      <Skeleton className="h-3 w-full rounded-full mb-2" />
      <Skeleton className="h-4 w-40" />
    </div>
    <div className="glass-card rounded-xl p-6 border border-slate-800">
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-16 w-20 mx-auto mb-2" />
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="glass-card rounded-xl p-5 border border-slate-800">
    <div className="flex items-start justify-between">
      <Skeleton className="w-10 h-10 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-16 mt-3" />
    <Skeleton className="h-4 w-24 mt-2" />
  </div>
);

const ChartSkeleton = () => (
  <div className="glass-card rounded-xl p-6 border border-slate-800">
    <Skeleton className="h-5 w-40 mb-4" />
    <div className="h-48 flex items-end gap-2">
      {[40, 65, 45, 80, 55].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

// ============================================
// ANIMATED COUNTER
// ============================================
const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (value === 0) {
      setCount(0);
      return;
    }
    
    let start = 0;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [value, duration]);
  
  return <span>{count}</span>;
};

// ============================================
// HERO SECTION - GOAL & SCORE
// ============================================
const GoalProgressCard = ({ goalProgress, thisMonth }) => {
  const percentage = goalProgress?.monthly_percentage || 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="text-gold" size={20} />
          <h3 className="font-semibold text-white">Objectif mensuel</h3>
        </div>
        <span className="text-xs text-slate-400">
          {new Date().toLocaleDateString('fr-FR', { month: 'long' })}
        </span>
      </div>
      
      <div className="flex items-end gap-2 mb-3">
        <span className="text-4xl font-bold text-gold">
          <AnimatedCounter value={thisMonth || 0} />
        </span>
        <span className="text-slate-400 text-lg mb-1">/ {goalProgress?.monthly_goal || 40}</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${
            percentage >= 100 ? 'bg-green-500' : 
            percentage >= 50 ? 'bg-gold' : 'bg-orange-500'
          }`}
        />
      </div>
      
      <p className="text-sm text-slate-400">
        {percentage >= 100 ? (
          <span className="text-green-400">🎉 Objectif atteint !</span>
        ) : (
          <>Encore <span className="text-white font-medium">{(goalProgress?.monthly_goal || 40) - (thisMonth || 0)}</span> pour atteindre ton objectif</>
        )}
      </p>
    </motion.div>
  );
};

const JobScoreCard = ({ score }) => {
  const totalScore = score?.total_score || 0;
  const trend = score?.trend || 'stable';
  const trendValue = score?.trend_value || 0;
  
  const getScoreColor = (s) => {
    if (s >= 80) return 'text-green-400';
    if (s >= 60) return 'text-gold';
    if (s >= 40) return 'text-orange-400';
    return 'text-red-400';
  };
  
  const getScoreLabel = (s) => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Bon';
    if (s >= 40) return 'Moyen';
    return 'À améliorer';
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card rounded-xl p-6 border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="text-gold" size={20} />
          <h3 className="font-semibold text-white">Job Search Score</h3>
        </div>
        {trend !== 'stable' && (
          <span className={`text-xs flex items-center gap-1 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend === 'up' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {Math.abs(trendValue)} pts
          </span>
        )}
      </div>
      
      <div className="text-center">
        <div className="relative inline-block">
          <span className={`text-5xl font-bold ${getScoreColor(totalScore)}`}>
            <AnimatedCounter value={totalScore} />
          </span>
          <span className="text-slate-400 text-xl">/100</span>
        </div>
        <p className={`text-sm mt-1 ${getScoreColor(totalScore)}`}>{getScoreLabel(totalScore)}</p>
      </div>
      
      {/* Mini breakdown */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-700">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{score?.regularity_score || 0}</p>
          <p className="text-xs text-slate-500">Régularité</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{score?.response_rate_score || 0}</p>
          <p className="text-xs text-slate-500">Réponses</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{score?.interview_ratio_score || 0}</p>
          <p className="text-xs text-slate-500">Entretiens</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{score?.followup_score || 0}</p>
          <p className="text-xs text-slate-500">Relances</p>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// STAT CARDS
// ============================================
const StatCard = ({ icon: Icon, label, value, color = "gold", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ scale: 1.02 }}
    className="glass-card rounded-xl p-5 border border-slate-800 hover:border-gold/30 transition-all"
  >
    <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center mb-3`}>
      <Icon size={20} className={`text-${color}`} />
    </div>
    <p className="text-2xl font-bold text-white">
      {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
    </p>
    <p className="text-slate-400 text-sm mt-1">{label}</p>
  </motion.div>
);

// ============================================
// INSIGHTS SECTION
// ============================================
const InsightsCard = ({ insights }) => {
  if (!insights || insights.length === 0) return null;
  
  const getIcon = (type) => {
    switch (type) {
      case 'positive': return <CheckCircle className="text-green-400" size={18} />;
      case 'warning': return <AlertTriangle className="text-orange-400" size={18} />;
      case 'tip': return <Lightbulb className="text-gold" size={18} />;
      default: return <Zap className="text-blue-400" size={18} />;
    }
  };
  
  const getBgColor = (type) => {
    switch (type) {
      case 'positive': return 'bg-green-500/10 border-green-500/20';
      case 'warning': return 'bg-orange-500/10 border-orange-500/20';
      case 'tip': return 'bg-gold/10 border-gold/20';
      default: return 'bg-blue-500/10 border-blue-500/20';
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card rounded-xl p-6 border border-slate-800"
    >
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <Lightbulb className="text-gold" size={20} />
        Insights
      </h3>
      <div className="space-y-4">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className={`flex items-start gap-3 p-3 rounded-lg border ${getBgColor(insight.type)} mb-2`}
          >
            {getIcon(insight.type)}
            <p className="text-sm text-slate-300">{insight.message}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// ============================================
// PRIORITY ACTIONS
// ============================================
const PriorityActionsCard = ({ actions }) => {
  if (!actions || actions.length === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass-card rounded-xl p-6 border border-slate-800"
    >
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <AlertTriangle className="text-orange-400" size={20} />
        Actions prioritaires
      </h3>
      <div className="space-y-3">
        {actions.map((action, index) => (
          <Link
            key={index}
            to={action.action_url || '#'}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{action.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{action.title}</p>
                <p className="text-xs text-slate-400">{action.description}</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-500 group-hover:text-gold transition-colors" />
          </Link>
        ))}
      </div>
    </motion.div>
  );
};

// ============================================
// WEEKLY CHART
// ============================================
const WeeklyChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card rounded-xl p-6 border border-slate-800"
    >
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="text-gold" size={20} />
        Évolution (4 semaines)
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="week" 
              stroke="#64748b" 
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="applications" name="Candidatures" fill="#c4a052" radius={[4, 4, 0, 0]} />
            <Bar dataKey="responses" name="Réponses" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="interviews" name="Entretiens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

// ============================================
// INTERVIEW & APPLICATION CARDS
// ============================================
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

const InterviewCardSkeleton = () => (
  <div className="rounded-xl p-4 border border-slate-700 bg-slate-800/50">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <div className="flex items-center gap-4 mt-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-20" />
    </div>
  </div>
);

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

const ApplicationCardSkeleton = () => (
  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-800/30">
    <div className="flex items-center gap-4">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <Skeleton className="h-6 w-20 rounded-full" />
  </div>
);

// ============================================
// MAIN DASHBOARD
// ============================================
export default function DashboardPage() {
  const { dashboardV2, fetchDashboardV2, loading: statsLoading } = useStatistics();
  const { upcomingInterviews, fetchUpcoming, loading: interviewsLoading } = useInterviews();
  const { applications, fetchApplications, loading: applicationsLoading } = useApplications();
  const { language } = useLanguage();
  const { refreshKey } = useRefresh();

  const t = {
    fr: {
      welcome: 'Tableau de bord',
      totalApplications: 'Total candidatures',
      pending: 'En attente',
      withInterview: 'Avec entretien',
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
    fetchDashboardV2();
    fetchUpcoming(5);
    fetchApplications({ per_page: 5 });
  }, [fetchDashboardV2, fetchUpcoming, fetchApplications, refreshKey]);

  const stats = dashboardV2?.stats;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold text-white">{t.welcome}</h1>
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

      {/* Hero Section - Goal & Score */}
      {statsLoading ? (
        <HeroSkeleton />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <GoalProgressCard 
            goalProgress={dashboardV2?.goal_progress} 
            thisMonth={dashboardV2?.this_month_applications}
          />
          <JobScoreCard score={dashboardV2?.job_search_score} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5" data-testid="stats-grid">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard 
              icon={Briefcase} 
              label={t.totalApplications} 
              value={stats?.total_applications || 0}
              delay={0.15}
            />
            <StatCard 
              icon={Clock} 
              label={t.pending} 
              value={stats?.pending || 0}
              delay={0.2}
            />
            <StatCard 
              icon={Calendar} 
              label={t.withInterview} 
              value={stats?.with_interview || 0}
              delay={0.25}
            />
            <StatCard 
              icon={TrendingUp} 
              label={t.responseRate} 
              value={`${stats?.response_rate || 0}%`}
              delay={0.3}
            />
          </>
        )}
      </div>

      {/* Insights & Chart Row */}
      {!statsLoading && (
        <div className="grid lg:grid-cols-2 gap-6 mt-8">
          <InsightsCard insights={dashboardV2?.insights} />
          <WeeklyChart data={dashboardV2?.weekly_evolution} />
        </div>
      )}

      {/* Priority Actions */}
      {!statsLoading && (
        <PriorityActionsCard actions={dashboardV2?.priority_actions} />
      )}

      {/* Interviews & Applications */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Interviews */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
              <Calendar size={18} className="text-gold" />
              {t.upcomingInterviews}
            </h2>
            <Link to="/dashboard/interviews" className="text-gold text-sm hover:underline flex items-center">
              {t.viewAll} <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            {interviewsLoading ? (
              <>
                <InterviewCardSkeleton />
                <InterviewCardSkeleton />
                <InterviewCardSkeleton />
              </>
            ) : upcomingInterviews.length > 0 ? (
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
            <h2 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
              <Briefcase size={18} className="text-gold" />
              {t.recentApplications}
            </h2>
            <Link to="/dashboard/applications" className="text-gold text-sm hover:underline flex items-center">
              {t.viewAll} <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {applicationsLoading ? (
              <>
                <ApplicationCardSkeleton />
                <ApplicationCardSkeleton />
                <ApplicationCardSkeleton />
                <ApplicationCardSkeleton />
                <ApplicationCardSkeleton />
              </>
            ) : applications.length > 0 ? (
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
