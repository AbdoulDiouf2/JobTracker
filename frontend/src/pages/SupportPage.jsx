import { useState } from 'react';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Mail, ArrowLeft, MessageSquare, Send, CheckCircle, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SupportPage() {
  const { language } = useLanguage();
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle, submitting, success, error.

  const t = {
    fr: {
      title: 'Support & Aide',
      subtitle: 'Comment pouvons-nous vous aider aujourd\'hui ?',
      back: 'Retour à l\'accueil',
      contact: 'Nous contacter',
      name: 'Nom complet',
      email: 'Adresse email',
      message: 'Votre message',
      send: 'Envoyer le message',
      success: 'Message envoyé avec succès ! Nous vous répondrons bientôt.',
      error: 'Une erreur est survenue. Veuillez réessayer ou nous écrire directement.',
      faqTitle: 'Questions Fréquentes',
      directContact: 'Contact direct',
      emailUs: 'Envoyez-nous un email à'
    },
    en: {
      title: 'Support & Help',
      subtitle: 'How can we help you today?',
      back: 'Back to Home',
      contact: 'Contact Us',
      name: 'Full Name',
      email: 'Email Address',
      message: 'Your Message',
      send: 'Send Message',
      success: 'Message sent successfully! We will get back to you soon.',
      error: 'An error occurred. Please try again or email us directly.',
      faqTitle: 'Frequently Asked Questions',
      directContact: 'Direct Contact',
      emailUs: 'Email us at'
    }
  }[language];

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('submitting');
    // Simulate API call
    setTimeout(() => {
      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white selection:bg-gold/30">
      {/* Header */}
      <nav className="border-b border-slate-800 bg-[#0a0f1a]/50 backdrop-blur-xl fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
             <img src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" alt="JobTracker" className="h-10 w-auto" />
             <span className="font-heading font-bold text-xl hidden sm:block">JobTracker</span>
          </a>
          <a href="/" className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors">
            <ArrowLeft size={16} />
            {t.back}
          </a>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <span className="inline-block p-3 rounded-2xl bg-gold/10 text-gold mb-6">
              <MessageSquare size={32} />
            </span>
            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">{t.title}</h1>
            <p className="text-xl text-slate-400">{t.subtitle}</p>
          </motion.div>

          <div className="grid gap-12 md:grid-cols-[2fr,1fr]">
            {/* Contact Form */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-8 border border-slate-800"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Mail className="text-gold" size={20} />
                {t.contact}
              </h2>

              {status === 'success' ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center">
                  <CheckCircle className="mx-auto text-green-400 mb-4" size={48} />
                  <p className="text-green-400 font-medium text-lg">{t.success}</p>
                  <Button 
                    variant="outline" 
                    className="mt-6 border-slate-700 hover:bg-slate-800"
                    onClick={() => setStatus('idle')}
                  >
                    Envoyer un autre message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">{t.name}</label>
                    <Input 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="bg-slate-900/50 border-slate-700 focus:border-gold/50"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">{t.email}</label>
                    <Input 
                      required
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="bg-slate-900/50 border-slate-700 focus:border-gold/50"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">{t.message}</label>
                    <Textarea 
                      required
                      value={formData.message}
                      onChange={e => setFormData({...formData, message: e.target.value})}
                      className="bg-slate-900/50 border-slate-700 focus:border-gold/50 min-h-[150px]"
                      placeholder="..."
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={status === 'submitting'}
                    className="w-full bg-gold hover:bg-gold-light text-[#020817] font-semibold"
                  >
                    {status === 'submitting' ? '...' : (
                      <>
                        {t.send} <Send size={16} className="ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </motion.div>

            {/* Side Info */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="glass-card rounded-xl p-6 border border-slate-800">
                <h3 className="font-semibold mb-4 text-slate-200">{t.directContact}</h3>
                <p className="text-slate-400 text-sm mb-2">{t.emailUs}</p>
                <a href="mailto:contact@jobtracker.app" className="text-gold hover:underline font-medium flex items-center gap-2">
                  contact@jobtracker.app
                  <ExternalLink size={14} />
                </a>
              </div>

              <div className="glass-card rounded-xl p-6 border border-slate-800">
                <h3 className="font-semibold mb-4 text-slate-200">{t.faqTitle}</h3>
                <ul className="space-y-4">
                  <li>
                    <a href="/#faq" className="text-sm text-slate-400 hover:text-gold transition-colors block">
                      {language === 'fr' ? 'Comment réinitialiser mon mot de passe ?' : 'How to reset my password?'}
                    </a>
                  </li>
                  <li>
                    <a href="/#faq" className="text-sm text-slate-400 hover:text-gold transition-colors block">
                      {language === 'fr' ? 'Le service est-il gratuit ?' : 'Is the service free?'}
                    </a>
                  </li>
                  <li>
                    <a href="/#faq" className="text-sm text-slate-400 hover:text-gold transition-colors block">
                      {language === 'fr' ? 'Comment supprimer mon compte ?' : 'How to delete my account?'}
                    </a>
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 bg-[#0a0f1a] py-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} JobTracker. {language === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
      </footer>
    </div>
  );
}
