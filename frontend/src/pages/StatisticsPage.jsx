import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import { 
  Briefcase, TrendingUp, Clock, CheckCircle, XCircle, 
  Calendar, Star, Download
} from 'lucide-react';
import { useStatistics } from '../hooks/useStatistics';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { api } from '../contexts/AuthContext';

const COLORS = ['#c4a052', '#1a365d', '#22c55e', '#ef4444', '#6b7280', '#3b82f6'];

// Stat Card
const StatCard = ({ icon: Icon, label, value, color = "gold" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-xl p-5 border border-slate-800"
  >
    <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center mb-3`}>
      <Icon size={20} className={`text-${color}`} />
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-slate-400 text-sm">{label}</p>
  </motion.div>
);

export default function StatisticsPage() {
  const { stats, fetchOverview, loading } = useStatistics();
  const { language } = useLanguage();

  const t = {
    fr: {
      title: 'Statistiques',
      subtitle: 'Analysez vos performances',
      totalApplications: 'Total candidatures',
      pending: 'En attente',
      positive: 'Acceptées',
      negative: 'Refusées',
      responseRate: 'Taux de réponse',
      avgResponseTime: 'Temps moyen réponse',
      days: 'jours',
      favorites: 'Favoris',
      withInterview: 'Avec entretien',
      timeline: 'Évolution des candidatures',
      byStatus: 'Répartition par statut',
      byType: 'Par type de poste',
      byMethod: 'Par moyen de candidature',
      interviews: 'Statistiques entretiens',
      planned: 'Planifiés',
      completed: 'Effectués',
      cancelled: 'Annulés',
      exportExcel: 'Exporter Excel',
      exportJson: 'Exporter JSON'
    },
    en: {
      title: 'Statistics',
      subtitle: 'Analyze your performance',
      totalApplications: 'Total applications',
      pending: 'Pending',
      positive: 'Accepted',
      negative: 'Rejected',
      responseRate: 'Response rate',
      avgResponseTime: 'Avg response time',
      days: 'days',
      favorites: 'Favorites',
      withInterview: 'With interview',
      timeline: 'Application timeline',
      byStatus: 'Distribution by status',
      byType: 'By job type',
      byMethod: 'By application method',
      interviews: 'Interview statistics',
      planned: 'Planned',
      completed: 'Completed',
      cancelled: 'Cancelled',
      exportExcel: 'Export Excel',
      exportJson: 'Export JSON'
    }
  }[language];

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleExport = async (type) => {
    try {
      const response = await api.get(`/api/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `candidatures.${type === 'excel' ? 'xlsx' : type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold" />
      </div>
    );
  }

  const { dashboard, timeline, by_status, by_type, by_method, interviews_stats } = stats;

  return (
    <div className="space-y-8" data-testid="statistics-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => handleExport('excel')}
            variant="outline"
            className="border-slate-700 text-slate-300"
          >
            <Download size={16} className="mr-2" />
            {t.exportExcel}
          </Button>
          <Button 
            onClick={() => handleExport('json')}
            variant="outline"
            className="border-slate-700 text-slate-300"
          >
            <Download size={16} className="mr-2" />
            {t.exportJson}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label={t.totalApplications} value={dashboard.total_applications} />
        <StatCard icon={Clock} label={t.pending} value={dashboard.pending} />
        <StatCard icon={CheckCircle} label={t.positive} value={dashboard.positive} color="green-500" />
        <StatCard icon={TrendingUp} label={t.responseRate} value={`${dashboard.response_rate}%`} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-lg font-semibold text-white mb-4">{t.timeline}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line 
                type="monotone" 
                dataKey="cumulative" 
                stroke="#c4a052" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-lg font-semibold text-white mb-4">{t.byStatus}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={by_status}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="count"
                nameKey="label"
                label={({ label, percentage }) => `${label} (${percentage}%)`}
                labelLine={false}
              >
                {by_status.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-lg font-semibold text-white mb-4">{t.byType}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={by_type} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis dataKey="label" type="category" stroke="#64748b" fontSize={12} width={80} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              />
              <Bar dataKey="count" fill="#1a365d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Method */}
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-lg font-semibold text-white mb-4">{t.byMethod}</h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={by_method}
                cx="50%"
                cy="40%"
                outerRadius={90}
                dataKey="count"
                nameKey="label"
              >
                {by_method.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                wrapperStyle={{ padding: '20px 0' }}
                formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interview Stats */}
      <div className="glass-card rounded-xl p-6 border border-slate-800">
        <h3 className="font-heading text-lg font-semibold text-white mb-4">{t.interviews}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-500/10 rounded-xl">
            <p className="text-3xl font-bold text-blue-400">{interviews_stats?.planned || 0}</p>
            <p className="text-slate-400 text-sm">{t.planned}</p>
          </div>
          <div className="text-center p-4 bg-green-500/10 rounded-xl">
            <p className="text-3xl font-bold text-green-400">{interviews_stats?.completed || 0}</p>
            <p className="text-slate-400 text-sm">{t.completed}</p>
          </div>
          <div className="text-center p-4 bg-red-500/10 rounded-xl">
            <p className="text-3xl font-bold text-red-400">{interviews_stats?.cancelled || 0}</p>
            <p className="text-slate-400 text-sm">{t.cancelled}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
