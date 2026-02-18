import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
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
    { label: language === 'fr' ? 'Tarifs' : 'Pricing', href: '#pricing' },
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
// HERO SECTION
// ============================================
const HeroSection = () => {
  const { language } = useLanguage();

  const t = {
    fr: {
      badge: '🎯 Organisez-vous. Préparez-vous. Réussissez.',
      title1: 'Mettez toutes les',
      title2: 'chances',
      title3: 'de votre côté',
      description: 'JobTracker ne vous promet pas de job miracle. Mais si vous vous donnez les moyens, il vous aide à rester organisé, à ne rien oublier et à être dans les meilleures conditions pour décrocher le poste que vous méritez.',
      cta: 'Commencer gratuitement',
      ctaSecondary: 'Voir la démo',
      stat1: 'Utilisateurs actifs',
      stat2: 'Candidatures suivies',
      stat3: 'Recommanderaient',
    },
    en: {
      badge: '🎯 Get organized. Get prepared. Get hired.',
      title1: 'Stack the',
      title2: 'odds',
      title3: 'in your favor',
      description: 'JobTracker won\'t magically land you a job. But if you put in the work, it helps you stay organized, never miss a follow-up, and be in the best position to land the role you deserve.',
      cta: 'Start for free',
      ctaSecondary: 'Watch demo',
      stat1: 'Active users',
      stat2: 'Applications tracked',
      stat3: 'Would recommend',
    }
  }[language];

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gold/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2 mb-8">
              <span className="text-sm font-medium text-slate-300">{t.badge}</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              {t.title1}{' '}
              <span className="gradient-text">{t.title2}</span>{' '}
              {t.title3}
            </h1>

            <p className="text-lg text-slate-400 mb-10 max-w-xl leading-relaxed">
              {t.description}
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
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

            {/* Social proof stats */}
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-3xl font-bold text-gold">10,000+</p>
                <p className="text-slate-500 text-sm">{t.stat1}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">500,000+</p>
                <p className="text-slate-500 text-sm">{t.stat2}</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-400">98%</p>
                <p className="text-slate-500 text-sm">{t.stat3}</p>
              </div>
            </div>
          </motion.div>

          {/* Hero Illustration */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.7, delay: 0.2 }} 
            className="hidden lg:flex items-center justify-center"
          >
            <div className="relative">
              <img 
                src="/hero-illustration.png" 
                alt="Organisez votre recherche d'emploi" 
                className="w-full max-w-lg drop-shadow-2xl"
              />
              {/* Floating badge */}
              <motion.div 
                className="absolute -bottom-4 -left-4 bg-navy border border-slate-700 rounded-xl p-4 shadow-xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Target size={24} className="text-gold mb-2" />
                <p className="text-white text-sm font-semibold">{language === 'fr' ? 'Restez focus' : 'Stay focused'}</p>
                <p className="text-slate-400 text-xs">{language === 'fr' ? 'Zéro oubli' : 'Never miss a thing'}</p>
              </motion.div>
              <motion.div 
                className="absolute -top-4 -right-4 bg-navy border border-slate-700 rounded-xl p-4 shadow-xl"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Brain size={24} className="text-gold mb-2" />
                <p className="text-white text-sm font-semibold">{language === 'fr' ? 'Conseils IA' : 'AI Advisor'}</p>
                <p className="text-slate-400 text-xs">{language === 'fr' ? 'Pour progresser' : 'Level up'}</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div className="absolute bottom-8 left-1/2 transform -translate-x-1/2" animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
        <ChevronDown size={32} className="text-slate-600" />
      </motion.div>
    </section>
  );
};

