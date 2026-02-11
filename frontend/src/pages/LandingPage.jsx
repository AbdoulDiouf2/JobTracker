import { useState, useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { 
  Briefcase, BarChart3, Brain, Bot, Database, Shield, FileJson, 
  Calendar, Search, Star, Filter, Download, Upload, Terminal,
  ChevronDown, Github, Linkedin, Mail, ExternalLink, Play,
  Sparkles, Zap, Lock, Server, Code2, Container, Layers,
  FileSpreadsheet, FileText, ArrowRight, MessageSquare, User,
  Check, TrendingUp, Target, Clock, Settings, Menu, X
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { Button } from "../components/ui/button";

// Navigation Component
const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Analytics', href: '#analytics' },
    { label: 'AI', href: '#ai' },
    { label: 'Architecture', href: '#architecture' },
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
          {/* Logo */}
          <a href="#" data-testid="logo-link" className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_careernav-3/artifacts/weqttcvo_logo_maadec_copie_bis.png" 
              alt="MAADEC Logo" 
              className="h-12 w-auto"
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                data-testid={`nav-link-${link.label.toLowerCase()}`}
                className="text-slate-400 hover:text-gold font-medium transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <a
              href="#contact"
              data-testid="nav-cta-button"
              className="bg-gold text-[#020817] hover:bg-gold-light px-6 py-2.5 rounded-full font-semibold transition-all duration-300 shadow-[0_0_20px_-5px_rgba(196,160,82,0.3)] hover:shadow-[0_0_30px_-5px_rgba(196,160,82,0.5)]"
            >
              Get in Touch
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            data-testid="mobile-menu-toggle"
            className="md:hidden text-slate-300 p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#0f172a] border-t border-slate-800 py-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block py-3 px-4 text-slate-300 hover:text-gold hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="px-4 pt-4">
              <a
                href="#contact"
                className="block w-full text-center bg-gold text-[#020817] py-3 rounded-full font-semibold"
              >
                Get in Touch
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
};

// Hero Section
const HeroSection = () => {
  return (
    <section data-testid="hero-section" className="hero-bg relative min-h-screen flex items-center pt-20">
      {/* Floating particles */}
      <div className="particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="particle" />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2 mb-8">
              <Sparkles size={16} className="text-gold" />
              <span className="text-sm font-medium text-slate-300">AI-Powered Job Tracking</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Track Applications.{' '}
              <span className="gradient-text">Analyze Performance.</span>{' '}
              Optimize Your Career with AI.
            </h1>

            <p className="text-lg text-slate-400 mb-10 max-w-xl leading-relaxed">
              An intelligent full-stack platform that transforms how you manage job applications. 
              Powered by Google Gemini Pro and OpenAI GPT-3.5 for smart career insights.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                data-testid="hero-cta-demo"
                className="bg-gold text-[#020817] hover:bg-gold-light px-8 py-6 rounded-full font-semibold text-lg shadow-[0_0_20px_-5px_rgba(196,160,82,0.3)] hover:shadow-[0_0_30px_-5px_rgba(196,160,82,0.5)] transition-all duration-300"
              >
                <Play size={20} className="mr-2" />
                View Live Demo
              </Button>
              <a
                href="#architecture"
                data-testid="hero-cta-architecture"
                className="inline-flex items-center bg-slate-800/50 text-white border border-slate-700 hover:bg-slate-800 hover:border-slate-600 px-8 py-4 rounded-full font-semibold transition-all duration-300 backdrop-blur-sm"
              >
                <Code2 size={20} className="mr-2" />
                Explore Architecture
              </a>
            </div>

            {/* Tech badges */}
            <div className="flex flex-wrap gap-3 mt-12">
              {['Flask', 'React', 'SQLAlchemy', 'Docker', 'Gemini Pro', 'GPT-3.5'].map((tech) => (
                <span 
                  key={tech} 
                  className="tech-badge bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-full text-sm text-slate-400 font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right - Dashboard Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="dashboard-mockup hidden lg:block"
          >
            <div className="dashboard-mockup-inner relative">
              {/* Main Dashboard Card */}
              <div className="glass-card rounded-2xl p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-heading font-semibold text-white">Application Dashboard</h3>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-slate-500 text-sm mb-1">Total Applications</p>
                    <p className="text-2xl font-bold text-white">147</p>
                    <p className="text-green-400 text-sm flex items-center mt-1">
                      <TrendingUp size={14} className="mr-1" /> +12%
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-slate-500 text-sm mb-1">Interviews</p>
                    <p className="text-2xl font-bold text-gold">23</p>
                    <p className="text-gold/70 text-sm flex items-center mt-1">
                      <Calendar size={14} className="mr-1" /> 3 this week
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-slate-500 text-sm mb-1">Response Rate</p>
                    <p className="text-2xl font-bold text-white">34%</p>
                    <p className="text-blue-400 text-sm flex items-center mt-1">
                      <Target size={14} className="mr-1" /> Above avg
                    </p>
                  </div>
                </div>

                {/* Mini Chart */}
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
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>
                </div>

                {/* Recent Applications */}
                <div className="space-y-3">
                  {[
                    { company: 'Google', role: 'Senior Engineer', status: 'Interview', statusColor: 'text-green-400' },
                    { company: 'Stripe', role: 'Full Stack Dev', status: 'Applied', statusColor: 'text-blue-400' },
                    { company: 'Notion', role: 'Backend Lead', status: 'In Review', statusColor: 'text-yellow-400' },
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

              {/* Floating AI Badge */}
              <motion.div 
                className="absolute -top-4 -right-4 bg-navy border border-slate-700 rounded-xl p-4 shadow-xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Brain size={24} className="text-gold mb-2" />
                <p className="text-white text-sm font-semibold">AI Advisor</p>
                <p className="text-slate-400 text-xs">Active</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
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
  const features = [
    {
      icon: Briefcase,
      title: 'Application Management',
      description: 'Centralized tracking for all your job applications with custom statuses and notes.'
    },
    {
      icon: Calendar,
      title: 'Interview Scheduling',
      description: 'Manage upcoming interviews, set reminders, and track interview outcomes.'
    },
    {
      icon: Search,
      title: 'Smart Filtering',
      description: 'Powerful search and filter capabilities to find applications instantly.'
    },
    {
      icon: Star,
      title: 'Favorites System',
      description: 'Mark priority applications and access them quickly from your dashboard.'
    },
    {
      icon: Filter,
      title: 'Status Tracking',
      description: 'Track application stages from Applied to Offer with visual indicators.'
    },
    {
      icon: Zap,
      title: 'Bulk Operations',
      description: 'Update multiple applications at once with powerful batch actions.'
    },
  ];

  return (
    <AnimatedSection id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">Features</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            Everything You Need to <span className="gradient-text">Land Your Dream Job</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            A comprehensive toolkit designed for modern job seekers who want to stay organized and strategic.
          </p>
        </div>

        {/* Features Grid */}
        <div data-testid="features-grid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              data-testid={`feature-card-${index}`}
              className="feature-card glass-card rounded-2xl p-8 hover:border-slate-700/50 transition-all duration-300 group cursor-default"
            >
              <div className="w-14 h-14 rounded-xl bg-navy/50 flex items-center justify-center mb-6 group-hover:bg-navy transition-colors duration-300">
                <feature.icon size={28} className="text-gold" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
};

// Analytics Section
const AnalyticsSection = () => {
  const kpis = [
    { label: 'Response Rate', value: '34%', change: '+5%', trend: 'up' },
    { label: 'Interview Conversion', value: '23%', change: '+8%', trend: 'up' },
    { label: 'Avg. Response Time', value: '4.2d', change: '-1.5d', trend: 'up' },
    { label: 'Active Applications', value: '47', change: '+12', trend: 'up' },
  ];

  return (
    <AnimatedSection id="analytics" className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Content */}
          <div>
            <span className="text-gold font-medium text-sm uppercase tracking-widest">Analytics</span>
            <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
              Data-Driven <span className="gradient-text">Career Decisions</span>
            </h2>
            <p className="text-slate-400 mt-6 text-lg leading-relaxed">
              Gain valuable insights into your job search with comprehensive analytics. 
              Track response rates, interview conversions, and application trends over time.
            </p>

            {/* KPI Cards */}
            <div data-testid="analytics-kpis" className="grid grid-cols-2 gap-4 mt-10">
              {kpis.map((kpi, index) => (
                <div 
                  key={kpi.label}
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

          {/* Right - Chart Visualization */}
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-semibold text-white">Application Timeline</h3>
              <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300">
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>This year</option>
              </select>
            </div>

            {/* Chart Area */}
            <div className="relative h-64">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-slate-500">
                <span>50</span>
                <span>40</span>
                <span>30</span>
                <span>20</span>
                <span>10</span>
                <span>0</span>
              </div>

              {/* Chart bars */}
              <div className="ml-8 h-full flex items-end gap-2 pb-8">
                {[30, 45, 38, 52, 48, 65, 58, 72, 68, 85, 78, 92].map((value, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <motion.div
                      initial={{ height: 0 }}
                      whileInView={{ height: `${(value / 100) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      viewport={{ once: true }}
                      className={`w-full rounded-t ${i === 11 ? 'bg-gold' : 'bg-navy'}`}
                    />
                  </div>
                ))}
              </div>

              {/* X-axis labels */}
              <div className="ml-8 flex justify-between text-xs text-slate-500 mt-2">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-navy" />
                <span className="text-sm text-slate-400">Applications</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gold" />
                <span className="text-sm text-slate-400">Current Month</span>
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
  const chatMessages = [
    { role: 'user', message: 'How should I prepare for a senior engineer interview at FAANG?' },
    { role: 'ai', message: 'Based on your profile, focus on these key areas:\n\n1. System Design - Practice designing scalable systems\n2. Behavioral - Use STAR method with your project examples\n3. Coding - LeetCode medium/hard problems\n\nYour Flask + AI experience is a strong differentiator. Emphasize the Job Tracking project!' },
    { role: 'user', message: 'What\'s my current application success rate?' },
    { role: 'ai', message: 'Your response rate is 34%, which is 12% above the industry average. Your strongest sectors are Tech Startups (45% response) and Enterprise (38% response).' },
  ];

  return (
    <AnimatedSection id="ai" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-navy/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">AI Intelligence</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            Powered by <span className="gradient-text">Advanced AI</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            Leveraging Google Gemini Pro and OpenAI GPT-3.5 for intelligent career guidance and real-time assistance.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* AI Career Advisor Card */}
          <div data-testid="ai-career-advisor-card" className="glass-card rounded-2xl p-8 border-gold/20 hover:border-gold/40 transition-colors duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
                <Brain size={28} className="text-gold" />
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold text-white">AI Career Advisor</h3>
                <p className="text-slate-500 text-sm">Powered by Google Gemini Pro</p>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {[
                'Personalized career strategy recommendations',
                'CV/Resume analysis (PDF & Word support)',
                'Market trend analysis and insights',
                'Interview preparation guidance',
                'Smart caching with 60s cooldown & 24h retention'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300">
                  <Check size={18} className="text-gold mt-1 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="bg-slate-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={16} className="text-slate-500" />
                <span className="text-sm text-slate-400">Upload your CV for AI analysis</span>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">.pdf</span>
                <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">.docx</span>
                <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">.doc</span>
              </div>
            </div>
          </div>

          {/* AI Chatbot Card */}
          <div data-testid="ai-chatbot-card" className="glass-card rounded-2xl p-8 border-navy/50 hover:border-navy transition-colors duration-300">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-navy to-navy/50 flex items-center justify-center">
                <Bot size={28} className="text-gold" />
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold text-white">AI Chatbot Assistant</h3>
                <p className="text-slate-500 text-sm">Powered by OpenAI GPT-3.5</p>
              </div>
            </div>

            {/* Chat Interface Mockup */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-4 max-h-80 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                      <span className="text-xs text-slate-500 uppercase">{msg.role}</span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-line">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input mockup */}
            <div className="mt-4 flex gap-2">
              <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-500">
                Ask about your job search...
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
  const techStack = [
    { category: 'Backend', items: [
      { name: 'Python Flask', icon: Server },
      { name: 'SQLAlchemy ORM', icon: Database },
      { name: 'SQLite', icon: Database },
    ]},
    { category: 'Frontend', items: [
      { name: 'HTML5 / CSS3', icon: Code2 },
      { name: 'Bootstrap 5.3', icon: Layers },
      { name: 'JavaScript / jQuery', icon: Terminal },
    ]},
    { category: 'AI & APIs', items: [
      { name: 'Google Gemini Pro', icon: Brain },
      { name: 'OpenAI GPT-3.5', icon: Bot },
      { name: 'Chart.js', icon: BarChart3 },
    ]},
    { category: 'DevOps', items: [
      { name: 'Docker', icon: Container },
      { name: 'Docker Compose', icon: Layers },
      { name: '.env Configuration', icon: Lock },
    ]},
  ];

  return (
    <AnimatedSection id="architecture" className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">Architecture</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            Built for <span className="gradient-text">Production</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            A robust, scalable architecture following industry best practices for enterprise-grade applications.
          </p>
        </div>

        {/* Tech Stack Grid */}
        <div data-testid="architecture-grid" className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {techStack.map((category, index) => (
            <motion.div
              key={category.category}
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

        {/* Architecture Diagram */}
        <div className="glass-card rounded-2xl p-8">
          <h3 className="font-heading text-xl font-semibold text-white mb-8 text-center">System Architecture</h3>
          
          <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8">
            {/* Client */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-24 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col items-center justify-center">
                <User size={24} className="text-gold mb-2" />
                <span className="text-sm text-slate-300">Client</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">Browser</span>
            </div>

            <ArrowRight className="text-slate-600 hidden lg:block" />
            <ChevronDown className="text-slate-600 lg:hidden" />

            {/* Frontend */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-24 bg-navy/30 border border-navy rounded-xl flex flex-col items-center justify-center">
                <Code2 size={24} className="text-gold mb-2" />
                <span className="text-sm text-slate-300">Frontend</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">Bootstrap + JS</span>
            </div>

            <ArrowRight className="text-slate-600 hidden lg:block" />
            <ChevronDown className="text-slate-600 lg:hidden" />

            {/* Backend */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-24 bg-gold/10 border border-gold/30 rounded-xl flex flex-col items-center justify-center">
                <Server size={24} className="text-gold mb-2" />
                <span className="text-sm text-slate-300">Backend</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">Flask API</span>
            </div>

            <ArrowRight className="text-slate-600 hidden lg:block" />
            <ChevronDown className="text-slate-600 lg:hidden" />

            {/* Database & AI */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex flex-col items-center">
                <div className="w-32 h-24 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col items-center justify-center">
                  <Database size={24} className="text-gold mb-2" />
                  <span className="text-sm text-slate-300">Database</span>
                </div>
                <span className="text-xs text-slate-500 mt-2">SQLite</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-32 h-24 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col items-center justify-center">
                  <Brain size={24} className="text-gold mb-2" />
                  <span className="text-sm text-slate-300">AI APIs</span>
                </div>
                <span className="text-xs text-slate-500 mt-2">Gemini + GPT</span>
              </div>
            </div>
          </div>

          {/* Docker container indicator */}
          <div className="mt-8 pt-8 border-t border-slate-700/50 flex items-center justify-center gap-3">
            <Container size={20} className="text-slate-500" />
            <span className="text-sm text-slate-400">Containerized with Docker Compose</span>
          </div>
        </div>

        {/* Folder Structure */}
        <div className="mt-8 glass-card rounded-2xl p-8">
          <h3 className="font-heading text-xl font-semibold text-white mb-6">Project Structure</h3>
          <div className="font-mono text-sm overflow-x-auto">
            <pre className="text-slate-400">
{`job-tracking/
├── app/
│   ├── __init__.py          # Flask app initialization
│   ├── routes/              # API endpoints
│   │   ├── applications.py
│   │   ├── interviews.py
│   │   └── ai_advisor.py
│   ├── models/              # SQLAlchemy models
│   ├── services/            # Business logic
│   │   ├── gemini_service.py
│   │   └── openai_service.py
│   └── templates/           # Jinja2 templates
├── static/
│   ├── css/
│   └── js/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
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
  const formats = [
    { name: 'Excel', icon: FileSpreadsheet, ext: '.xlsx', description: 'Full data export with formatting' },
    { name: 'CSV', icon: FileText, ext: '.csv', description: 'Universal compatibility' },
    { name: 'JSON', icon: FileJson, ext: '.json', description: 'API-ready format' },
    { name: 'PDF Report', icon: Download, ext: '.pdf', description: 'Statistics & analytics' },
  ];

  return (
    <AnimatedSection className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Content */}
          <div>
            <span className="text-gold font-medium text-sm uppercase tracking-widest">Data Management</span>
            <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
              Export & Import <span className="gradient-text">Your Data</span>
            </h2>
            <p className="text-slate-400 mt-6 text-lg leading-relaxed">
              Full control over your data. Import existing applications or export everything 
              in multiple formats for backup, analysis, or migration.
            </p>

            <div className="mt-10 space-y-4">
              {['Bulk import from spreadsheets', 'One-click data backup', 'Statistics PDF generation', 'API-compatible JSON export'].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300">
                  <Check size={18} className="text-gold" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Format Cards */}
          <div data-testid="export-formats-grid" className="grid grid-cols-2 gap-4">
            {formats.map((format, index) => (
              <motion.div
                key={format.name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-card rounded-xl p-6 hover:border-gold/30 transition-all duration-300 cursor-default group"
              >
                <format.icon size={32} className="text-gold mb-4 group-hover:scale-110 transition-transform duration-300" />
                <h4 className="font-heading font-semibold text-white mb-1">{format.name}</h4>
                <span className="text-gold text-sm font-mono">{format.ext}</span>
                <p className="text-slate-500 text-sm mt-2">{format.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

// Security Section
const SecuritySection = () => {
  const securityFeatures = [
    { icon: Lock, title: '.env Secret Management', description: 'All sensitive credentials stored securely in environment variables' },
    { icon: Shield, title: 'Protected Admin Routes', description: 'Role-based access control for administrative functions' },
    { icon: Database, title: 'Controlled Database Reset', description: 'Safe database operations with confirmation safeguards' },
    { icon: Clock, title: 'API Rate Limiting', description: '60s cooldown and 24h caching for AI API optimization' },
  ];

  return (
    <AnimatedSection className="py-24 md:py-32 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">Security</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            Built with <span className="gradient-text">Security First</span>
          </h2>
        </div>

        <div data-testid="security-grid" className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center p-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-navy/30 border border-navy flex items-center justify-center mx-auto mb-4">
                <feature.icon size={28} className="text-gold" />
              </div>
              <h4 className="font-heading font-semibold text-white mb-2">{feature.title}</h4>
              <p className="text-slate-500 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
};

// Technical Deep Dive Section
const TechnicalDeepDiveSection = () => {
  const topics = [
    {
      title: 'AI Caching Mechanism',
      content: `The AI integration uses a sophisticated caching system:
      
• 60-second cooldown between requests to prevent API abuse
• 24-hour cache retention for identical queries
• Fallback responses when rate limits are reached
• Automatic cache invalidation for updated user data`
    },
    {
      title: 'Chatbot Integration Architecture',
      content: `The OpenAI GPT-3.5 chatbot is integrated with:

• WebSocket support for real-time responses
• Context window management for conversation history
• User profile injection for personalized responses
• Streaming response rendering for better UX`
    },
    {
      title: 'Flask Routing Structure',
      content: `RESTful API design following best practices:

• Blueprint-based route organization
• JWT authentication middleware
• Request validation with marshmallow schemas
• Comprehensive error handling with custom exceptions`
    },
    {
      title: 'Database Initialization Flow',
      content: `SQLite with SQLAlchemy ORM provides:

• Automatic schema migration on startup
• Seed data injection for demo mode
• Connection pooling for performance
• Transaction management with rollback support`
    },
    {
      title: 'Docker Deployment',
      content: `Production-ready containerization:

• Multi-stage Dockerfile for optimized images
• Docker Compose for service orchestration
• Health checks and restart policies
• Volume mounting for data persistence`
    },
  ];

  return (
    <AnimatedSection className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold font-medium text-sm uppercase tracking-widest">Deep Dive</span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-4 text-white">
            Technical <span className="gradient-text">Implementation Details</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">
            For the curious engineers and technical recruiters who want to see under the hood.
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
  return (
    <AnimatedSection id="contact" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background effects */}
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
            Interested in Building{' '}
            <span className="gradient-text">Intelligent Platforms?</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
            I'm passionate about creating AI-powered solutions that solve real problems. 
            Let's discuss how we can work together on your next project.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:contact@maadec.com"
              data-testid="cta-contact-button"
              className="inline-flex items-center bg-gold text-[#020817] hover:bg-gold-light px-8 py-4 rounded-full font-semibold text-lg shadow-[0_0_30px_-5px_rgba(196,160,82,0.4)] hover:shadow-[0_0_40px_-5px_rgba(196,160,82,0.6)] transition-all duration-300"
            >
              <Mail size={20} className="mr-2" />
              Let's Work Together
            </a>
            <a
              href="#"
              data-testid="cta-github-button"
              className="inline-flex items-center bg-slate-800/50 text-white border border-slate-700 hover:bg-slate-800 hover:border-slate-600 px-8 py-4 rounded-full font-semibold transition-all duration-300 backdrop-blur-sm"
            >
              <Github size={20} className="mr-2" />
              View on GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
};

// Footer
const Footer = () => {
  const footerLinks = {
    project: [
      { label: 'Features', href: '#features' },
      { label: 'Analytics', href: '#analytics' },
      { label: 'AI Intelligence', href: '#ai' },
      { label: 'Architecture', href: '#architecture' },
    ],
    tech: [
      { label: 'Flask', href: '#' },
      { label: 'SQLAlchemy', href: '#' },
      { label: 'Google Gemini', href: '#' },
      { label: 'OpenAI GPT', href: '#' },
    ],
    connect: [
      { label: 'GitHub', href: '#', icon: Github },
      { label: 'LinkedIn', href: '#', icon: Linkedin },
      { label: 'Email', href: 'mailto:contact@maadec.com', icon: Mail },
    ],
  };

  return (
    <footer data-testid="footer" className="footer-bg border-t border-slate-800/50 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <img 
              src="https://customer-assets.emergentagent.com/job_careernav-3/artifacts/weqttcvo_logo_maadec_copie_bis.png" 
              alt="MAADEC Logo" 
              className="h-14 w-auto mb-6"
            />
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Full-Stack & AI Engineer building production-ready intelligent web applications.
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

          {/* Project Links */}
          <div>
            <h4 className="font-heading font-semibold text-white mb-6">Project</h4>
            <ul className="space-y-3">
              {footerLinks.project.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-slate-400 hover:text-gold transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech Stack */}
          <div>
            <h4 className="font-heading font-semibold text-white mb-6">Tech Stack</h4>
            <ul className="space-y-3">
              {footerLinks.tech.map((link) => (
                <li key={link.label}>
                  <span className="text-slate-400 text-sm">{link.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold text-white mb-6">Get in Touch</h4>
            <p className="text-slate-400 text-sm mb-4">
              Open to opportunities and collaborations in AI & Full-Stack development.
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

        {/* Bottom Bar */}
        <div className="section-divider mb-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} MAADEC - MAAD Engineering & Consulting. All rights reserved.
          </p>
          <p className="text-slate-600 text-sm">
            Built with Flask, React, and AI
          </p>
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
