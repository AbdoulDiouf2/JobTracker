import { useOpportunityCount } from '../../hooks/useOpportunities';
import { useLanguage } from '../../i18n';

/** Badge du nombre d'opportunités nouvelles. Rien n'est affiché si 0. */
export const OpportunitiesNavBadge = () => {
  const { data } = useOpportunityCount();
  const { language } = useLanguage();
  const count = data?.new ?? 0;
  if (count <= 0) return null;

  const label = language === 'fr'
    ? `${count} nouvelle${count > 1 ? 's' : ''} opportunité${count > 1 ? 's' : ''}`
    : `${count} new opportunit${count > 1 ? 'ies' : 'y'}`;

  return (
    <span
      className="min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-gold text-[#020817] text-xs font-bold tabular-nums flex items-center justify-center"
      title={label}
      data-testid="opportunities-nav-badge"
    >
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      {/* aria-label est ignoré sur un span sans rôle : texte réservé aux lecteurs d'écran */}
      <span className="sr-only">{label}</span>
    </span>
  );
};
