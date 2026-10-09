import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { useLanguage } from '../../i18n';
import { getOpportunitySourceLabel } from '../../constants/opportunity';
import { toSafeExternalUrl } from '../../lib/safeUrl';
import { OpportunityActions, OpportunityStatusBadge, formatLocation } from './OpportunityCard';

const Field = ({ label, children }) => (
  <div className="p-3 bg-slate-900/40 rounded-lg min-w-0">
    <p className="text-slate-500 text-xs mb-1">{label}</p>
    <div className="text-white text-sm font-medium break-words">{children}</div>
  </div>
);

export const OpportunityDetailDialog = ({ opportunity, isOpen, onClose, ...actionProps }) => {
  const { language } = useLanguage();
  if (!opportunity) return null;

  const t = {
    fr: {
      location: 'Lieu', contract: 'Contrat', source: 'Source', discovered: 'Découverte le', status: 'Statut',
      description: 'Description', noDescription: "Aucune description fournie.", link: 'Offre originale',
      invalidLink: 'Lien non disponible (adresse non sécurisée)', newTab: '(nouvel onglet)',
    },
    en: {
      location: 'Location', contract: 'Contract', source: 'Source', discovered: 'Discovered on', status: 'Status',
      description: 'Description', noDescription: 'No description provided.', link: 'Original offer',
      invalidLink: 'Link unavailable (unsafe address)', newTab: '(new tab)',
    },
  }[language];

  const safeUrl = toSafeExternalUrl(opportunity.url);
  const discovered = opportunity.discovered_at ? new Date(opportunity.discovered_at) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="bg-[#0a0f1a] border-slate-800 text-white w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] flex flex-col rounded-xl"
        data-testid="opportunity-detail-dialog"
      >
        <DialogHeader className="text-left pr-6">
          <DialogTitle className="font-heading text-xl break-words">{opportunity.title}</DialogTitle>
          <DialogDescription className="text-gold text-base break-words">{opportunity.company}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 -mr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t.status}><OpportunityStatusBadge status={opportunity.status} /></Field>
            <Field label={t.location}>{formatLocation(opportunity) || '—'}</Field>
            <Field label={t.contract}>{opportunity.contract_type || '—'}</Field>
            <Field label={t.source}>{getOpportunitySourceLabel(opportunity, language)}</Field>
            <Field label={t.discovered}>
              {discovered && !Number.isNaN(discovered.getTime())
                ? format(discovered, 'd MMMM yyyy', { locale: language === 'fr' ? fr : enUS })
                : '—'}
            </Field>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-lg">
            <p className="text-slate-500 text-xs mb-2">{t.description}</p>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap break-words" data-testid="opportunity-description">
              {opportunity.description || t.noDescription}
            </p>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-lg">
            <p className="text-slate-500 text-xs mb-2">{t.link}</p>
            {safeUrl ? (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold-light text-sm flex items-start gap-2 break-all"
                data-testid="opportunity-original-link"
              >
                <ExternalLink size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                {opportunity.url}
                <span className="sr-only"> {t.newTab}</span>
              </a>
            ) : (
              <p className="text-slate-500 text-sm">{t.invalidLink}</p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-800 pt-4">
          <OpportunityActions opportunity={opportunity} layout="dialog" {...actionProps} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
