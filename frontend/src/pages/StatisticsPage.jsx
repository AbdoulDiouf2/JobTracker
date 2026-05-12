import { useState, useEffect } from 'react';
import { subDays, subMonths, subYears, format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import {
  Briefcase, TrendingUp, Clock, CheckCircle, Calendar, Download,
  ArrowRight, Target, Zap, AlertTriangle, Info, Sparkles, Loader2,
  Settings2, ChevronDown
} from 'lucide-react';
import {
  useStatisticsOverview, useStatisticsDashboardV2, useMethodEffectiveness
} from '../hooks/useStatistics';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { api } from '../contexts/AuthContext';
import { Skeleton } from '../components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '../components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '../components/ui/dropdown-menu';

const COLORS = ['#c4a052', '#3b82f6', '#22c55e', '#ef4444', '#6b7280', '#a855f7'];

const PERIODS = [
  { key: '7d',  labelFr: '7j',    labelEn: '7d' },
  { key: '30d', labelFr: '30j',   labelEn: '30d' },
  { key: '90d', labelFr: '3 mois', labelEn: '3mo' },
  { key: '6m',  labelFr: '6 mois', labelEn: '6mo' },
  { key: '1y',  labelFr: '1 an',  labelEn: '1y' },
  { key: 'all', labelFr: 'Tout',  labelEn: 'All' },
];

function getPeriodDates(key) {
  if (key === 'all') return {};
  const now = new Date();
  const map = {
    '7d':  subDays(now, 7),
    '30d': subDays(now, 30),
    '90d': subDays(now, 90),
    '6m':  subMonths(now, 6),
    '1y':  subYears(now, 1),
  };
  return { date_from: format(map[key], 'yyyy-MM-dd'), date_to: format(now, 'yyyy-MM-dd') };
}

// ─── Goal Progress Bar ───────────────────────────────────────────────────────
const GoalProgressBar = ({ label, current, goal, color = '#c4a052' }) => {
  const pct = goal > 0 ? Math.min(Math.round(current / goal * 100), 100) : 0;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-white font-bold">{current}<span className="text-slate-500 font-normal">/{goal}</span></span>
      </div>
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: pct >= 100 ? '#22c55e' : color }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-1">{pct}% {pct >= 100 ? '✓' : ''}</p>
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color = 'gold' }) => {
  const colors = {
    gold:   { bg: 'bg-[#c4a052]/10', text: 'text-[#c4a052]' },
    green:  { bg: 'bg-green-500/10',  text: 'text-green-400' },
    blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
    red:    { bg: 'bg-red-500/10',    text: 'text-red-400' },
    slate:  { bg: 'bg-slate-500/10',  text: 'text-slate-400' },
  };
  const c = colors[color] || colors.gold;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5 border border-slate-800"
    >
      <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={c.text} />
      </div>
      <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
      <p className="text-slate-400 text-sm">{label}</p>
      {sub && <p className={`text-xs mt-1 ${c.text}`}>{sub}</p>}
    </motion.div>
  );
};

