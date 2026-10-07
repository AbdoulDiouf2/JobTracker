import { differenceInCalendarDays, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { MapPin, Briefcase, Clock, Radar, ExternalLink, EyeOff, Send, FileCheck, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useLanguage } from '../../i18n';
import { OPPORTUNITY_STATUS_META, getSourceLabel } from '../../constants/opportunity';
import { toSafeExternalUrl } from '../../lib/safeUrl';

export const formatDiscovered = (value, language = 'fr') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = differenceInCalendarDays(new Date(), date);
  if (language === 'fr') {
    if (days <= 0) return "Trouvée aujourd'hui";
    if (days === 1) return 'Trouvée hier';
    if (days < 7) return `Trouvée il y a ${days} jours`;
    return `Trouvée le ${format(date, 'd MMM yyyy', { locale: fr })}`;
  }
  if (days <= 0) return 'Found today';
  if (days === 1) return 'Found yesterday';
  if (days < 7) return `Found ${days} days ago`;
  return `Found on ${format(date, 'MMM d, yyyy', { locale: enUS })}`;
};

export const formatLocation = (opportunity) =>
  [opportunity.location, opportunity.country]
    .filter(Boolean)
    .filter((part, i, parts) => i === 0 || !parts[0].toLowerCase().includes(part.toLowerCase()))
    .join(', ');

export const OpportunityStatusBadge = ({ status }) => {
  const { language } = useLanguage();
  const meta = OPPORTUNITY_STATUS_META[status] || OPPORTUNITY_STATUS_META.new;
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.color}`}
      data-testid={`opportunity-status-${status}`}
    >
      {meta.label[language]}
    </span>
  );
};

/**
 * Actions d'une opportunité (carte et détail) :
 * Voir l'offre · Ignorer (si nouvelle) · Candidater (nouvelle/ignorée) ou Voir candidature (convertie).
 */
export const OpportunityActions = ({ opportunity, onIgnore, onConvert, onViewApplication, isConverting, isIgnoring, layout = 'card' }) => {
  const { language } = useLanguage();
  const safeUrl = toSafeExternalUrl(opportunity.url);
  const isConverted = opportunity.status === 'converted';
  const t = {
    fr: { view: "Voir l'offre", newTab: '(nouvel onglet)', ignore: 'Ignorer', apply: 'Candidater', applying: 'Création…', viewApp: 'Voir candidature' },
    en: { view: 'View offer', newTab: '(new tab)', ignore: 'Ignore', apply: 'Apply', applying: 'Creating…', viewApp: 'View application' },
  }[language];

  const touch = layout === 'dialog' ? 'h-10' : 'h-10 sm:h-9';

  return (
    <div className={`flex flex-wrap gap-2 ${layout === 'dialog' ? 'justify-end' : ''}`}>
      {safeUrl && (
        <Button asChild variant="ghost" size="sm" className={`${touch} text-slate-300 hover:text-white`}>
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" data-testid={`opportunity-view-offer-${opportunity.id}`}>
            <ExternalLink />
            {t.view}
            <span className="sr-only"> {t.newTab}</span>
          </a>
        </Button>
      )}
      {opportunity.status === 'new' && (
        <Button
          variant="ghost"
          size="sm"
          className={`${touch} text-slate-400 hover:text-white`}
          onClick={() => onIgnore(opportunity)}
          disabled={isIgnoring || isConverting}
          data-testid={`opportunity-ignore-${opportunity.id}`}
        >
          {isIgnoring ? <Loader2 className="animate-spin" /> : <EyeOff />}
          {t.ignore}
        </Button>
      )}
      {isConverted ? (
        <Button
          variant="outline"
          size="sm"
          className={`${touch} border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300`}
          onClick={() => onViewApplication(opportunity)}
          disabled={!opportunity.converted_application_id}
          data-testid={`opportunity-view-application-${opportunity.id}`}
        >
          <FileCheck />
          {t.viewApp}
        </Button>
      ) : (
        <Button
          size="sm"
          className={`${touch} bg-gold hover:bg-gold-light text-[#020817] font-semibold`}
          onClick={() => onConvert(opportunity)}
          disabled={isConverting}
          aria-busy={isConverting}
          data-testid={`opportunity-convert-${opportunity.id}`}
        >
          {isConverting ? <Loader2 className="animate-spin" /> : <Send />}
          {isConverting ? t.applying : t.apply}
        </Button>
      )}
    </div>
  );
};

export const OpportunityCard = ({ opportunity, onOpen, ...actionProps }) => {
  const { language } = useLanguage();
  const location = formatLocation(opportunity);
  const detailsLabel = language === 'fr' ? 'Voir les détails' : 'View details';

  return (
    <article
      className="glass-card rounded-xl border border-slate-800 hover:border-gold/40 transition-colors p-4 sm:p-5 flex flex-col gap-3 min-w-0"
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white break-words line-clamp-2">
            <button
              type="button"
              onClick={() => onOpen(opportunity)}
              className="text-left rounded-md hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              data-testid={`opportunity-open-${opportunity.id}`}
            >
              <span className="sr-only">{detailsLabel} : </span>
              {opportunity.title}
            </button>
          </h3>
          <p className="text-gold text-sm truncate">{opportunity.company}</p>
        </div>
        <OpportunityStatusBadge status={opportunity.status} />
      </div>

      {(location || opportunity.contract_type) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 min-w-0">
          {location && (
            <span className="flex items-center gap-1.5 min-w-0">
              <MapPin size={14} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{location}</span>
            </span>
          )}
          {opportunity.contract_type && (
            <span className="flex items-center gap-1.5">
              <Briefcase size={14} className="shrink-0" aria-hidden="true" />
              {opportunity.contract_type}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Clock size={12} aria-hidden="true" />
          {formatDiscovered(opportunity.discovered_at, language)}
        </span>
        <span className="flex items-center gap-1.5">
          <Radar size={12} aria-hidden="true" />
          {language === 'fr' ? 'Source' : 'Source'} : {getSourceLabel(opportunity.source, language)}
        </span>
      </div>

      <div className="mt-auto pt-3 border-t border-slate-800/60">
        <OpportunityActions opportunity={opportunity} {...actionProps} />
      </div>
    </article>
  );
};
