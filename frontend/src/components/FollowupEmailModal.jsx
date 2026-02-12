import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, Copy, Check, Send, Loader2, RefreshCw,
  User, Building2, AlertTriangle
} from 'lucide-react';
import { useTracking } from '../hooks/useTracking';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useLanguage } from '../i18n';

export const FollowupEmailModal = ({ application, isOpen, onClose, onEmailSent }) => {
  const { generateFollowupEmail, markReminderSent, loading } = useTracking();
  const { language } = useLanguage();
  const [email, setEmail] = useState(null);
  const [tone, setTone] = useState('professional');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const toneOptions = [
    { value: 'professional', label: 'Professionnel' },
    { value: 'friendly', label: 'Amical' },
    { value: 'formal', label: 'Formel' }
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateFollowupEmail(application.id, { tone, language });
      setEmail(result);
    } catch (err) {
      console.error('Erreur génération email:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAll = async () => {
    const fullEmail = `Objet: ${email.subject}\n\n${email.body}`;
    await handleCopy(fullEmail);
  };

  const handleMarkSent = async () => {
    try {
      await markReminderSent(application.id);
      if (onEmailSent) onEmailSent();
      onClose();
    } catch (err) {
      console.error('Erreur marquage rappel:', err);
    }
  };

  const handleOpenMailClient = () => {
    const mailtoLink = `mailto:${email.recipient_email || ''}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.open(mailtoLink, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Mail className="text-gold" size={24} />
            Générer un email de relance
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-4">
          {/* Application Info */}
          <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-lg">
              {application.entreprise[0]}
            </div>
            <div>
              <h3 className="font-medium text-white">{application.entreprise}</h3>
              <p className="text-gold text-sm">{application.poste}</p>
            </div>
          </div>

          {/* Contact Info */}
          {(application.contact_email || application.contact_name) && (
            <div className="p-4 bg-slate-800/30 rounded-xl">
              <p className="text-sm text-slate-400 mb-2">Destinataire</p>
              <div className="flex items-center gap-4">
                {application.contact_name && (
                  <div className="flex items-center gap-2 text-white">
                    <User size={16} className="text-slate-400" />
                    {application.contact_name}
                  </div>
                )}
                {application.contact_email && (
                  <div className="flex items-center gap-2 text-white">
                    <Mail size={16} className="text-slate-400" />
                    {application.contact_email}
                  </div>
                )}
              </div>
            </div>
          )}

          {!application.contact_email && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
              <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-medium">Email du recruteur non renseigné</p>
                <p className="text-yellow-400/70 text-sm">
                  Ajoutez l'email du contact dans les détails de la candidature pour une relance plus facile.
                </p>
              </div>
            </div>
          )}

          {/* Tone Selection */}
          {!email && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">Ton de l'email</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {toneOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={handleGenerate} 
                disabled={generating}
                className="w-full bg-gold hover:bg-gold-light text-[#020817]"
              >
                {generating ? (
                  <Loader2 className="animate-spin mr-2" size={18} />
                ) : (
                  <RefreshCw className="mr-2" size={18} />
                )}
                Générer l'email
              </Button>
            </div>
          )}

          {/* Generated Email */}
          {email && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Subject */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Objet</span>
                  <button
                    onClick={() => handleCopy(email.subject)}
                    className="text-slate-400 hover:text-gold transition-colors"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-white font-medium">{email.subject}</p>
              </div>

              {/* Body */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Corps de l'email</span>
                  <button
                    onClick={() => handleCopy(email.body)}
                    className="text-slate-400 hover:text-gold transition-colors"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-white whitespace-pre-wrap text-sm leading-relaxed">{email.body}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button 
                    onClick={handleCopyAll}
                    variant="outline" 
                    className="flex-1 border-slate-700"
                  >
                    <Copy className="mr-2" size={16} />
                    Copier tout
                  </Button>
                  {email.recipient_email && (
                    <Button 
                      onClick={handleOpenMailClient}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Mail className="mr-2" size={16} />
                      Ouvrir dans Mail
                    </Button>
                  )}
                </div>
                
                <Button 
                  onClick={handleMarkSent}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Send className="mr-2" size={16} />
                  Marquer comme envoyé
                </Button>

                <Button 
                  onClick={() => setEmail(null)}
                  variant="ghost" 
                  className="w-full text-slate-400 hover:text-white"
                >
                  <RefreshCw className="mr-2" size={16} />
                  Régénérer
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowupEmailModal;
