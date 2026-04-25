import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import {
  Briefcase, BarChart3, Brain, Bot, Calendar, Search, Star,
  ChevronDown, Mail, ExternalLink, Play, Sparkles, Zap,
  Check, TrendingUp, Target, Clock, Menu, X, Globe, LayoutDashboard,
  Users, Award, Shield, ArrowRight, Chrome, Smartphone, Bell
} from 'lucide-react';
import { Button } from "../components/ui/button";

// ============================================
// NAVIGATION
// ============================================
const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: language === 'fr' ? 'Fonctionnalités' : 'Features', href: '#features' },
    { label: language === 'fr' ? 'Comment ça marche' : 'How it works', href: '#how-it-works' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-[#020817]/95 backdrop-blur-xl border-b border-slate-800/50' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <a href="/" className="flex items-center gap-3">
            <img src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" alt="JobTracker" className="h-20 w-auto" />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-slate-400 hover:text-gold font-medium transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={toggleLanguage} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-gold/50 transition-all">
              <Globe size={16} className="text-gold" />
              <span className="text-sm font-medium text-slate-300">{language === 'fr' ? 'EN' : 'FR'}</span>
            </button>
            {isAuthenticated ? (
              <a href="/dashboard" className="flex items-center gap-2 bg-gold text-[#020817] hover:bg-gold-light px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg hover:shadow-gold/20">
                <LayoutDashboard size={18} />
                {language === 'fr' ? 'Tableau de bord' : 'Dashboard'}
              </a>
            ) : (
              <>
                <a href="/login" className="text-slate-400 hover:text-gold font-medium transition-colors">
                  {language === 'fr' ? 'Connexion' : 'Login'}
                </a>
                <a href="/register" className="bg-gold text-[#020817] hover:bg-gold-light px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg hover:shadow-gold/20">
                  {language === 'fr' ? 'Essai gratuit' : 'Free Trial'}
                </a>
              </>
            )}
          </div>

          <button className="md:hidden text-slate-300 p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="md:hidden bg-[#0f172a] border-t border-slate-800 py-4">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="block py-3 px-4 text-slate-300 hover:text-gold" onClick={() => setIsMobileMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            <div className="px-4 pt-4 flex flex-col gap-3">
              {isAuthenticated ? (
                <a href="/dashboard" className="flex items-center justify-center gap-2 w-full bg-gold text-[#020817] py-3 rounded-full font-semibold">
                  <LayoutDashboard size={18} />
                  {language === 'fr' ? 'Tableau de bord' : 'Dashboard'}
                </a>
              ) : (
                <>
                  <a href="/login" className="block w-full text-center text-slate-300 py-3 border border-slate-700 rounded-full">
                    {language === 'fr' ? 'Connexion' : 'Login'}
                  </a>
                  <a href="/register" className="block w-full text-center bg-gold text-[#020817] py-3 rounded-full font-semibold">
                    {language === 'fr' ? 'Essai gratuit' : 'Free Trial'}
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

// ============================================
// HERO SECTION — upgraded with score gauge + kanban
// ============================================
const HeroSection = () => {
  const { language } = useLanguage();

  const t = {
    fr: {
      badge: '🎯 Organisez-vous. Préparez-vous. Réussissez.',
      title1: 'Arrêtez de',
      title2: 'chercher.',
      title3: 'Commencez à décrocher.',
      description: 'Votre Agent de Carrière Personnel alimenté par l\'IA. Centralisez vos candidatures, analysez votre profil et générez des lettres de motivation sur-mesure en un clic.',
      cta: 'Commencer gratuitement',
      ctaSecondary: 'Voir la démo',
      chromeExt: 'Extension Chrome incluse',
      score: 'Job Search Score',
      scoreUp: '+5 pts cette semaine',
      activity: 'Activité hebdomadaire',
      toApply: 'À Postuler',
      interview: 'Entretien',
      rejected: 'Refus',
    },
    en: {
      badge: '🎯 Get organized. Get prepared. Get hired.',
      title1: 'Stop',
      title2: 'searching.',
      title3: 'Start landing.',
      description: 'Your AI-powered Personal Career Agent. Centralize your applications, analyze your profile and generate tailored cover letters in one click.',
      cta: 'Start for free',
      ctaSecondary: 'Watch demo',
      chromeExt: 'Chrome Extension included',
      score: 'Job Search Score',
      scoreUp: '+5 pts this week',
      activity: 'Weekly activity',
      toApply: 'To Apply',
      interview: 'Interview',
      rejected: 'Rejected',
    }
  }[language];

  return (
    <section className="relative pt-32 pb-0 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(196,160,82,0.12)' }} />
      <div className="absolute top-[40%] left-[-200px] w-[700px] h-[700px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(37,99,235,0.06)' }} />

      {/* Text block — centered, constrained */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center pb-16">
        <div className="flex flex-col items-center">

          {/* Top — Copy centered */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/30 bg-gold/5 mb-6">
              <Chrome size={14} className="text-gold" />
              <span className="text-xs font-semibold text-gold tracking-wide uppercase">{t.chromeExt}</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              {t.title1}{' '}
              <span className="gradient-text">{t.title2}</span>
              <br />{t.title3}
            </h1>

            <p className="text-lg text-slate-400 mb-10 max-w-xl leading-relaxed">
              {t.description}
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <a href="/register">
                <Button className="bg-gold text-[#020817] hover:bg-gold-light px-8 py-6 rounded-full font-semibold text-lg shadow-lg hover:shadow-gold/30 transition-all">
                  {t.cta}
                  <ArrowRight size={20} className="ml-2" />
                </Button>
              </a>
              <Button variant="outline" className="border-slate-700 text-white hover:bg-slate-800 px-8 py-6 rounded-full font-semibold text-lg">
                <Play size={20} className="mr-2" />
                {t.ctaSecondary}
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {[
                { icon: Briefcase, label: language === 'fr' ? '200+ candidatures testées' : '200+ applications tested' },
                { icon: Brain, label: language === 'fr' ? 'IA intégrée' : 'AI integrated' },
                { icon: Zap, label: language === 'fr' ? '0 relance oubliée' : '0 missed follow-ups' },
              ].map(({ icon: Icon, label }, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800/30 border border-slate-700/50 rounded-full px-4 py-2">
                  <Icon size={16} className="text-gold" />
                  <span className="text-slate-300 text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mockup — full width, outside container */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="relative z-10 w-full px-4 sm:px-8 lg:px-16 max-w-7xl mx-auto"
      >
            {/* Gold glow border wrapper */}
            <div style={{
              borderRadius: '1rem',
              padding: '1px',
              background: 'linear-gradient(180deg, rgba(196,160,82,0.8) 0%, rgba(196,160,82,0) 50%, rgba(255,255,255,0.04) 100%)',
              boxShadow: '0 0 40px rgba(196,160,82,0.15), 0 20px 60px -10px rgba(0,0,0,0.8)',
            }}>
              <div className="rounded-[15px] overflow-hidden border border-white/5 bg-[#0a0f1d]" style={{ height: 560 }}>
                {/* Browser bar */}
                <div className="h-9 bg-[#0f172a] border-b border-white/5 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <div className="mx-auto bg-[#1e293b] rounded text-[10px] text-slate-500 px-16 py-1 flex items-center gap-1.5">
                    app.jobtracker.io
                  </div>
                </div>

                <div className="flex h-full">
                  {/* Sidebar */}
                  <div className="w-14 border-r border-white/5 flex flex-col items-center py-4 gap-5 bg-[#0a0f1d]/50">
                    <div className="p-1.5 bg-gold/10 rounded-lg text-gold"><LayoutDashboard size={18} /></div>
                    <BarChart3 size={18} className="text-slate-600" />
                    <Calendar size={18} className="text-slate-600" />
                    <Brain size={18} className="text-slate-600" />
                  </div>

                  {/* Main grid */}
                  <div className="flex-1 p-4 grid grid-cols-3 gap-3 overflow-hidden">

                    {/* Score gauge */}
                    <div className="glass-card rounded-xl p-3 flex flex-col">
                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Target size={10} className="text-gold" /> {t.score}
                      </p>
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="relative">
                          <svg width="90" height="90" className="-rotate-90">
                            <circle cx="45" cy="45" r="38" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="none" />
                            <circle cx="45" cy="45" r="38" stroke="#c4a052" strokeWidth="6" fill="none"
                              strokeDasharray="238.8" strokeDashoffset="52.5" strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-white font-heading leading-none">78</span>
                            <span className="text-[9px] text-slate-500">/100</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                          <TrendingUp size={10} /> {t.scoreUp}
                        </p>
                      </div>
                    </div>

                    {/* Bar chart */}
                    <div className="glass-card rounded-xl p-3 col-span-2 flex flex-col">
                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">{t.activity}</p>
                      <div className="flex-1 flex items-end justify-between gap-1 px-1">
                        {[30, 50, 80, 40, 60, 20, 90].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t" style={{
                            height: `${h}%`,
                            background: i === 2 ? '#c4a052' : i === 6 ? '#dfba6b' : '#1e293b',
                            boxShadow: i === 2 ? '0 0 8px rgba(196,160,82,0.4)' : 'none',
                          }} />
                        ))}
                      </div>
                      <div className="flex justify-between mt-1 text-[8px] text-slate-600 font-mono uppercase px-1">
                        <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                      </div>
                    </div>

                    {/* Mini kanban */}
                    <div className="col-span-3 flex gap-2" style={{ height: 130 }}>
                      {/* Col 1 */}
                      <div className="flex-1 glass-card rounded-lg p-2.5 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-semibold text-slate-400 uppercase">{t.toApply}</span>
                          <span className="text-[9px] bg-white/10 px-1 rounded">12</span>
                        </div>
                        <div className="bg-slate-800/60 border border-white/5 rounded p-1.5 mb-1">
                          <div className="h-1.5 w-14 bg-white/20 rounded mb-1" />
                          <div className="h-1 w-10 bg-gold/40 rounded" />
                        </div>
                        <div className="bg-slate-800/60 border border-white/5 rounded p-1.5">
                          <div className="h-1.5 w-16 bg-white/20 rounded mb-1" />
                          <div className="h-1 w-8 bg-blue-500/40 rounded" />
                        </div>
                      </div>
                      {/* Col 2 — highlighted */}
                      <div className="flex-1 glass-card rounded-lg p-2.5 flex flex-col border-gold/30" style={{ borderColor: 'rgba(196,160,82,0.3)' }}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-semibold text-gold uppercase">{t.interview}</span>
                          <span className="text-[9px] bg-gold/20 text-gold px-1 rounded">3</span>
                        </div>
                        <div className="bg-slate-800 border border-gold/20 rounded p-1.5 relative overflow-hidden" style={{ boxShadow: '0 0 8px rgba(196,160,82,0.1)' }}>
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold" />
                          <div className="h-1.5 w-20 bg-white/40 rounded mb-1 ml-1.5" />
                          <div className="h-1 w-12 bg-purple-500/40 rounded ml-1.5" />
                        </div>
                      </div>
                      {/* Col 3 */}
                      <div className="flex-1 glass-card rounded-lg p-2.5 flex flex-col opacity-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-semibold text-slate-500 uppercase">{t.rejected}</span>
                          <span className="text-[9px] bg-white/5 px-1 rounded">42</span>
                        </div>
                        <div className="bg-slate-800/30 border border-white/5 rounded p-1.5">
                          <div className="h-1.5 w-12 bg-white/10 rounded" />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

      </motion.div>

      <motion.div className="relative z-10 flex justify-center pb-10 pt-4" animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
        <ChevronDown size={32} className="text-slate-600" />
      </motion.div>
    </section>
  );
};

// ============================================
// STATS STRIP — new section
// ============================================
const StatsStrip = () => {
  const { language } = useLanguage();

  const stats = [
    { value: '200+', label: language === 'fr' ? 'Offres organisées /mois' : 'Applications tracked /month' },
    { value: '50+',  label: language === 'fr' ? 'Job Boards supportés' : 'Job Boards supported' },
    { value: '3',    label: language === 'fr' ? 'LLMs intégrés (GPT-4 · Gemini · Groq)' : 'LLMs integrated (GPT-4 · Gemini · Groq)' },
    { value: '0',    label: language === 'fr' ? 'Candidature perdue' : 'Application lost' },
  ];

  return (
    <div className="border-y border-slate-800/50 bg-slate-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              viewport={{ once: true }}
              className={`text-center ${i > 0 ? 'border-l border-slate-800/50' : ''}`}
            >
              <div className="font-heading text-4xl md:text-5xl font-bold text-white mb-1">
                {s.value.replace('+', '')}<span className="text-gold">{s.value.includes('+') ? '+' : ''}</span>
              </div>
              <div className="text-sm text-slate-400">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// LOGOS SECTION (Social Proof)
// ============================================
const LogosSection = () => {
  const { language } = useLanguage();

  return (
    <section className="py-10 bg-slate-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-slate-500 text-sm mb-6">
          {language === 'fr' ? 'Compatible avec tous vos job boards favoris' : 'Works with all your favorite job boards'}
        </p>
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-40">
          {['LinkedIn', 'Indeed', 'WTTJ', 'APEC', 'France Travail', 'Glassdoor', 'Cadremploi', 'Monster'].map((name) => (
            <span key={name} className="text-slate-300 font-semibold text-sm md:text-base">{name}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// FEATURES SECTION — bento grid
// ============================================
const FeaturesSection = () => {
  const { language } = useLanguage();

  const t = {
    fr: {
      badge: 'Fonctionnalités',
      title: 'Un arsenal complet pour',
      titleHighlight: 'écraser la concurrence.',
      subtitle: 'Pas un simple tableur déguisé. Un écosystème conçu pour la vitesse et l\'automatisation.',
      features: [
        {
          icon: Chrome,
          title: 'Capture en 1-clic',
          description: 'Ajoutez une offre depuis n\'importe quel site via l\'extension Chrome. 50+ job boards supportés.',
          tags: ['LinkedIn', 'Indeed', 'WTTJ', '+47'],
          size: 'sm',
        },
        {
          icon: Target,
          title: 'Job Search Score',
          description: 'Un score 0-100 qui synthétise votre taux de conversion, délais de réponse et activité hebdomadaire. Ne naviguez plus à vue.',
          bullets: [
            language === 'fr' ? 'Taux de transformation par étape' : 'Conversion rate per stage',
            language === 'fr' ? 'Alertes de relance (J+7)' : 'Follow-up alerts (D+7)',
            language === 'fr' ? 'Objectifs mensuels' : 'Monthly objectives',
          ],
          size: 'lg',
        },
        {
          icon: Brain,
          title: language === 'fr' ? 'IA Advisor' : 'AI Advisor',
          description: language === 'fr'
            ? 'Analyse CV, génère vos lettres de motivation et calcule votre matching score via GPT-4o, Gemini ou Groq.'
            : 'CV analysis, cover letter generation and matching score via GPT-4o, Gemini or Groq.',
          size: 'tall',
        },
        {
          icon: Calendar,
          title: language === 'fr' ? 'Calendrier & Rappels' : 'Calendar & Reminders',
          description: language === 'fr'
            ? 'Sync GCal/Outlook. Ne manquez plus un seul entretien.'
            : 'Sync GCal/Outlook. Never miss an interview.',
          size: 'sm',
        },
        {
          icon: Bell,
          title: language === 'fr' ? 'GED Documents' : 'Document Manager',
          description: language === 'fr'
            ? 'CV, lettres de motivation, templates. La bonne version au bon endroit.'
            : 'CVs, cover letters, templates. Right version, right place.',
          size: 'sm',
        },
        {
          icon: BarChart3,
          title: language === 'fr' ? 'Import / Export' : 'Import / Export',
          description: language === 'fr'
            ? 'Migration depuis Notion, Excel ou LinkedIn en 2 minutes. Export CSV natif.'
            : 'Migrate from Notion, Excel or LinkedIn in 2 minutes. Native CSV export.',
          size: 'sm',
        },
      ],
    },
    en: {
      badge: 'Features',
      title: 'A complete arsenal to',
      titleHighlight: 'crush the competition.',
      subtitle: 'Not just a disguised spreadsheet. An ecosystem built for speed and automation.',
    }
  }[language] ?? {};

  const content = language === 'fr' ? t : {
    ...t,
    badge: 'Features',
    title: 'A complete arsenal to',
    titleHighlight: 'crush the competition.',
    subtitle: 'Not just a disguised spreadsheet. An ecosystem built for speed and automation.',
  };

  const features = language === 'fr' ? [
    {
      icon: Chrome,
      title: 'Capture en 1-clic',
      description: 'Ajoutez une offre depuis n\'importe quel site via l\'extension Chrome. 50+ job boards supportés.',
      tags: ['LinkedIn', 'Indeed', 'WTTJ', '+47'],
      size: 'sm',
    },
    {
      icon: Target,
      title: 'Job Search Score',
      description: 'Un score 0-100 qui synthétise votre taux de conversion, délais de réponse et activité hebdomadaire. Ne naviguez plus à vue.',
      bullets: ['Taux de transformation par étape', 'Alertes de relance (J+7)', 'Objectifs mensuels personnalisables'],
      size: 'lg',
    },
    {
      icon: Brain,
      title: 'IA Advisor',
      description: 'Analyse CV, génère vos lettres de motivation et calcule votre matching score via GPT-4o, Gemini ou Groq.',
      size: 'tall',
    },
    {
      icon: Calendar,
      title: 'Calendrier & Rappels',
      description: 'Sync GCal/Outlook. Ne manquez plus un seul entretien téléphonique.',
      size: 'sm',
    },
    {
      icon: Bell,
      title: 'GED Documents',
      description: 'CV, lettres de motivation, templates. Assignez la bonne version à la bonne offre.',
      size: 'sm',
    },
    {
      icon: BarChart3,
      title: 'Import / Export',
      description: 'Migration depuis Notion, Excel ou LinkedIn en 2 minutes. Export CSV natif.',
      size: 'sm',
    },
  ] : [
    {
      icon: Chrome,
      title: '1-click Capture',
      description: 'Add any job from any site via Chrome extension. 50+ job boards supported.',
      tags: ['LinkedIn', 'Indeed', 'WTTJ', '+47'],
      size: 'sm',
    },
    {
      icon: Target,
      title: 'Job Search Score',
      description: 'A 0-100 score synthesizing your conversion rate, response times and weekly activity. No more flying blind.',
      bullets: ['Conversion rate per stage', 'Follow-up alerts (D+7)', 'Customizable monthly goals'],
      size: 'lg',
    },
    {
      icon: Brain,
      title: 'AI Advisor',
      description: 'CV analysis, cover letter generation and matching score via GPT-4o, Gemini or Groq.',
      size: 'tall',
    },
    {
      icon: Calendar,
      title: 'Calendar & Reminders',
      description: 'GCal/Outlook sync. Never miss an interview again.',
      size: 'sm',
    },
    {
      icon: Bell,
      title: 'Document Manager',
      description: 'CVs, cover letters, templates. Assign the right version to the right offer.',
      size: 'sm',
    },
    {
      icon: BarChart3,
      title: 'Import / Export',
      description: 'Migrate from Notion, Excel or LinkedIn in 2 minutes. Native CSV export.',
      size: 'sm',
    },
  ];

  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <span className="text-gold font-medium text-sm uppercase tracking-widest">
            {language === 'fr' ? 'Fonctionnalités' : 'Features'}
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {language === 'fr' ? 'Un arsenal complet pour ' : 'A complete arsenal to '}
            <span className="gradient-text">{language === 'fr' ? 'écraser la concurrence.' : 'crush the competition.'}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl text-lg">
            {language === 'fr'
              ? 'Pas un simple tableur déguisé. Un écosystème conçu pour la vitesse et l\'automatisation.'
              : 'Not just a disguised spreadsheet. An ecosystem built for speed and automation.'}
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Card 1: Capture (small) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0 }} viewport={{ once: true }}
            className="glass-card rounded-2xl p-6 hover:border-gold/30 transition-all group flex flex-col justify-between min-h-[200px]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
                <Chrome size={20} />
              </div>
              <h3 className="font-heading text-xl font-semibold text-white mb-2">{features[0].title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{features[0].description}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['LinkedIn', 'Indeed', 'WTTJ', '+47'].map((tag, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  i === 0 ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                  i === 3 ? 'bg-white/5 border-white/10 text-slate-400' :
                  'bg-white/5 border-white/10 text-slate-300'
                }`}>{tag}</span>
              ))}
            </div>
          </motion.div>

          {/* Card 2: Job Search Score (large, 2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }} viewport={{ once: true }}
            className="glass-card rounded-2xl p-8 md:col-span-2 hover:border-gold/30 transition-all flex flex-col md:flex-row gap-6 min-h-[200px]"
          >
            <div className="flex-1 flex flex-col justify-center">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
                <Target size={20} />
              </div>
              <h3 className="font-heading text-2xl font-semibold text-white mb-3">{features[1].title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{features[1].description}</p>
              <ul className="space-y-2">
                {features[1].bullets?.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check size={14} className="text-gold flex-shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
            {/* Mini floating cards */}
            <div className="hidden md:flex flex-col justify-center gap-3 min-w-[170px]">
              <motion.div
                animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="glass-card p-4 rounded-xl"
              >
                <div className="text-[10px] text-slate-400 mb-1">{language === 'fr' ? 'Taux de réponse' : 'Response rate'}</div>
                <div className="text-2xl font-heading font-bold text-white">24.5%</div>
                <div className="w-full h-1 bg-white/10 mt-2 rounded overflow-hidden">
                  <div className="w-1/4 h-full bg-green-500 rounded" />
                </div>
              </motion.div>
              <motion.div
                animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                className="glass-card p-3 rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center text-gold">
                    <Bell size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] text-white font-medium">{language === 'fr' ? 'Relance requise' : 'Follow-up needed'}</div>
                    <div className="text-[9px] text-slate-400">Stripe · Frontend</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Card 3: AI Advisor (tall, 1 col, 2 rows) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }} viewport={{ once: true }}
            className="glass-card rounded-2xl overflow-hidden hover:border-gold/30 transition-all flex flex-col md:row-span-2"
            style={{ minHeight: 320 }}
          >
            <div className="p-6">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
                <Brain size={20} />
              </div>
              <h3 className="font-heading text-xl font-semibold text-white mb-2">{features[2].title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{features[2].description}</p>
            </div>
            {/* Chat mockup */}
            <div className="flex-1 bg-[#070d1a] border-t border-white/5 p-4 flex flex-col gap-3 overflow-hidden">
              <div className="bg-slate-800/80 text-slate-300 text-xs p-3 rounded-lg rounded-tr-none self-end max-w-[88%] border border-white/5">
                {language === 'fr'
                  ? 'Analyse mon CV pour Data Engineer chez Qonto.'
                  : 'Analyze my CV for Data Engineer at Qonto.'}
              </div>
              <div className="bg-gold/10 text-white text-xs p-3 rounded-lg rounded-tl-none self-start max-w-[90%] border border-gold/20 flex gap-2">
                <Brain size={14} className="text-gold shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gold block mb-1">{language === 'fr' ? 'Agent JobTracker' : 'JobTracker Agent'}</span>
                  {language === 'fr'
                    ? 'Matching à 82%. Ajoute "dbt" et "Airflow". Voici 3 bullet points optimisés ATS...'
                    : '82% match. Add "dbt" and "Airflow". Here are 3 ATS-optimized bullet points...'}
                </div>
              </div>
              <div className="bg-slate-800/50 text-slate-400 text-xs p-3 rounded-lg rounded-tr-none self-end max-w-[88%] border border-white/5 opacity-40">
                {language === 'fr' ? 'Génère aussi l\'accroche de l\'email.' : 'Also generate the email opener.'}
              </div>
            </div>
          </motion.div>

          {/* Cards 4-6: small — Import/Export spans 2 cols */}
          {features.slice(3).map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: (i + 3) * 0.08 }} viewport={{ once: true }}
              className={`glass-card rounded-2xl p-6 hover:border-gold/30 transition-all flex flex-col justify-center min-h-[160px] ${
                i === 2 ? 'md:col-span-2' : ''
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-gold/10 border border-gold/20 text-gold">
                  <f.icon size={18} />
                </div>
                <h3 className="font-heading font-semibold text-white">{f.title}</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}

        </div>
      </div>
    </section>
  );
};

// ============================================
// CHROME EXTENSION SPOTLIGHT — new section
// ============================================
const ChromeExtensionSection = () => {
  const { language } = useLanguage();

  const t = {
    fr: {
      badge: 'Extension Chrome',
      title: 'Aspirez les offres',
      titleHighlight: 'sans quitter la page.',
      description: 'Notre extension injecte un panneau latéral intelligent directement sur LinkedIn, Indeed, WTTJ et 47 autres sites. L\'IA extrait automatiquement le titre, le salaire, les compétences requises et la localisation.',
      cta: 'Installer l\'extension — Gratuit',
      detected: 'Offre détectée ! 95% des champs remplis automatiquement.',
      company: 'Entreprise',
      position: 'Poste',
      salary: 'Salaire',
      location: 'Lieu',
      add: 'Ajouter au Pipeline',
      compatible: 'Compatible avec',
    },
    en: {
      badge: 'Chrome Extension',
      title: 'Capture job offers',
      titleHighlight: 'without leaving the page.',
      description: 'Our extension injects an intelligent side panel directly on LinkedIn, Indeed, WTTJ and 47 other sites. AI automatically extracts the title, salary, required skills and location.',
      cta: 'Install extension — Free',
      detected: 'Offer detected! 95% of fields auto-filled by AI.',
      company: 'Company',
      position: 'Position',
      salary: 'Salary',
      location: 'Location',
      add: 'Add to Pipeline',
      compatible: 'Compatible with',
    }
  }[language];

  const boards = ['LinkedIn', 'Indeed', 'WTTJ', 'APEC', 'France Travail', 'Glassdoor', 'Cadremploi', '+43'];

  return (
    <section className="py-24 border-y border-slate-800/50 bg-[#0a0f1a] relative overflow-hidden">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(196,160,82,0.05)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <span className="text-gold font-medium text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
            <Chrome size={14} /> {t.badge}
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            {t.title}{' '}
            <span className="gradient-text">{t.titleHighlight}</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed">{t.description}</p>

          <div className="flex flex-wrap gap-2 mb-8">
            {boards.map((b, i) => (
              <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                i === boards.length - 1
                  ? 'bg-gold/10 border-gold/20 text-gold'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}>{b}</span>
            ))}
          </div>

          <a href="/register" className="inline-flex items-center gap-2 bg-white text-[#020817] hover:bg-slate-100 px-6 py-3 rounded-xl font-semibold transition-colors">
            <Chrome size={18} /> {t.cta}
          </a>
        </motion.div>

        {/* Side panel mockup */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          viewport={{ once: true }}
          className="relative hidden lg:block"
        >
          <div className="rounded-xl overflow-hidden flex shadow-2xl hover:scale-[1.02] transition-transform duration-500" style={{ background: '#e8edf2', aspectRatio: '4/3' }}>
            {/* Fake job board bg */}
            <div className="flex-1 p-6 opacity-50">
              <div className="w-28 h-5 bg-slate-400 rounded mb-5" />
              <div className="flex gap-3 mb-6">
                <div className="w-12 h-12 bg-slate-400 rounded" />
                <div>
                  <div className="w-40 h-4 bg-slate-500 rounded mb-2" />
                  <div className="w-28 h-3 bg-slate-400 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                {[100, 100, 75, 100, 60].map((w, i) => (
                  <div key={i} className="h-2.5 bg-slate-300 rounded" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>

            {/* Extension panel */}
            <div className="w-64 h-full bg-[#0f172a] border-l border-white/20 flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
              <div className="p-3 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-gold" />
                  <span className="text-white font-semibold text-sm">JobTracker AI</span>
                  <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">v2.2</span>
                </div>
                <X size={12} className="text-slate-400" />
              </div>

              <div className="p-3 flex-1 flex flex-col gap-2.5 overflow-hidden">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 flex items-start gap-2">
                  <Zap size={12} className="text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-[10px] text-blue-200 leading-relaxed">{t.detected}</div>
                </div>

                {[
                  { label: t.company, value: 'Acme Corp', color: 'text-white' },
                  { label: t.position, value: 'Senior Data Engineer', color: 'text-white' },
                ].map(({ label, value, color }, i) => (
                  <div key={i}>
                    <div className="text-[9px] text-slate-500 font-semibold mb-1 tracking-wider uppercase">{label}</div>
                    <div className="bg-slate-800 border border-white/5 rounded px-2.5 py-1.5 text-xs text-white">{value}</div>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] text-slate-500 font-semibold mb-1 tracking-wider uppercase">{t.salary}</div>
                    <div className="bg-slate-800 border border-white/5 rounded px-2 py-1.5 text-xs text-green-400">65k–80k €</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 font-semibold mb-1 tracking-wider uppercase">{t.location}</div>
                    <div className="bg-slate-800 border border-white/5 rounded px-2 py-1.5 text-xs text-white">Paris · Hybride</div>
                  </div>
                </div>

                <button className="w-full mt-auto py-2.5 bg-gold hover:bg-gold-light text-[#020817] font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors" style={{ boxShadow: '0 0 12px rgba(196,160,82,0.3)' }}>
                  <Check size={14} /> {t.add}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ============================================
// HOW IT WORKS SECTION
// ============================================
const HowItWorksSection = () => {
  const { language } = useLanguage();

  const steps = language === 'fr' ? [
    { step: '01', title: 'Créez votre compte', description: 'Inscrivez-vous gratuitement en 30 secondes via email ou Google OAuth. Aucune carte bancaire requise.' },
    { step: '02', title: 'Capturez des offres en 1 clic', description: 'Installez l\'extension Chrome et capturez n\'importe quelle offre depuis LinkedIn, Indeed, WTTJ... L\'IA remplit tout automatiquement.' },
    { step: '03', title: 'Laissez l\'IA optimiser', description: 'L\'IA analyse l\'offre vs votre profil, génère votre lettre de motivation et identifie les mots-clés manquants pour passer les ATS.' },
    { step: '04', title: 'Décrochez le job', description: 'Suivez vos candidatures, recevez des rappels de relance et pilotez votre recherche avec le Job Search Score.' },
  ] : [
    { step: '01', title: 'Create your account', description: 'Sign up for free in 30 seconds via email or Google OAuth. No credit card required.' },
    { step: '02', title: 'Capture jobs in 1 click', description: 'Install the Chrome extension and capture any offer from LinkedIn, Indeed, WTTJ... AI fills everything automatically.' },
    { step: '03', title: 'Let AI optimize', description: 'AI analyzes the offer vs your profile, generates your cover letter and identifies missing keywords to pass ATS.' },
    { step: '04', title: 'Land the job', description: 'Track your applications, receive follow-up reminders and pilot your search with the Job Search Score.' },
  ];

  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">
            {language === 'fr' ? 'Comment ça marche' : 'How it works'}
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {language === 'fr' ? 'Simple comme ' : 'As simple as '}
            <span className="gradient-text">1-2-3-4</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-6xl font-bold text-gold/20 mb-4 font-heading">{item.step}</div>
              <h3 className="font-heading text-xl font-semibold text-white mb-3">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// PRICING SECTION
// ============================================
const PricingSection = () => {
  const { language } = useLanguage();

  const content = {
    fr: {
      badge: 'Tarifs',
      title: 'Investissez dans',
      titleHighlight: 'votre prochaine étape.',
      subtitle: '100% gratuit pendant la phase de lancement. Pas de carte bancaire requise.',
      plans: [
        {
          name: 'Gratuit',
          badge: '✅ Disponible maintenant',
          price: '0€',
          period: '/toujours',
          description: 'Tout ce qu\'il faut pour structurer sa recherche.',
          features: [
            'Candidatures illimitées',
            'Suivi des entretiens & rappels',
            'Statistiques & Job Search Score',
            'Conseiller IA intégré',
            'Extension Chrome (capture manuelle)',
            'Import / Export CSV',
          ],
          cta: 'Commencer gratuitement',
          active: true,
          highlight: true,
        },
        {
          name: 'Career Pro',
          badge: '🚀 Bientôt disponible',
          price: '9,90€',
          priceSub: '24,90€ / 3 mois',
          period: '/mois',
          description: 'Pour les chasseurs sérieux qui veulent l\'IA complète.',
          features: [
            'Tout du plan Gratuit',
            'Capture IA automatique (500/mois)',
            'Génération lettres de motivation (GPT-4o)',
            'Analyse CV + Matching Score',
            'Sync Google Calendar & relances auto',
            'Support prioritaire',
          ],
          cta: 'Être notifié à la sortie',
          active: false,
          highlight: false,
        },
        {
          name: 'Campus',
          badge: '🎓 Sur devis',
          price: language === 'fr' ? 'Sur devis' : 'Custom',
          period: '',
          description: 'Pour les bootcamps et écoles qui veulent suivre le placement de leur cohorte.',
          features: [
            'Licences Career Pro en volume',
            'Dashboard administrateur école',
            'Suivi du taux de placement',
            'API & Webhooks',
            'Support dédié',
          ],
          cta: 'Nous contacter',
          active: false,
          highlight: false,
          isContact: true,
        },
      ]
    },
    en: {
      badge: 'Pricing',
      title: 'Invest in',
      titleHighlight: 'your next step.',
      subtitle: '100% free during launch phase. No credit card required.',
      plans: [
        {
          name: 'Free',
          badge: '✅ Available now',
          price: '$0',
          period: '/always',
          description: 'Everything you need to structure your job search.',
          features: [
            'Unlimited applications',
            'Interview tracking & reminders',
            'Statistics & Job Search Score',
            'Integrated AI Advisor',
            'Chrome Extension (manual capture)',
            'CSV Import / Export',
          ],
          cta: 'Start for free',
          active: true,
          highlight: true,
        },
        {
          name: 'Career Pro',
          badge: '🚀 Coming soon',
          price: '$9.90',
          priceSub: '$24.90 / 3 months',
          period: '/month',
          description: 'For serious hunters who want the full AI suite.',
          features: [
            'Everything in Free',
            'AI auto-capture (500/month)',
            'Cover letter generation (GPT-4o)',
            'CV analysis + Matching Score',
            'Google Calendar sync & auto follow-ups',
            'Priority support',
          ],
          cta: 'Get notified at launch',
          active: false,
          highlight: false,
        },
        {
          name: 'Campus',
          badge: '🎓 Custom pricing',
          price: 'Custom',
          period: '',
          description: 'For bootcamps and schools tracking their cohort placement.',
          features: [
            'Bulk Career Pro licenses',
            'School admin dashboard',
            'Placement rate tracking',
            'API & Webhooks',
            'Dedicated support',
          ],
          cta: 'Contact us',
          active: false,
          highlight: false,
          isContact: true,
        },
      ]
    }
  }[language];

  return (
    <section id="pricing" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(196,160,82,0.04) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">{content.badge}</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {content.title}{' '}
            <span className="gradient-text">{content.titleHighlight}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">{content.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          {content.plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`glass-card rounded-2xl p-8 flex flex-col relative transition-all
                ${plan.highlight ? 'border-gold/50 shadow-[0_0_40px_rgba(196,160,82,0.1)]' : ''}
                ${!plan.active && !plan.isContact ? 'opacity-70' : ''}
              `}
            >
              {/* Badge */}
              <div className="text-xs font-semibold text-slate-400 mb-4">{plan.badge}</div>

              <h3 className={`font-heading text-2xl font-semibold mb-1 ${plan.highlight ? 'text-gold' : 'text-white'}`}>
                {plan.name}
              </h3>
              <p className="text-slate-500 text-sm mb-5">{plan.description}</p>

              {/* Price */}
              <div className="mb-2">
                <span className="text-4xl font-bold text-white font-heading">{plan.price}</span>
                {plan.period && <span className="text-slate-500 ml-1">{plan.period}</span>}
              </div>
              {plan.priceSub && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 mb-5 w-fit">
                  <span className="text-xs font-semibold text-green-400">{plan.priceSub} — {language === 'fr' ? 'rentabilisé au 1er salaire' : 'paid back with 1st paycheck'}</span>
                </div>
              )}

              <ul className="space-y-3 mb-8 flex-1 mt-4">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <Check size={16} className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-gold' : 'text-slate-500'}`} />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.active ? (
                <a href="/register" className="block">
                  <Button className="w-full bg-gold text-[#020817] hover:bg-gold-light font-semibold py-5">
                    {plan.cta}
                  </Button>
                </a>
              ) : plan.isContact ? (
                <a href="mailto:abdoulam.diouf@maadec.com" className="block">
                  <Button variant="outline" className="w-full border-slate-700 text-white hover:bg-slate-800 py-5">
                    {plan.cta}
                  </Button>
                </a>
              ) : (
                <Button disabled className="w-full bg-slate-800/50 text-slate-500 cursor-not-allowed py-5 border border-slate-700/50">
                  {plan.cta}
                </Button>
              )}
            </motion.div>
          ))}
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          {language === 'fr'
            ? '* Career Pro et Campus arrivent prochainement. Inscrivez-vous gratuitement dès maintenant.'
            : '* Career Pro and Campus coming soon. Sign up for free now.'}
        </p>
      </div>
    </section>
  );
};

// ============================================
// STORY SECTION
// ============================================
const StorySection = () => {
  const { language } = useLanguage();

  const content = {
    fr: {
      badge: 'L\'histoire derrière JobTracker',
      title: 'Pourquoi j\'ai créé',
      titleHighlight: 'JobTracker',
      story: 'Après avoir envoyé plus de 200 candidatures sans organisation claire, j\'ai réalisé que le problème n\'était pas mon CV ou mes compétences — c\'était le chaos. Des relances oubliées, des entretiens mal préparés, aucune visibilité sur ma progression.',
      story2: 'En tant que Data Engineer, j\'ai décidé de construire l\'outil que j\'aurais aimé avoir. Pas une promesse magique, mais un système qui aide ceux qui se donnent les moyens.',
      signature: '— Abdoul, créateur de JobTracker',
      stats: [
        { icon: Briefcase, value: '200+', label: 'Candidatures envoyées avant de créer cet outil' },
        { icon: Brain, value: 'IA', label: 'Analyse personnalisée intégrée' },
        { icon: Target, value: '40%', label: 'Temps de suivi réduit en moyenne' },
        { icon: Zap, value: '0', label: 'Relance oubliée depuis' },
      ],
      proofs: [
        { icon: Users, text: 'Créé par un Data Engineer' },
        { icon: Brain, text: 'IA intégrée (Gemini, GPT-4)' },
        { icon: Target, text: 'Basé sur une expérience réelle' },
      ]
    },
    en: {
      badge: 'The story behind JobTracker',
      title: 'Why I built',
      titleHighlight: 'JobTracker',
      story: 'After sending over 200 applications without clear organization, I realized the problem wasn\'t my resume or skills — it was the chaos. Forgotten follow-ups, poorly prepared interviews, no visibility on my progress.',
      story2: 'As a Data Engineer, I decided to build the tool I wish I had. Not a magic promise, but a system that helps those who put in the work.',
      signature: '— Abdoul, creator of JobTracker',
      stats: [
        { icon: Briefcase, value: '200+', label: 'Applications sent before building this tool' },
        { icon: Brain, value: 'AI', label: 'Personalized analysis integrated' },
        { icon: Target, value: '40%', label: 'Average tracking time reduced' },
        { icon: Zap, value: '0', label: 'Forgotten follow-ups since' },
      ],
      proofs: [
        { icon: Users, text: 'Built by a Data Engineer' },
        { icon: Brain, text: 'AI integrated (Gemini, GPT-4)' },
        { icon: Target, text: 'Based on real experience' },
      ]
    }
  }[language];

  return (
    <section className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} viewport={{ once: true }}>
            <span className="text-gold font-medium text-sm uppercase tracking-widest">{content.badge}</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mt-4 mb-8 text-white">
              {content.title}{' '}<span className="gradient-text">{content.titleHighlight}</span>
            </h2>
            <div className="space-y-6 text-slate-400 text-lg leading-relaxed">
              <p>{content.story}</p>
              <p>{content.story2}</p>
            </div>
            <p className="mt-8 text-gold font-semibold">{content.signature}</p>
            <div className="flex flex-wrap gap-4 mt-8">
              {content.proofs.map((proof, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2">
                  <proof.icon size={16} className="text-gold" />
                  <span className="text-sm text-slate-300">{proof.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }} viewport={{ once: true }} className="grid grid-cols-2 gap-6">
            {content.stats.map((stat, index) => (
              <div key={index} className="glass-card rounded-2xl p-6 text-center hover:border-gold/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                  <stat.icon size={24} className="text-gold" />
                </div>
                <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-slate-400 text-sm">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// EARLY ACCESS CTA
// ============================================
const EarlyAccessSection = () => {
  const { language } = useLanguage();

  const content = {
    fr: {
      badge: '🚀 Early Access',
      title: 'Soyez parmi les',
      titleHighlight: 'premiers',
      description: 'JobTracker est en phase de lancement. Rejoignez les premiers utilisateurs et participez à façonner l\'avenir de l\'outil.',
      cta: 'Rejoindre gratuitement',
      features: ['Accès complet et gratuit pendant le lancement', 'Vos retours façonnent les prochaines fonctionnalités', 'Support prioritaire direct avec le créateur'],
    },
    en: {
      badge: '🚀 Early Access',
      title: 'Be among the',
      titleHighlight: 'first',
      description: 'JobTracker is in launch phase. Join the first users and help shape the future of the tool.',
      cta: 'Join for free',
      features: ['Full access free during launch', 'Your feedback shapes upcoming features', 'Priority support directly with the creator'],
    }
  }[language];

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} viewport={{ once: true }}
          className="glass-card rounded-3xl p-10 md:p-14 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
          <span className="inline-block bg-gold/10 border border-gold/30 text-gold font-medium text-sm px-4 py-2 rounded-full mb-6">
            {content.badge}
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6 text-white">
            {content.title}{' '}<span className="gradient-text">{content.titleHighlight}</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">{content.description}</p>
          <ul className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-10">
            {content.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                <Check size={18} className="text-gold flex-shrink-0" />{feature}
              </li>
            ))}
          </ul>
          <a href="/register" className="inline-flex items-center bg-gold text-[#020817] hover:bg-gold-light px-10 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-gold/30 transition-all">
            {content.cta}<ArrowRight size={20} className="ml-2" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

// ============================================
// FAQ SECTION
// ============================================
const FAQSection = () => {
  const { language } = useLanguage();
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = language === 'fr' ? [
    { q: 'JobTracker est-il vraiment gratuit ?', a: 'Oui ! Le plan gratuit vous permet de suivre toutes vos candidatures sans limite de temps. Passez au Pro uniquement si vous avez besoin de fonctionnalités avancées.' },
    { q: 'Mes données sont-elles sécurisées ?', a: 'Absolument. Vos données sont chiffrées et stockées de manière sécurisée. Nous ne partageons jamais vos informations avec des tiers.' },
    { q: 'Comment fonctionne le conseiller IA ?', a: 'Notre IA analyse vos candidatures et votre CV pour vous donner des conseils personnalisés : amélioration du CV, stratégie de relance, préparation d\'entretiens. Compatible GPT-4, Gemini et Groq.' },
    { q: 'Puis-je exporter mes données ?', a: 'Oui, vous pouvez exporter toutes vos données en CSV à tout moment, directement depuis le tableau de bord.' },
    { q: 'Y a-t-il une application mobile ?', a: 'JobTracker est une Progressive Web App (PWA). Vous pouvez l\'installer sur votre téléphone comme une app native depuis votre navigateur.' },
  ] : [
    { q: 'Is JobTracker really free?', a: 'Yes! The free plan allows you to track all your applications with no time limit. Upgrade to Pro only for advanced features.' },
    { q: 'Is my data secure?', a: 'Absolutely. Your data is encrypted and stored securely. We never share your information with third parties.' },
    { q: 'How does the AI advisor work?', a: 'Our AI analyzes your applications and CV to give you personalized advice: CV improvement, follow-up strategy, interview preparation. Compatible with GPT-4, Gemini and Groq.' },
    { q: 'Can I export my data?', a: 'Yes, you can export all your data in CSV at any time, directly from the dashboard.' },
    { q: 'Is there a mobile app?', a: 'JobTracker is a Progressive Web App (PWA). You can install it on your phone like a native app from your browser.' },
  ];

  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">FAQ</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {language === 'fr' ? 'Questions ' : ''}
            <span className="gradient-text">{language === 'fr' ? 'fréquentes' : 'Frequently asked questions'}</span>
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }} viewport={{ once: true }}
              className="glass-card rounded-xl overflow-hidden"
            >
              <button onClick={() => setOpenIndex(openIndex === index ? null : index)} className="w-full flex items-center justify-between p-6 text-left">
                <span className="font-semibold text-white">{faq.q}</span>
                <ChevronDown size={20} className={`text-gold transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6 text-slate-400">{faq.a}</div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// CTA SECTION
// ============================================
const CTASection = () => {
  const { language } = useLanguage();

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#020817] via-navy/20 to-[#020817]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} viewport={{ once: true }}>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-6">
            {language === 'fr' ? 'Prêt à booster votre ' : 'Ready to boost your '}
            <span className="gradient-text">{language === 'fr' ? 'recherche ?' : 'job search?'}</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
            {language === 'fr'
              ? 'Rejoignez des milliers de chercheurs d\'emploi qui utilisent JobTracker pour décrocher leur job de rêve.'
              : 'Join thousands of job seekers using JobTracker to land their dream job.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/register" className="inline-flex items-center bg-gold text-[#020817] hover:bg-gold-light px-8 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-gold/30 transition-all">
              {language === 'fr' ? 'Commencer gratuitement' : 'Start for free'}
              <ArrowRight size={20} className="ml-2" />
            </a>
          </div>
          <p className="text-slate-500 text-sm mt-6">
            {language === 'fr' ? 'Aucune carte bancaire requise • Configuration en 30 secondes' : 'No credit card required • Setup in 30 seconds'}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

// ============================================
// FOOTER
// ============================================
const Footer = () => {
  const { language } = useLanguage();

  return (
    <footer className="border-t border-slate-800/50 pt-16 pb-8 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <img src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" alt="JobTracker" className="h-16 w-auto mb-4" />
            <p className="text-slate-400 text-sm">
              {language === 'fr' ? 'La plateforme intelligente pour gérer votre recherche d\'emploi.' : 'The smart platform to manage your job search.'}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">{language === 'fr' ? 'Produit' : 'Product'}</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-slate-400 hover:text-gold text-sm">{language === 'fr' ? 'Fonctionnalités' : 'Features'}</a></li>
              <li><a href="#pricing" className="text-slate-400 hover:text-gold text-sm">{language === 'fr' ? 'Tarifs' : 'Pricing'}</a></li>
              <li><a href="#faq" className="text-slate-400 hover:text-gold text-sm">FAQ</a></li>
              <li><a href="/support" className="text-slate-400 hover:text-gold text-sm">Support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">{language === 'fr' ? 'Légal' : 'Legal'}</h4>
            <ul className="space-y-2">
              <li><a href="/legal" className="text-slate-400 hover:text-gold text-sm">{language === 'fr' ? 'Mentions légales' : 'Legal Notice'}</a></li>
              <li><a href="/privacy" className="text-slate-400 hover:text-gold text-sm">{language === 'fr' ? 'Confidentialité' : 'Privacy'}</a></li>
              <li><a href="/terms" className="text-slate-400 hover:text-gold text-sm">{language === 'fr' ? 'CGU' : 'Terms'}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Contact</h4>
            <p className="text-slate-400 text-sm mb-4">
              {language === 'fr' ? 'Une question ? Écrivez-nous.' : 'Questions? Write to us.'}
            </p>
            <a href="mailto:abdoulam.diouf@maadec.com" className="text-gold hover:text-gold-light text-sm flex items-center gap-2">
              abdoulam.diouf@maadec.com <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} JobTracker. {language === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
          <p className="text-slate-600 text-sm font-mono bg-white/[0.02] px-3 py-1.5 rounded border border-white/5">
            {language === 'fr' ? 'Fait avec ❤️ par un Data Engineer en recherche d\'emploi' : 'Made with ❤️ by a Data Engineer job hunting'}
          </p>
        </div>
      </div>
    </footer>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function LandingPage() {
  return (
    <div className="relative overflow-x-hidden">
      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <Navigation />
      <HeroSection />
      <StatsStrip />
      <LogosSection />
      <FeaturesSection />
      <ChromeExtensionSection />
      <HowItWorksSection />
      <StorySection />
      {/* <PricingSection /> */}
      <EarlyAccessSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
