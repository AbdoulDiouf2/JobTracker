import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { 
  Briefcase, BarChart3, Brain, Bot, Database, Shield, FileJson, 
  Calendar, Search, Star, Filter, Download, Upload, Terminal,
  ChevronDown, Github, Linkedin, Mail, ExternalLink, Play,
  Sparkles, Zap, Lock, Server, Code2, Container, Layers,
  FileSpreadsheet, FileText, ArrowRight, MessageSquare, User,
  Check, TrendingUp, Target, Clock, Menu, X, Globe, LayoutDashboard
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { Button } from "../components/ui/button";

// Language Switcher Component
const LanguageSwitcher = () => {
  const { language, toggleLanguage, t } = useLanguage();
  
  return (
    <button
      onClick={toggleLanguage}
      data-testid="language-switcher"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-gold/50 transition-all duration-300"
    >
      <Globe size={16} className="text-gold" />
      <span className="text-sm font-medium text-slate-300">
        {language === 'fr' ? 'EN' : 'FR'}
      </span>
    </button>
  );
};

// Navigation Component
const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, language } = useLanguage();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: t('nav.features'), href: '#features' },
    { label: t('nav.analytics'), href: '#analytics' },
    { label: t('nav.ai'), href: '#ai' },
    { label: t('nav.architecture'), href: '#architecture' },
  ];

  return (
    <nav 
      data-testid="main-navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-[#020817]/90 backdrop-blur-xl border-b border-slate-800/50' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <a href="/" data-testid="logo-link" className="flex items-center gap-3">
            <img 
              src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" 
              alt="MAADEC Logo" 
              className="h-24 w-auto"
            />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-slate-400 hover:text-gold font-medium transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <a
                href="/dashboard"
                data-testid="nav-dashboard-button"
                className="flex items-center gap-2 bg-gold text-[#020817] hover:bg-gold-light px-6 py-2.5 rounded-full font-semibold transition-all duration-300 shadow-[0_0_20px_-5px_rgba(196,160,82,0.3)] hover:shadow-[0_0_30px_-5px_rgba(196,160,82,0.5)]"
              >
                <LayoutDashboard size={18} />
                {language === 'fr' ? 'Tableau de bord' : 'Dashboard'}
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  data-testid="nav-login-button"
                  className="text-slate-400 hover:text-gold font-medium transition-colors duration-200"
                >
                  {language === 'fr' ? 'Connexion' : 'Login'}
                </a>
                <a
                  href="/register"
                  data-testid="nav-cta-button"
                  className="bg-gold text-[#020817] hover:bg-gold-light px-6 py-2.5 rounded-full font-semibold transition-all duration-300 shadow-[0_0_20px_-5px_rgba(196,160,82,0.3)] hover:shadow-[0_0_30px_-5px_rgba(196,160,82,0.5)]"
                >
                  {language === 'fr' ? 'Commencer' : 'Get Started'}
                </a>
              </>
            )}
          </div>

          <button
            data-testid="mobile-menu-toggle"
            className="md:hidden text-slate-300 p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#0f172a] border-t border-slate-800 py-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block py-3 px-4 text-slate-300 hover:text-gold hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="px-4 pt-4 flex flex-col gap-3">
              <LanguageSwitcher />
              {isAuthenticated ? (
                <a
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 w-full bg-gold text-[#020817] py-3 rounded-full font-semibold"
                >
                  <LayoutDashboard size={18} />
                  {language === 'fr' ? 'Tableau de bord' : 'Dashboard'}
                </a>
              ) : (
                <>
                  <a
                    href="/login"
                    className="block w-full text-center text-slate-300 py-3 border border-slate-700 rounded-full"
                  >
                    {language === 'fr' ? 'Connexion' : 'Login'}
                  </a>
                  <a
                    href="/register"
                    className="block w-full text-center bg-gold text-[#020817] py-3 rounded-full font-semibold"
                  >
                    {language === 'fr' ? 'Commencer' : 'Get Started'}
                  </a>
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
};

// Hero Section
const HeroSection = () => {
  const { t } = useLanguage();
  const dashboardT = t('hero.dashboard');

  return (
    <section data-testid="hero-section" className="hero-bg relative min-h-screen flex items-center pt-20">
      <div className="particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="particle" />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2 mb-8">
              <Sparkles size={16} className="text-gold" />
              <span className="text-sm font-medium text-slate-300">{t('hero.badge')}</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              {t('hero.title1')}{' '}
              <span className="gradient-text">{t('hero.title2')}</span>{' '}
              {t('hero.title3')}
            </h1>

            <p className="text-lg text-slate-400 mb-10 max-w-xl leading-relaxed">
              {t('hero.description')}
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                data-testid="hero-cta-demo"
                className="bg-gold text-[#020817] hover:bg-gold-light px-8 py-6 rounded-full font-semibold text-lg shadow-[0_0_20px_-5px_rgba(196,160,82,0.3)] hover:shadow-[0_0_30px_-5px_rgba(196,160,82,0.5)] transition-all duration-300"
              >
                <Play size={20} className="mr-2" />
                {t('hero.ctaDemo')}
              </Button>
              <a
                href="#architecture"
                data-testid="hero-cta-architecture"
                className="inline-flex items-center bg-slate-800/50 text-white border border-slate-700 hover:bg-slate-800 hover:border-slate-600 px-8 py-4 rounded-full font-semibold transition-all duration-300 backdrop-blur-sm"
              >
                <Code2 size={20} className="mr-2" />
                {t('hero.ctaArchitecture')}
              </a>
            </div>

            <div className="flex flex-wrap gap-3 mt-12">
              {['FastAPI', 'React', 'MongoDB', 'Tailwind CSS', 'Gemini 2.5', 'GPT-4o'].map((tech) => (
                <span 
                  key={tech} 
                  className="tech-badge bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-full text-sm text-slate-400 font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="dashboard-mockup hidden lg:block"
          >
            <div className="dashboard-mockup-inner relative">
              <div className="glass-card rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-heading font-semibold text-white">{dashboardT.title}</h3>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-slate-500 text-sm mb-1">{dashboardT.totalApps}</p>
                    <p className="text-2xl font-bold text-white">147</p>
                    <p className="text-green-400 text-sm flex items-center mt-1">
                      <TrendingUp size={14} className="mr-1" /> +12%
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-slate-500 text-sm mb-1">{dashboardT.interviews}</p>
                    <p className="text-2xl font-bold text-gold">23</p>
                    <p className="text-gold/70 text-sm flex items-center mt-1">
                      <Calendar size={14} className="mr-1" /> 3 {dashboardT.thisWeek}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-slate-500 text-sm mb-1">{dashboardT.responseRate}</p>
                    <p className="text-2xl font-bold text-white">34%</p>
                    <p className="text-blue-400 text-sm flex items-center mt-1">
                      <Target size={14} className="mr-1" /> {dashboardT.aboveAvg}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/30 rounded-xl p-4 mb-4">
                  <div className="flex items-end justify-between h-24">
                    {[40, 65, 45, 80, 55, 90, 70].map((height, i) => (
                      <div 
                        key={i} 
                        className="w-6 rounded-t transition-all duration-300"
                        style={{ 
                          height: `${height}%`,
                          background: i === 5 ? '#c4a052' : '#1e293b'
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { company: 'Google', role: dashboardT.seniorEngineer, status: dashboardT.interview, statusColor: 'text-green-400' },
                    { company: 'Stripe', role: dashboardT.fullStackDev, status: dashboardT.applied, statusColor: 'text-blue-400' },
                    { company: 'Notion', role: dashboardT.backendLead, status: dashboardT.inReview, statusColor: 'text-yellow-400' },
                  ].map((app, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
                          {app.company[0]}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{app.company}</p>
                          <p className="text-slate-500 text-xs">{app.role}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${app.statusColor}`}>{app.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <motion.div 
                className="absolute -top-4 -right-4 bg-navy border border-slate-700 rounded-xl p-4 shadow-xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Brain size={24} className="text-gold mb-2" />
                <p className="text-white text-sm font-semibold">{t('hero.aiAdvisor')}</p>
                <p className="text-slate-400 text-xs">{t('hero.active')}</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div 
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown size={32} className="text-slate-600" />
      </motion.div>
    </section>
  );
};

// Animated Section Wrapper
const AnimatedSection = ({ children, className = "", id = "" }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.7 }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

// Features Section
const FeaturesSection = () => {
  const { t } = useLanguage();
  const featureItems = t('features.items');
  
  const icons = [Briefcase, Calendar, Search, Star, Filter, Zap];

  return (
    <AnimatedSection id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">{t('features.label')}</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {t('features.title1')} <span className="gradient-text">{t('features.title2')}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            {t('features.description')}
          </p>
        </div>

        <div data-testid="features-grid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureItems.map((feature, index) => {
            const Icon = icons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                data-testid={`feature-card-${index}`}
                className="feature-card glass-card rounded-2xl p-8 hover:border-slate-700/50 transition-all duration-300 group cursor-default"
              >
                <div className="w-14 h-14 rounded-xl bg-navy/50 flex items-center justify-center mb-6 group-hover:bg-navy transition-colors duration-300">
                  <Icon size={28} className="text-gold" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AnimatedSection>
  );
};

// Analytics Section
const AnalyticsSection = () => {
  const { t } = useLanguage();
  const [period, setPeriod] = useState('year');
  const kpisT = t('analytics.kpis');
  const chartT = t('analytics.chart');

  const kpis = [
    { label: kpisT.responseRate, value: '34%', change: '+5%', trend: 'up' },
    { label: kpisT.interviewConversion, value: '23%', change: '+8%', trend: 'up' },
    { label: kpisT.avgResponseTime, value: '4.2j', change: '-1.5j', trend: 'up' },
    { label: kpisT.activeApplications, value: '47', change: '+12', trend: 'up' },
  ];

  const chartData = {
    '30d': [
      { name: 'J-30', value: 24 }, { name: 'J-25', value: 28 }, { name: 'J-20', value: 35 }, 
      { name: 'J-15', value: 30 }, { name: 'J-10', value: 42 }, { name: 'J-5', value: 38 }, { name: 'Ajrd', value: 47 }
    ],
    '90d': [
      { name: 'Sem 1', value: 35 }, { name: 'Sem 3', value: 42 }, { name: 'Sem 5', value: 38 },
      { name: 'Sem 7', value: 55 }, { name: 'Sem 9', value: 48 }, { name: 'Sem 11', value: 62 }, { name: 'Sem 13', value: 70 }
    ],
    'year': [
      { name: 'Jan', value: 30 }, { name: 'Fév', value: 45 }, { name: 'Mar', value: 38 }, 
      { name: 'Avr', value: 52 }, { name: 'Mai', value: 48 }, { name: 'Jun', value: 65 }, 
      { name: 'Jul', value: 58 }, { name: 'Aoû', value: 72 }, { name: 'Sep', value: 68 }, 
      { name: 'Oct', value: 85 }, { name: 'Nov', value: 78 }, { name: 'Déc', value: 92 }
    ]
  };

  return (
    <AnimatedSection id="analytics" className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-gold font-medium text-sm uppercase tracking-widest">{t('analytics.label')}</span>
            <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
              {t('analytics.title1')} <span className="gradient-text">{t('analytics.title2')}</span>
            </h2>
            <p className="text-slate-400 mt-6 text-lg leading-relaxed">
              {t('analytics.description')}
            </p>

            <div data-testid="analytics-kpis" className="grid grid-cols-2 gap-4 mt-10">
              {kpis.map((kpi, index) => (
                <div 
                  key={index}
                  data-testid={`kpi-card-${index}`}
                  className="kpi-card bg-slate-800/30 border border-slate-700/50 rounded-xl p-5"
                >
                  <p className="text-slate-500 text-sm mb-1">{kpi.label}</p>
                  <p className="text-3xl font-bold text-white">{kpi.value}</p>
                  <p className={`text-sm mt-2 flex items-center ${kpi.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    <TrendingUp size={14} className="mr-1" />
                    {kpi.change}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-semibold text-white">{chartT.title}</h3>
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-gold"
              >
                <option value="30d">{chartT.last30}</option>
                <option value="90d">{chartT.last90}</option>
                <option value="year">{chartT.thisYear}</option>
              </select>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData[period]}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c4a052" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#c4a052" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#c4a052' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#c4a052" 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-navy" />
                <span className="text-sm text-slate-400">{chartT.applications}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gold" />
                <span className="text-sm text-slate-400">{chartT.currentMonth}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

// AI Section
const AISection = () => {
  const { t } = useLanguage();
  const advisorT = t('ai.advisor');
  const chatbotT = t('ai.chatbot');

  return (
    <AnimatedSection id="ai" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-navy/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">{t('ai.label')}</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {t('ai.title1')} <span className="gradient-text">{t('ai.title2')}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            {t('ai.description')}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div data-testid="ai-career-advisor-card" className="glass-card rounded-2xl p-8 border-gold/20 hover:border-gold/40 transition-colors duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
                <Brain size={28} className="text-gold" />
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold text-white">{advisorT.title}</h3>
                <p className="text-slate-500 text-sm">{advisorT.poweredBy}</p>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {advisorT.features.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300">
                  <Check size={18} className="text-gold mt-1 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="bg-slate-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={16} className="text-slate-500" />
                <span className="text-sm text-slate-400">{advisorT.uploadCv}</span>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">.pdf</span>
                <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">.docx</span>
                <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">.doc</span>
              </div>
            </div>
          </div>

          <div data-testid="ai-chatbot-card" className="glass-card rounded-2xl p-8 border-navy/50 hover:border-navy transition-colors duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-navy to-navy/50 flex items-center justify-center">
                <Bot size={28} className="text-gold" />
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold text-white">{chatbotT.title}</h3>
                <p className="text-slate-500 text-sm">{chatbotT.poweredBy}</p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 space-y-4 max-h-80 overflow-y-auto">
              {chatbotT.messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4 last:mb-0`}>
                  <div 
                    className={`chat-bubble ${msg.role} max-w-[85%] rounded-2xl p-4 ${
                      msg.role === 'user' 
                        ? 'bg-gold/20 border border-gold/30' 
                        : 'bg-navy/50 border border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {msg.role === 'user' ? (
                        <User size={14} className="text-gold" />
                      ) : (
                        <Bot size={14} className="text-slate-400" />
                      )}
                      <span className="text-xs text-slate-500 uppercase">{msg.role === 'user' ? 'Vous' : 'IA'}</span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-line">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-500">
                {chatbotT.placeholder}
              </div>
              <button className="bg-gold text-[#020817] rounded-xl px-4 py-3 font-medium hover:bg-gold-light transition-colors">
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

// Architecture Section
const ArchitectureSection = () => {
  const { t } = useLanguage();
  const categoriesT = t('architecture.categories');
  const diagramT = t('architecture.diagram');

  const techStack = [
    { category: categoriesT.backend, items: [
      { name: 'FastAPI', icon: Server },
      { name: 'MongoDB (Motor)', icon: Database },
      { name: 'Pydantic', icon: Database },
    ]},
    { category: categoriesT.frontend, items: [
      { name: 'React 19', icon: Code2 },
      { name: 'Tailwind CSS', icon: Layers },
      { name: 'Shadcn/UI', icon: Terminal },
    ]},
    { category: categoriesT.aiApis, items: [
      { name: 'Google Gemini 2.5 Flash', icon: Brain },
      { name: 'OpenAI GPT-4o', icon: Bot },
      { name: 'Recharts', icon: BarChart3 },
    ]},
    { category: categoriesT.devops, items: [
      { name: 'JWT Auth', icon: Lock },
      { name: 'i18next', icon: Globe },
      { name: 'Framer Motion', icon: Layers },
    ]},
  ];

  return (
    <AnimatedSection id="architecture" className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">{t('architecture.label')}</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {t('architecture.title1')} <span className="gradient-text">{t('architecture.title2')}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            {t('architecture.description')}
          </p>
        </div>

        <div data-testid="architecture-grid" className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {techStack.map((category, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl p-6"
            >
              <h3 className="font-heading font-semibold text-gold mb-4">{category.category}</h3>
              <div className="space-y-3">
                {category.items.map((item) => (
                  <div key={item.name} className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                    <item.icon size={18} className="text-slate-500" />
                    <span className="text-sm">{item.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h3 className="font-heading text-xl font-semibold text-white mb-8 text-center">{diagramT.title}</h3>
          
          <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8">
            <div className="flex flex-col items-center">
              <div className="w-32 h-24 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col items-center justify-center">
                <User size={24} className="text-gold mb-2" />
                <span className="text-sm text-slate-300">{diagramT.client}</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">{diagramT.browser}</span>
            </div>

            <ArrowRight className="text-slate-600 hidden lg:block" />
            <ChevronDown className="text-slate-600 lg:hidden" />

            <div className="flex flex-col items-center">
              <div className="w-32 h-24 bg-navy/30 border border-navy rounded-xl flex flex-col items-center justify-center">
                <Code2 size={24} className="text-gold mb-2" />
                <span className="text-sm text-slate-300">{diagramT.frontend}</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">React + Tailwind</span>
            </div>

            <ArrowRight className="text-slate-600 hidden lg:block" />
            <ChevronDown className="text-slate-600 lg:hidden" />

            <div className="flex flex-col items-center">
              <div className="w-32 h-24 bg-gold/10 border border-gold/30 rounded-xl flex flex-col items-center justify-center">
                <Server size={24} className="text-gold mb-2" />
                <span className="text-sm text-slate-300">{diagramT.backend}</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">FastAPI</span>
            </div>

            <ArrowRight className="text-slate-600 hidden lg:block" />
            <ChevronDown className="text-slate-600 lg:hidden" />

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex flex-col items-center">
                <div className="w-32 h-24 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col items-center justify-center">
                  <Database size={24} className="text-gold mb-2" />
                  <span className="text-sm text-slate-300">{diagramT.database}</span>
                </div>
                <span className="text-xs text-slate-500 mt-2">MongoDB</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-32 h-24 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col items-center justify-center">
                  <Brain size={24} className="text-gold mb-2" />
                  <span className="text-sm text-slate-300">{diagramT.aiApis}</span>
                </div>
                <span className="text-xs text-slate-500 mt-2">Gemini + GPT-4o</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-700/50 flex items-center justify-center gap-3">
            <Lock size={20} className="text-slate-500" />
            <span className="text-sm text-slate-400">JWT Authentication + Emergent LLM Integration</span>
          </div>
        </div>

        <div className="mt-8 glass-card rounded-2xl p-8">
          <h3 className="font-heading text-xl font-semibold text-white mb-6">{t('architecture.folderStructure')}</h3>
          <div className="font-mono text-sm overflow-x-auto">
            <pre className="text-slate-400">
{`jobtracker-saas/
├── backend/
│   ├── routes/
│   │   ├── applications.py   # CRUD candidatures
│   │   ├── interviews.py     # CRUD entretiens
│   │   ├── ai.py             # Gemini & GPT-4o
│   │   ├── data_import.py    # Import + Analyse CV
│   │   └── notifications.py  # Notifications
│   ├── models/
│   ├── utils/
│   ├── server.py             # FastAPI app
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # Shadcn/UI
│   │   ├── pages/            # React pages
│   │   ├── hooks/            # Custom hooks
│   │   └── i18n/             # FR/EN
│   └── package.json
└── .env`}
            </pre>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

// Data Export Section
const DataExportSection = () => {
  const { t } = useLanguage();
  const formats = t('dataExport.formats');
  const features = t('dataExport.features');

  const icons = [FileSpreadsheet, FileText, FileJson, Download];

  return (
    <AnimatedSection className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-gold font-medium text-sm uppercase tracking-widest">{t('dataExport.label')}</span>
            <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
              {t('dataExport.title1')} <span className="gradient-text">{t('dataExport.title2')}</span>
            </h2>
            <p className="text-slate-400 mt-6 text-lg leading-relaxed">
              {t('dataExport.description')}
            </p>

            <div className="mt-10 space-y-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300">
                  <Check size={18} className="text-gold" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div data-testid="export-formats-grid" className="grid grid-cols-2 gap-4">
            {formats.map((format, index) => {
              const Icon = icons[index];
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="glass-card rounded-xl p-6 hover:border-gold/30 transition-all duration-300 cursor-default group"
                >
                  <Icon size={32} className="text-gold mb-4 group-hover:scale-110 transition-transform duration-300" />
                  <h4 className="font-heading font-semibold text-white mb-1">{format.name}</h4>
                  <span className="text-gold text-sm font-mono">{format.ext}</span>
                  <p className="text-slate-500 text-sm mt-2">{format.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

// Security Section
const SecuritySection = () => {
  const { t } = useLanguage();
  const securityFeatures = t('security.features');
  const icons = [Lock, Shield, Database, Clock];

  return (
    <AnimatedSection className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">{t('security.label')}</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {t('security.title1')} <span className="gradient-text">{t('security.title2')}</span>
          </h2>
        </div>

        <div data-testid="security-grid" className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityFeatures.map((feature, index) => {
            const Icon = icons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center p-6"
              >
                <div className="w-16 h-16 rounded-2xl bg-navy/30 border border-navy flex items-center justify-center mx-auto mb-4">
                  <Icon size={28} className="text-gold" />
                </div>
                <h4 className="font-heading font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-slate-500 text-sm">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AnimatedSection>
  );
};

// Technical Deep Dive Section
const TechnicalDeepDiveSection = () => {
  const { t } = useLanguage();
  const topics = t('technical.topics');

  return (
    <AnimatedSection className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">{t('technical.label')}</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {t('technical.title1')} <span className="gradient-text">{t('technical.title2')}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            {t('technical.description')}
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4" data-testid="technical-accordion">
          {topics.map((topic, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="glass-card rounded-xl border-slate-800/50 overflow-hidden"
            >
              <AccordionTrigger 
                className="px-6 py-5 text-left font-heading font-semibold text-white hover:text-gold hover:no-underline transition-colors"
                data-testid={`accordion-trigger-${index}`}
              >
                {topic.title}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5">
                <pre className="text-slate-400 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {topic.content}
                </pre>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </AnimatedSection>
  );
};

// CTA Section
const CTASection = () => {
  const { t } = useLanguage();

  return (
    <AnimatedSection id="contact" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#020817] via-navy/20 to-[#020817]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-6">
            {t('cta.title1')}{' '}
            <span className="gradient-text">{t('cta.title2')}</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
            {t('cta.description')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:contact@maadec.com"
              data-testid="cta-contact-button"
              className="inline-flex items-center bg-gold text-[#020817] hover:bg-gold-light px-8 py-4 rounded-full font-semibold text-lg shadow-[0_0_30px_-5px_rgba(196,160,82,0.4)] hover:shadow-[0_0_40px_-5px_rgba(196,160,82,0.6)] transition-all duration-300"
            >
              <Mail size={20} className="mr-2" />
              {t('cta.contact')}
            </a>
            <a
              href="#"
              data-testid="cta-github-button"
              className="inline-flex items-center bg-slate-800/50 text-white border border-slate-700 hover:bg-slate-800 hover:border-slate-600 px-8 py-4 rounded-full font-semibold transition-all duration-300 backdrop-blur-sm"
            >
              <Github size={20} className="mr-2" />
              {t('cta.github')}
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
};

// Footer
const Footer = () => {
  const { t, language } = useLanguage();
  const footerT = t('footer');

  const footerLinks = {
    project: [
      { label: t('nav.features'), href: '#features' },
      { label: t('nav.analytics'), href: '#analytics' },
      { label: t('nav.ai'), href: '#ai' },
      { label: t('nav.architecture'), href: '#architecture' },
    ],
    legal: [
      { label: language === 'fr' ? 'Mentions légales' : 'Legal Notice', href: '/legal' },
      { label: language === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy', href: '/privacy' },
      { label: language === 'fr' ? 'CGU' : 'Terms of Service', href: '/terms' },
    ],
    tech: ['FastAPI', 'MongoDB', 'Google Gemini', 'OpenAI GPT-4o', 'React', 'Tailwind CSS'],
    connect: [
      { label: 'GitHub', href: '#', icon: Github },
      { label: 'LinkedIn', href: '#', icon: Linkedin },
      { label: 'Email', href: 'mailto:contact@maadec.com', icon: Mail },
    ],
  };

  return (
    <footer data-testid="footer" className="footer-bg border-t border-slate-800/50 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          <div className="lg:col-span-1">
            <img 
              src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" 
              alt="MAADEC Logo" 
              className="h-20 w-auto mb-6"
            />
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {footerT.tagline}
            </p>
            <div className="flex gap-4">
              {footerLinks.connect.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  data-testid={`footer-social-${link.label.toLowerCase()}`}
                  className="w-10 h-10 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-gold hover:border-gold/50 transition-all duration-300"
                >
                  <link.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-white mb-6">{footerT.project}</h4>
            <ul className="space-y-3">
              {footerLinks.project.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-slate-400 hover:text-gold transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-white mb-6">{language === 'fr' ? 'Légal' : 'Legal'}</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <a 
                    href={link.href} 
                    className="text-slate-400 hover:text-gold transition-colors text-sm"
                    data-testid={`footer-legal-${link.href.replace('/', '')}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-white mb-6">{footerT.techStack}</h4>
            <ul className="space-y-3">
              {footerLinks.tech.map((tech) => (
                <li key={tech}>
                  <span className="text-slate-400 text-sm">{tech}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-white mb-6">{footerT.getInTouch}</h4>
            <p className="text-slate-400 text-sm mb-4">
              {footerT.contactText}
            </p>
            <a 
              href="mailto:contact@maadec.com"
              className="inline-flex items-center text-gold hover:text-gold-light transition-colors text-sm font-medium"
            >
              contact@maadec.com
              <ExternalLink size={14} className="ml-2" />
            </a>
          </div>
        </div>

        <div className="section-divider mb-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            {footerT.copyright.replace('{year}', new Date().getFullYear())}
          </p>
          <div className="flex items-center gap-6">
            <a href="/legal" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
              {language === 'fr' ? 'Mentions légales' : 'Legal'}
            </a>
            <a href="/privacy" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
              {language === 'fr' ? 'Confidentialité' : 'Privacy'}
            </a>
            <a href="/terms" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
              {language === 'fr' ? 'CGU' : 'Terms'}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Landing Page Component
export default function LandingPage() {
  return (
    <div className="relative">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <AnalyticsSection />
      <AISection />
      <ArchitectureSection />
      <DataExportSection />
      <SecuritySection />
      <TechnicalDeepDiveSection />
      <CTASection />
      <Footer />
    </div>
  );
}