// ─── Conversion Funnel ───────────────────────────────────────────────────────
const ConversionFunnel = ({ total, withInterview, positive, language }) => {
  const steps = [
    {
      label: language === 'fr' ? 'Candidatures' : 'Applications',
      value: total,
      pct: 100,
      color: '#c4a052',
    },
    {
      label: language === 'fr' ? 'Entretiens' : 'Interviews',
      value: withInterview,
      pct: total > 0 ? Math.round(withInterview / total * 100) : 0,
      color: '#3b82f6',
    },
    {
      label: language === 'fr' ? 'Offres' : 'Offers',
      value: positive,
      pct: total > 0 ? Math.round(positive / total * 100) : 0,
      color: '#22c55e',
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2 flex-1 min-w-[100px]">
          <div className="flex-1">
            <div
              className="rounded-xl p-4 text-center border border-slate-800"
              style={{ background: `${step.color}15`, borderColor: `${step.color}30` }}
            >
              <p className="text-2xl font-bold text-white">{step.value}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: step.color }}>{step.label}</p>
              <p className="text-xs text-slate-500 mt-1">{step.pct}%</p>
            </div>
            {i < steps.length - 1 && (
              <div className="text-center mt-1 text-xs text-slate-500">
                {steps[i + 1].value > 0 && steps[i].value > 0
                  ? `→ ${Math.round(steps[i + 1].value / steps[i].value * 100)}% conv.`
                  : ''}
              </div>
            )}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight size={20} className="text-slate-600 flex-shrink-0 mb-5" />
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Insight Card ─────────────────────────────────────────────────────────────
const InsightCard = ({ insight }) => {
  const styles = {
    positive: 'border-green-500/30 bg-green-500/5 text-green-400',
    warning:  'border-orange-500/30 bg-orange-500/5 text-orange-400',
    tip:      'border-blue-500/30 bg-blue-500/5 text-blue-400',
    info:     'border-slate-600/50 bg-slate-800/30 text-slate-400',
  };
  const icons = {
    positive: CheckCircle,
    warning: AlertTriangle,
    tip: Zap,
    info: Info,
  };
  const style = styles[insight.type] || styles.info;
  const Icon = icons[insight.type] || Info;
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${style}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm text-slate-200 leading-relaxed">{insight.message}</p>
    </div>
  );
};

