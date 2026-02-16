import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Briefcase, Calendar, TrendingUp, 
  UserPlus, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend 
} from 'recharts';

// Skeleton Animation Component
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

// Skeleton Stat Card
const StatCardSkeleton = () => (
  <div className="glass-card rounded-xl p-6 border border-slate-800">
    <div className="flex items-start justify-between">
      <Skeleton className="w-12 h-12 rounded-xl" />
      <Skeleton className="w-12 h-5" />
    </div>
    <Skeleton className="h-9 w-20 mt-4" />
    <Skeleton className="h-4 w-32 mt-2" />
    <Skeleton className="h-3 w-24 mt-2" />
  </div>
);

// Skeleton Chart
const ChartSkeleton = () => (
  <div className="glass-card rounded-xl p-6 border border-slate-800">
    <div className="flex items-center gap-2 mb-6">
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="h-6 w-48" />
    </div>
    <div className="h-64 flex flex-col justify-end gap-2">
      <div className="flex items-end gap-2 h-full">
        {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between">
        {[1, 2, 3, 4, 5].map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  </div>
);

// Skeleton Summary
const SummarySkeleton = () => (
  <div className="glass-card rounded-xl p-6 border border-slate-800">
    <Skeleton className="h-6 w-32 mb-6" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((_, i) => (
        <div key={i} className="text-center">
          <Skeleton className="h-10 w-16 mx-auto" />
          <Skeleton className="h-4 w-24 mx-auto mt-2" />
        </div>
      ))}
    </div>
  </div>
);

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subValue, trend, color = "gold" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-xl p-6 border border-slate-800"
  >
    <div className="flex items-start justify-between">
      <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center`}>
        <Icon size={24} className={`text-${color}`} />
      </div>
      {trend !== undefined && (
        <span className={`text-sm font-medium flex items-center gap-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-3xl font-bold text-white mt-4">{value}</p>
    <p className="text-slate-400 text-sm mt-1">{label}</p>
    {subValue && (
      <p className="text-slate-500 text-xs mt-1">{subValue}</p>
    )}
  </motion.div>
);

export default function AdminDashboardPage() {
  const { 
    dashboardStats, 
    fetchDashboardStats, 
    userGrowth, 
    fetchUserGrowth,
    activityStats,
    fetchActivityStats,
    loading 
  } = useAdmin();

  useEffect(() => {
    fetchDashboardStats();
    fetchUserGrowth(30);
    fetchActivityStats(30);
  }, [fetchDashboardStats, fetchUserGrowth, fetchActivityStats]);

  return (
    <div className="space-y-8" data-testid="admin-dashboard-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-white">Panel Administration</h1>
        <p className="text-slate-400 mt-1">Vue d'ensemble de la plateforme</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Users} 
          label="Utilisateurs totaux" 
          value={dashboardStats?.total_users || 0}
          subValue={`${dashboardStats?.active_users || 0} actifs`}
          color="gold"
        />
        <StatCard 
          icon={UserPlus} 
          label="Nouveaux cette semaine" 
          value={dashboardStats?.new_users_this_week || 0}
          subValue={`${dashboardStats?.new_users_this_month || 0} ce mois`}
          color="green-400"
        />
        <StatCard 
          icon={Briefcase} 
          label="Candidatures totales" 
          value={dashboardStats?.total_applications || 0}
          subValue={`+${dashboardStats?.applications_this_week || 0} cette semaine`}
          color="blue-400"
        />
        <StatCard 
          icon={Calendar} 
          label="Entretiens totaux" 
          value={dashboardStats?.total_interviews || 0}
          subValue={`+${dashboardStats?.interviews_this_week || 0} cette semaine`}
          color="purple-400"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h2 className="font-heading text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-gold" />
            Croissance des utilisateurs (30 jours)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => value.slice(5)}
                />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="#D4AF37" 
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                  name="Total utilisateurs"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Chart */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h2 className="font-heading text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Activity size={20} className="text-gold" />
            Activité (30 jours)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => value.slice(5)}
                />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Bar dataKey="applications" fill="#3b82f6" name="Candidatures" radius={[4, 4, 0, 0]} />
                <Bar dataKey="interviews" fill="#8b5cf6" name="Entretiens" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="glass-card rounded-xl p-6 border border-slate-800">
        <h2 className="font-heading text-xl font-semibold text-white mb-6">Résumé</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-gold">{dashboardStats?.total_users || 0}</p>
            <p className="text-slate-400 text-sm mt-1">Utilisateurs inscrits</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-green-400">{dashboardStats?.active_users || 0}</p>
            <p className="text-slate-400 text-sm mt-1">Actifs (7 jours)</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-400">{dashboardStats?.total_applications || 0}</p>
            <p className="text-slate-400 text-sm mt-1">Candidatures créées</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-400">{dashboardStats?.total_interviews || 0}</p>
            <p className="text-slate-400 text-sm mt-1">Entretiens planifiés</p>
          </div>
        </div>
      </div>
    </div>
  );
}
