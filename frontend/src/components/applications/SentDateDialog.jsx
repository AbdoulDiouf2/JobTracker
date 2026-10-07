import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { useLanguage } from '../../i18n';

/** Date "yyyy-MM-dd" (saisie) -> ISO, à midi local pour ne jamais décaler le jour. */
export const sentDateToIso = (yyyyMmDd) => new Date(`${yyyyMmDd}T12:00:00`).toISOString();

/**
 * Passage to_apply -> pending : demande la VRAIE date d'envoi.
 * Aucune date n'est inventée : l'utilisateur confirme explicitement (préremplie à aujourd'hui).
 */
export const SentDateDialog = ({ isOpen, onCancel, onConfirm, loading = false }) => {
  const { language } = useLanguage();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);

  useEffect(() => {
    if (isOpen) setDate(format(new Date(), 'yyyy-MM-dd'));
  }, [isOpen]);

  const t = {
    fr: {
      title: 'Candidature envoyée',
      question: 'À quelle date avez-vous envoyé cette candidature ?',
      label: "Date d'envoi",
      invalid: 'Choisissez une date passée ou aujourd’hui.',
      cancel: 'Annuler',
      confirm: 'Confirmer',
    },
    en: {
      title: 'Application sent',
      question: 'On what date did you send this application?',
      label: 'Sending date',
      invalid: 'Choose today or a past date.',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
  }[language];

  const isValid = !!date && date <= today;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || loading) return;
    onConfirm(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !loading) onCancel(); }}>
      <DialogContent
        className="bg-slate-900 border border-slate-700 text-white w-[calc(100%-2rem)] max-w-sm rounded-xl"
        data-testid="sent-date-dialog"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader className="text-left pr-6">
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <Send size={18} className="text-gold" aria-hidden="true" />
              {t.title}
            </DialogTitle>
            <DialogDescription className="text-slate-400">{t.question}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sent-date-input" className="text-slate-300">{t.label}</Label>
            <input
              id="sent-date-input"
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!isValid}
              className="w-full h-10 bg-slate-800 border border-slate-600 rounded-lg px-3 text-white focus:outline-none focus:border-[#c4a052] transition-colors"
              data-testid="sent-date-input"
            />
            {!isValid && <p role="alert" className="text-xs text-red-400">{t.invalid}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="h-10 text-slate-400 hover:text-white">
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || loading}
              aria-busy={loading}
              className="h-10 bg-[#c4a052] hover:bg-[#b8934a] text-[#020817] font-semibold"
              data-testid="sent-date-confirm"
            >
              {loading && <Loader2 className="animate-spin" />}
              {t.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