// ─── Method Effectiveness Chart ───────────────────────────────────────────────
const MethodEffectivenessChart = ({ data, language }) => {
  if (!data || data.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-8">
        {language === 'fr' ? 'Pas assez de données' : 'Not enough data'}
      </p>
    );
  }

  const getColor = (rate) => {
    if (rate >= 20) return '#22c55e';
    if (rate >= 10) return '#f59e0b';
    return '#ef4444';
  };

  const CustomBar = (props) => {
    const { x, y, width, height, value } = props;
    return <rect x={x} y={y} width={width} height={height} fill={getColor(value)} rx={3} />;
  };

  return (
    <ResponsiveContainer width="100%" height={Math.min(Math.max(data.length * 44, 120), 320)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          stroke="#64748b"
          fontSize={11}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          dataKey="label"
          type="category"
          stroke="#64748b"
          fontSize={12}
          width={90}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #c4a052', borderRadius: '8px', color: '#f1f5f9' }}
          labelStyle={{ color: '#c4a052', fontWeight: 600 }}
          itemStyle={{ color: '#f1f5f9' }}
          formatter={(value, name, props) => [
            `${value}% (${props.payload.responded}/${props.payload.total})`,
            language === 'fr' ? 'Taux de réponse' : 'Response rate'
          ]}
        />
        <Bar dataKey="response_rate" shape={<CustomBar />} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── Score Badge ──────────────────────────────────────────────────────────────
const ScoreBadge = ({ score, trend }) => {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';
  return (
    <span className="flex items-center gap-1">
      <span style={{ color }} className="font-bold">{score}/100</span>
      <span className={`text-sm ${trendColor}`}>{trendIcon}</span>
    </span>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const [period, setPeriod] = useState('all');
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiQuotaReached, setAiQuotaReached] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    api.get('/api/ai/available-models').then(r => {
      const models = r.data.models || [];
      setAvailableModels(models);
      if (r.data.default_model) setSelectedModel(r.data.default_model);
    }).catch(() => {});
  }, []);
  const { language } = useLanguage();
  const periodParams = getPeriodDates(period);

  const { data: stats, isLoading: loadingOverview } = useStatisticsOverview(periodParams);
  const { data: v2, isLoading: loadingV2 } = useStatisticsDashboardV2(periodParams);
  const { data: methodData = [], isLoading: loadingMethod } = useMethodEffectiveness(periodParams);

  const loading = loadingOverview || loadingV2;

  const t = {
    fr: {
      title: 'Statistiques',
      subtitle: 'Analysez vos performances',
      totalApplications: 'Total candidatures',
      responseRate: 'Taux de réponse',
      avgResponseTime: 'Temps moy. de réponse',
      withInterview: 'Entretiens obtenus',
      positive: 'Offres / Acceptées',
      score: 'Score recherche',
      monthlyGoal: 'Objectif mensuel',
      weeklyGoal: 'Objectif hebdo',
      funnel: 'Funnel de conversion',
      weeklyEvolution: 'Évolution hebdomadaire',
      effectiveness: 'Efficacité par source',
      timeline: 'Évolution des candidatures',
      byStatus: 'Répartition par statut',
      byType: 'Par type de poste',
      interviews: 'Statistiques entretiens',
      planned: 'Planifiés',
      completed: 'Effectués',
      cancelled: 'Annulés',
      insights: 'Insights',
      exportExcel: 'Excel',
      exportJson: 'JSON',
      days: 'j',
      noInsights: 'Aucun insight disponible',
      applications: 'candidatures',
      responses: 'réponses',
    },
    en: {
      title: 'Statistics',
      subtitle: 'Analyze your performance',
      totalApplications: 'Total applications',
      responseRate: 'Response rate',
      avgResponseTime: 'Avg response time',
      withInterview: 'Interviews obtained',
      positive: 'Offers / Accepted',
      score: 'Search score',
      monthlyGoal: 'Monthly goal',
      weeklyGoal: 'Weekly goal',
      funnel: 'Conversion funnel',
      weeklyEvolution: 'Weekly evolution',
      effectiveness: 'Effectiveness by source',
      timeline: 'Application timeline',
      byStatus: 'Distribution by status',
      byType: 'By job type',
      interviews: 'Interview statistics',
      planned: 'Planned',
      completed: 'Completed',
      cancelled: 'Cancelled',
      insights: 'Insights',
      exportExcel: 'Excel',
      exportJson: 'JSON',
      days: 'd',
      noInsights: 'No insights available',
      applications: 'applications',
      responses: 'responses',
    }
  }[language];

  const handleExport = async (type) => {
    try {
      const response = await api.get(`/api/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = type === 'excel' ? 'xlsx' : type;
      link.setAttribute('download', `candidatures.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleAiAnalysis = async () => {
    setAiDrawerOpen(true);
    if (aiAnalysis) return; // déjà généré pour cette période
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.get('/api/statistics/ai-analysis', {
        params: {
          ...periodParams,
          ...(selectedModel ? { model_provider: selectedModel.provider, model_name: selectedModel.model_id } : {}),
        }
      });
      setAiAnalysis(res.data);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 429) {
        setAiQuotaReached(true);
        setAiError(detail || 'Limite de requêtes atteinte, réessaie dans quelques secondes.');
      } else if (status === 401) setAiError(detail || 'Clé API invalide. Vérifie tes paramètres IA.');
      else if (status === 503) setAiError(detail || 'Service IA indisponible, réessaie plus tard.');
      else if (status === 400) setAiError(detail || 'Aucune clé API IA configurée. Configure-la dans les paramètres.');
      else setAiError(detail || 'Erreur lors de l\'analyse');
    } finally {
      setAiLoading(false);
    }
  };

  // Reset analyse si période change
  const handlePeriodChange = (key) => {
    setPeriod(key);
    setAiAnalysis(null);
    setAiQuotaReached(false);
    setAiError(null);
  };

  // ── Skeleton ──
  if (loading && !stats) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-2"><Skeleton className="h-9 w-44" /><Skeleton className="h-4 w-56" /></div>
          <Skeleton className="h-10 w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="glass-card rounded-xl p-5 border border-slate-800 space-y-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-[240px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { dashboard, timeline = [], by_status = [], by_type = [], avg_response_time_days, interviews_stats } = stats || {};
  const goalProgress = v2?.goal_progress;
  const jobScore = v2?.job_search_score;
  const insights = v2?.insights || [];
  const weeklyEvolution = v2?.weekly_evolution || [];

  const weeklyChartData = weeklyEvolution.map(w => ({
    name: w.week,
    [t.applications]: w.applications,
    [t.responses]: w.responses,
    entretiens: w.interviews,
  }));

  return (
    <div className="space-y-8" data-testid="statistics-page">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 gap-1.5">
                <Calendar size={14} />
                {PERIODS.find(p => p.key === period)?.[language === 'fr' ? 'labelFr' : 'labelEn']}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-700" align="end">
              {PERIODS.map(p => (
                <DropdownMenuItem
                  key={p.key}
                  onClick={() => handlePeriodChange(p.key)}
                  className={`cursor-pointer ${period === p.key ? 'text-[#c4a052] bg-slate-800' : 'text-slate-300'}`}
                >
                  {language === 'fr' ? p.labelFr : p.labelEn}
                  {period === p.key && <span className="ml-auto text-[#c4a052]">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-stretch">
            <Button
              onClick={handleAiAnalysis}
              disabled={aiLoading || aiQuotaReached}
              className="bg-gold hover:bg-gold-light text-[#020817] font-semibold disabled:opacity-50 disabled:cursor-not-allowed rounded-r-none"
              size="sm"
              title={aiQuotaReached ? (language === 'fr' ? 'Limite atteinte — change de période pour réessayer' : 'Quota reached — change period to retry') : undefined}
            >
              {aiLoading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Sparkles size={14} className="mr-1.5" />}
              {language === 'fr' ? 'Analyser avec l\'IA' : 'AI Analysis'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={aiLoading || aiQuotaReached}
                  className="bg-gold hover:bg-gold-light text-[#020817] font-semibold disabled:opacity-50 disabled:cursor-not-allowed rounded-l-none border-l border-[#020817]/20 px-2"
                  size="sm"
                >
                  <ChevronDown size={13} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-900 border-slate-700 w-60" align="end">
                {availableModels.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500">{language === 'fr' ? 'Aucun modèle disponible' : 'No models available'}</div>
                ) : Object.entries(
                  availableModels.reduce((acc, m) => { (acc[m.provider] = acc[m.provider] || []).push(m); return acc; }, {})
                ).map(([prov, models], pi, arr) => (
                  <div key={prov}>
                    <DropdownMenuLabel className={`font-semibold text-xs flex items-center justify-between ${
                      prov === 'openai' ? 'text-green-400' : prov === 'google' ? 'text-blue-400' : 'text-orange-400'
                    }`}>
                      <span>{{ openai: 'OpenAI', google: 'Google', groq: 'Groq' }[prov] || prov}</span>
                      {models[0]?.key_source === 'user' && <span className="text-green-500 font-normal">(ta clé)</span>}
                      {models[0]?.key_source === 'platform' && <span className="text-slate-500 font-normal">(plateforme)</span>}
                    </DropdownMenuLabel>
                    {models.map(m => (
                      <DropdownMenuItem
                        key={m.model_id}
                        disabled={!m.is_available}
                        onClick={() => m.is_available && setSelectedModel(m)}
                        className={`cursor-pointer ${!m.is_available ? 'opacity-40 pointer-events-none' : ''} ${selectedModel?.model_id === m.model_id ? 'bg-slate-800' : ''}`}
                      >
                        <div className="flex flex-col flex-1">
                          <span className="text-white text-sm">{m.display_name}</span>
                          <span className="text-xs text-slate-500">{m.description}</span>
                        </div>
                        {selectedModel?.model_id === m.model_id && <span className="text-[#c4a052] ml-2">✓</span>}
                      </DropdownMenuItem>
                    ))}
                    {pi < arr.length - 1 && <DropdownMenuSeparator className="bg-slate-700" />}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 gap-1.5">
                <Download size={14} />
                {language === 'fr' ? 'Exporter' : 'Export'}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-700" align="end">
              <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer text-slate-300">Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer text-slate-300">CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer text-slate-300">JSON (.json)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Objectifs ── */}
      {goalProgress && (
        <div className="glass-card rounded-xl p-5 border border-slate-800 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-gold" />
            <h3 className="font-heading font-semibold text-white text-sm uppercase tracking-wide">
              {language === 'fr' ? 'Objectifs' : 'Goals'}
            </h3>
          </div>
          <div className="flex gap-6 flex-wrap">
            <GoalProgressBar
              label={t.monthlyGoal}
              current={goalProgress.monthly_current}
              goal={goalProgress.monthly_goal}
            />
            <GoalProgressBar
              label={t.weeklyGoal}
              current={goalProgress.weekly_current}
              goal={goalProgress.weekly_goal}
              color="#3b82f6"
            />
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={Briefcase}
          label={t.totalApplications}
          value={dashboard?.total_applications}
          color="gold"
        />
        <KpiCard
          icon={TrendingUp}
          label={t.responseRate}
          value={dashboard?.response_rate != null ? `${dashboard.response_rate}%` : '—'}
          color="blue"
        />
        <KpiCard
          icon={Clock}
          label={t.avgResponseTime}
          value={avg_response_time_days != null ? `${avg_response_time_days}${t.days}` : '—'}
          sub={language === 'fr' ? 'en moyenne' : 'on average'}
          color="purple"
        />
        <KpiCard
          icon={Calendar}
          label={t.withInterview}
          value={dashboard?.with_interview}
          sub={dashboard?.total_applications > 0
            ? `${Math.round((dashboard.with_interview / dashboard.total_applications) * 100)}% des candidatures`
            : undefined}
          color="blue"
        />
        <KpiCard
          icon={CheckCircle}
          label={t.positive}
          value={dashboard?.positive}
          color="green"
        />
        {jobScore && (
          <KpiCard
            icon={Zap}
            label={t.score}
            value={<ScoreBadge score={jobScore.total_score} trend={jobScore.trend} />}
            color="gold"
          />
        )}
      </div>

      {/* ── Funnel + Insights ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-5">{t.funnel}</h3>
          {dashboard ? (
            <ConversionFunnel
              total={dashboard.total_applications}
              withInterview={dashboard.with_interview}
              positive={dashboard.positive}
              language={language}
            />
          ) : <Skeleton className="h-28 w-full rounded-xl" />}
        </div>

        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-4">{t.insights}</h3>
          {insights.length > 0 ? (
            <div className="flex flex-col gap-3">
              {insights.slice(0, 5).map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">{t.noInsights}</p>
          )}
        </div>
      </div>

      {/* ── Évolution hebdo + Efficacité par source ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-4">{t.weeklyEvolution}</h3>
          {weeklyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey={t.applications} fill="#c4a052" radius={[3, 3, 0, 0]} />
                <Bar dataKey={t.responses} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="entretiens" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-sm text-center py-12">
              {language === 'fr' ? 'Pas assez de données' : 'Not enough data'}
            </p>
          )}
        </div>

        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-1">{t.effectiveness}</h3>
          <p className="text-slate-500 text-xs mb-4">
            {language === 'fr' ? 'Taux de réponse — vert ≥ 20%, jaune ≥ 10%, rouge < 10%' : 'Response rate — green ≥ 20%, yellow ≥ 10%, red < 10%'}
          </p>
          {loadingMethod
            ? <Skeleton className="h-40 w-full rounded-lg" />
            : <MethodEffectivenessChart data={methodData} language={language} />
          }
        </div>
      </div>

      {/* ── Timeline + Status ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-4">{t.timeline}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} />
              <Line type="monotone" dataKey="cumulative" stroke="#c4a052" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-4">{t.byStatus}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={by_status}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="count"
                nameKey="label"
                label={({ label, percentage }) => `${label} (${percentage}%)`}
                labelLine={false}
              >
                {by_status.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Par type + Entretiens ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-4">{t.byType}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={by_type} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" fontSize={11} />
              <YAxis dataKey="label" type="category" stroke="#64748b" fontSize={12} width={80} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
              <Bar dataKey="count" fill="#1a365d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-6 border border-slate-800">
          <h3 className="font-heading text-base font-semibold text-white mb-4">{t.interviews}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <p className="text-3xl font-bold text-blue-400">{interviews_stats?.planned || 0}</p>
              <p className="text-slate-400 text-sm mt-1">{t.planned}</p>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-xl border border-green-500/20">
              <p className="text-3xl font-bold text-green-400">{interviews_stats?.completed || 0}</p>
              <p className="text-slate-400 text-sm mt-1">{t.completed}</p>
            </div>
            <div className="text-center p-4 bg-red-500/10 rounded-xl border border-red-500/20">
              <p className="text-3xl font-bold text-red-400">{interviews_stats?.cancelled || 0}</p>
              <p className="text-slate-400 text-sm mt-1">{t.cancelled}</p>
            </div>
          </div>
          {interviews_stats?.total > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800 text-center">
              <p className="text-slate-400 text-sm">
                {language === 'fr'
                  ? `Taux de succès entretiens : `
                  : `Interview success rate: `}
                <span className="text-green-400 font-semibold">
                  {Math.round((interviews_stats.completed / interviews_stats.total) * 100)}%
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer Analyse IA ── */}
      <Sheet open={aiDrawerOpen} onOpenChange={setAiDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-[#0a0f1a] border-slate-800 text-white flex flex-col p-0">
          <SheetHeader className="px-6 py-5 border-b border-slate-800 flex-shrink-0">
            <SheetTitle className="flex items-center gap-2 text-white font-heading text-xl">
              <Sparkles size={20} className="text-gold" />
              {language === 'fr' ? 'Analyse IA de tes statistiques' : 'AI Analysis of your statistics'}
            </SheetTitle>
            {aiAnalysis && (
              <p className="text-slate-500 text-xs mt-1">
                {aiAnalysis.provider} · {aiAnalysis.model} · {aiAnalysis.period}
              </p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {aiLoading && (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 size={36} className="text-gold animate-spin" />
                <p className="text-slate-400 text-sm">
                  {language === 'fr' ? 'Analyse en cours…' : 'Analyzing…'}
                </p>
              </div>
            )}

            {aiError && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-sm">
                {aiError}
              </div>
            )}

            {aiAnalysis && !aiLoading && (
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed
                [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-2 [&_h1]:font-heading
                [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[#c4a052] [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-heading
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-200 [&_h3]:mt-3 [&_h3]:mb-1
                [&_p]:text-slate-300 [&_p]:leading-relaxed
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                [&_li]:text-slate-300
                [&_strong]:text-white [&_strong]:font-semibold
                [&_hr]:border-slate-700 [&_hr]:my-4
                [&_code]:bg-slate-800 [&_code]:px-1 [&_code]:rounded [&_code]:text-[#c4a052]">
                <ReactMarkdown>{aiAnalysis.analysis}</ReactMarkdown>
              </div>
            )}
          </div>

          {aiAnalysis && !aiLoading && (
            <div className="px-6 py-4 border-t border-slate-800 flex-shrink-0">
              <Button
                onClick={() => { setAiAnalysis(null); setAiQuotaReached(false); handleAiAnalysis(); }}
                disabled={aiQuotaReached}
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={14} className="mr-1.5" />
                {aiQuotaReached
                  ? (language === 'fr' ? 'Limite atteinte' : 'Quota reached')
                  : (language === 'fr' ? 'Regénérer l\'analyse' : 'Regenerate analysis')}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
