import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useLanguage } from '../../i18n';
import { isToApply } from '../../constants/application';

const safeFormat = (value, pattern, language) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, pattern, { locale: language === 'fr' ? fr : enUS });
};

/**
 * Date de candidature affichable.
 * Pour une candidature `to_apply`, date_candidature est TECHNIQUE : on affiche
 * « Pas encore envoyée » et la date d'ajout (created_at), jamais une date d'envoi.
 */
export const ApplicationSentDate = ({ app, pattern = 'dd MMM yyyy', showAdded = true }) => {
  const { language } = useLanguage();

  if (isToApply(app)) {
    const added = safeFormat(app.created_at || app.date_candidature, pattern, language);
    return (
      <span data-testid="application-not-sent">
        <span className="text-violet-400">{language === 'fr' ? 'Pas encore envoyée' : 'Not sent yet'}</span>
        {showAdded && added && (
          <span className="text-slate-500"> · {language === 'fr' ? 'ajoutée le' : 'added on'} {added}</span>
        )}
      </span>
    );
  }

  return <span>{safeFormat(app.date_candidature, pattern, language) || '—'}</span>;
};