// ============================================
// LOGOS SECTION (Social Proof)
// ============================================
const LogosSection = () => {
  const { language } = useLanguage();
  
  return (
    <section className="py-12 border-y border-slate-800/50 bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-slate-500 text-sm mb-8">
          {language === 'fr' ? 'Ils nous font confiance pour leur recherche d\'emploi' : 'Trusted by job seekers from'}
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50">
          {['LinkedIn', 'Indeed', 'Welcome', 'APEC', 'Pôle Emploi', 'Glassdoor'].map((name) => (
            <span key={name} className="text-slate-400 font-semibold text-lg">{name}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// FEATURES SECTION
// ============================================
const FeaturesSection = () => {
  const { language } = useLanguage();

  const features = language === 'fr' ? [
    { icon: Briefcase, title: 'Suivi centralisé', description: 'Toutes vos candidatures en un seul endroit. Plus besoin de tableurs Excel.' },
    { icon: Calendar, title: 'Gestion des entretiens', description: 'Planifiez, préparez et suivez tous vos entretiens avec des rappels automatiques.' },
    { icon: Brain, title: 'Conseiller IA', description: 'Recevez des conseils personnalisés pour optimiser vos candidatures et CV.' },
    { icon: BarChart3, title: 'Statistiques avancées', description: 'Analysez votre taux de réponse et identifiez vos points d\'amélioration.' },
    { icon: Bell, title: 'Rappels intelligents', description: 'Ne manquez jamais une relance ou un entretien grâce aux notifications.' },
    { icon: Chrome, title: 'Extension Chrome', description: 'Ajoutez des offres en un clic depuis LinkedIn, Indeed et autres sites.' },
  ] : [
    { icon: Briefcase, title: 'Centralized tracking', description: 'All your applications in one place. No more Excel spreadsheets.' },
    { icon: Calendar, title: 'Interview management', description: 'Plan, prepare and track all your interviews with automatic reminders.' },
    { icon: Brain, title: 'AI Advisor', description: 'Get personalized advice to optimize your applications and CV.' },
    { icon: BarChart3, title: 'Advanced analytics', description: 'Analyze your response rate and identify areas for improvement.' },
    { icon: Bell, title: 'Smart reminders', description: 'Never miss a follow-up or interview with notifications.' },
    { icon: Chrome, title: 'Chrome Extension', description: 'Add job offers in one click from LinkedIn, Indeed and other sites.' },
  ];

  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">
            {language === 'fr' ? 'Fonctionnalités' : 'Features'}
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {language === 'fr' ? 'Tout ce qu\'il faut pour ' : 'Everything you need to '}
            <span className="gradient-text">{language === 'fr' ? 'réussir' : 'succeed'}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            {language === 'fr' 
              ? 'Des outils puissants pour organiser, suivre et optimiser votre recherche d\'emploi.'
              : 'Powerful tools to organize, track and optimize your job search.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl p-8 hover:border-slate-700/50 transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-navy/50 flex items-center justify-center mb-6 group-hover:bg-navy transition-colors">
                <feature.icon size={28} className="text-gold" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
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
    { step: '01', title: 'Créez votre compte', description: 'Inscrivez-vous gratuitement en 30 secondes. Aucune carte bancaire requise.' },
    { step: '02', title: 'Ajoutez vos candidatures', description: 'Importez vos candidatures manuellement ou via notre extension Chrome.' },
    { step: '03', title: 'Suivez votre progression', description: 'Visualisez vos stats, recevez des rappels et des conseils IA personnalisés.' },
    { step: '04', title: 'Décrochez le job', description: 'Optimisez votre stratégie et augmentez vos chances de succès.' },
  ] : [
    { step: '01', title: 'Create your account', description: 'Sign up for free in 30 seconds. No credit card required.' },
    { step: '02', title: 'Add your applications', description: 'Import your applications manually or via our Chrome extension.' },
    { step: '03', title: 'Track your progress', description: 'View your stats, receive reminders and personalized AI advice.' },
    { step: '04', title: 'Land the job', description: 'Optimize your strategy and increase your chances of success.' },
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
              <div className="text-6xl font-bold text-gold/20 mb-4">{item.step}</div>
              <h3 className="font-heading text-xl font-semibold text-white mb-3">{item.title}</h3>
              <p className="text-slate-400">{item.description}</p>
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

  const plans = language === 'fr' ? [
    {
      name: 'Gratuit',
      price: '0€',
      period: '/mois',
      description: 'Parfait pour commencer',
      features: ['50 candidatures', 'Suivi des entretiens', 'Statistiques de base', 'Extension Chrome'],
      cta: 'Commencer',
      popular: false,
    },
    {
      name: 'Pro',
      price: '9€',
      period: '/mois',
      description: 'Pour les chercheurs actifs',
      features: ['Candidatures illimitées', 'Conseiller IA avancé', 'Rappels automatiques', 'Export des données', 'Support prioritaire'],
      cta: 'Essai gratuit 14 jours',
      popular: true,
    },
    {
      name: 'Équipe',
      price: '29€',
      period: '/mois',
      description: 'Pour les coachs et écoles',
      features: ['Tout du plan Pro', 'Multi-utilisateurs', 'Dashboard admin', 'Rapports avancés', 'API access'],
      cta: 'Nous contacter',
      popular: false,
    },
  ] : [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Perfect to get started',
      features: ['50 applications', 'Interview tracking', 'Basic statistics', 'Chrome extension'],
      cta: 'Get started',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$9',
      period: '/month',
      description: 'For active job seekers',
      features: ['Unlimited applications', 'Advanced AI advisor', 'Automatic reminders', 'Data export', 'Priority support'],
      cta: '14-day free trial',
      popular: true,
    },
    {
      name: 'Team',
      price: '$29',
      period: '/month',
      description: 'For coaches and schools',
      features: ['Everything in Pro', 'Multi-users', 'Admin dashboard', 'Advanced reports', 'API access'],
      cta: 'Contact us',
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">
            {language === 'fr' ? 'Tarifs' : 'Pricing'}
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {language === 'fr' ? 'Choisissez votre ' : 'Choose your '}
            <span className="gradient-text">{language === 'fr' ? 'formule' : 'plan'}</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            {language === 'fr' 
              ? 'Commencez gratuitement, évoluez selon vos besoins.'
              : 'Start for free, scale as you grow.'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`glass-card rounded-2xl p-8 relative ${plan.popular ? 'border-gold/50 scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold text-[#020817] text-sm font-semibold px-4 py-1 rounded-full">
                  {language === 'fr' ? 'Populaire' : 'Popular'}
                </div>
              )}
              <h3 className="font-heading text-xl font-semibold text-white mb-2">{plan.name}</h3>
              <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-500">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <Check size={18} className="text-gold flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className={`w-full ${plan.popular ? 'bg-gold text-[#020817] hover:bg-gold-light' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// TESTIMONIALS SECTION
// ============================================
const TestimonialsSection = () => {
  const { language } = useLanguage();

  const testimonials = language === 'fr' ? [
    { name: 'Marie L.', role: 'Développeuse Frontend', quote: 'J\'ai décroché mon CDI en 3 semaines grâce à JobTracker. L\'IA m\'a aidé à améliorer mon CV.' },
    { name: 'Thomas R.', role: 'Data Analyst', quote: 'Fini les Excel ! Je peux enfin suivre mes 50+ candidatures sans m\'y perdre.' },
    { name: 'Sophie M.', role: 'Product Manager', quote: 'Les rappels automatiques m\'ont sauvé plusieurs entretiens. Indispensable !' },
  ] : [
    { name: 'Marie L.', role: 'Frontend Developer', quote: 'I got my permanent contract in 3 weeks thanks to JobTracker. The AI helped me improve my CV.' },
    { name: 'Thomas R.', role: 'Data Analyst', quote: 'No more Excel! I can finally track my 50+ applications without getting lost.' },
    { name: 'Sophie M.', role: 'Product Manager', quote: 'Automatic reminders saved me several interviews. Essential!' },
  ];

  return (
    <section className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">
            {language === 'fr' ? 'Témoignages' : 'Testimonials'}
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            {language === 'fr' ? 'Ils ont trouvé leur ' : 'They found their '}
            <span className="gradient-text">{language === 'fr' ? 'emploi' : 'job'}</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl p-8"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className="text-gold fill-gold" />
                ))}
              </div>
              <p className="text-slate-300 mb-6 italic">"{testimonial.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold">
                  {testimonial.name[0]}
                </div>
                <div>
                  <p className="text-white font-semibold">{testimonial.name}</p>
                  <p className="text-slate-500 text-sm">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
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
    { q: 'JobTracker est-il vraiment gratuit ?', a: 'Oui ! Le plan gratuit vous permet de suivre jusqu\'à 50 candidatures sans limite de temps. Passez au Pro uniquement si vous avez besoin de plus.' },
    { q: 'Mes données sont-elles sécurisées ?', a: 'Absolument. Vos données sont chiffrées et stockées de manière sécurisée. Nous ne partageons jamais vos informations avec des tiers.' },
    { q: 'Comment fonctionne le conseiller IA ?', a: 'Notre IA analyse vos candidatures et votre CV pour vous donner des conseils personnalisés : amélioration du CV, stratégie de relance, préparation d\'entretiens.' },
    { q: 'Puis-je exporter mes données ?', a: 'Oui, les utilisateurs Pro peuvent exporter toutes leurs données en CSV ou PDF à tout moment.' },
    { q: 'Y a-t-il une application mobile ?', a: 'JobTracker est une Progressive Web App (PWA). Vous pouvez l\'installer sur votre téléphone comme une app native.' },
  ] : [
    { q: 'Is JobTracker really free?', a: 'Yes! The free plan allows you to track up to 50 applications with no time limit. Upgrade to Pro only if you need more.' },
    { q: 'Is my data secure?', a: 'Absolutely. Your data is encrypted and stored securely. We never share your information with third parties.' },
    { q: 'How does the AI advisor work?', a: 'Our AI analyzes your applications and CV to give you personalized advice: CV improvement, follow-up strategy, interview preparation.' },
    { q: 'Can I export my data?', a: 'Yes, Pro users can export all their data in CSV or PDF at any time.' },
    { q: 'Is there a mobile app?', a: 'JobTracker is a Progressive Web App (PWA). You can install it on your phone like a native app.' },
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
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              viewport={{ once: true }}
              className="glass-card rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className="font-semibold text-white">{faq.q}</span>
                <ChevronDown size={20} className={`text-gold transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6 text-slate-400">
                  {faq.a}
                </div>
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
              {language === 'fr' 
                ? 'La plateforme intelligente pour gérer votre recherche d\'emploi.'
                : 'The smart platform to manage your job search.'}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">{language === 'fr' ? 'Produit' : 'Product'}</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-slate-400 hover:text-gold text-sm">{language === 'fr' ? 'Fonctionnalités' : 'Features'}</a></li>
              <li><a href="#pricing" className="text-slate-400 hover:text-gold text-sm">{language === 'fr' ? 'Tarifs' : 'Pricing'}</a></li>
              <li><a href="#faq" className="text-slate-400 hover:text-gold text-sm">FAQ</a></li>
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
            <a href="mailto:contact@jobtracker.app" className="text-gold hover:text-gold-light text-sm flex items-center gap-2">
              contact@jobtracker.app <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} JobTracker. {language === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}
          </p>
          <p className="text-slate-600 text-sm">
            {language === 'fr' ? 'Fait avec ❤️ en France' : 'Made with ❤️ in France'}
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
    <div className="relative">
      <Navigation />
      <HeroSection />
      <LogosSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
