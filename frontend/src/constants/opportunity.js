/**
 * Constantes du module Opportunités (offres découvertes, pas encore candidatées).
 */

export const OPPORTUNITY_STATUS = {
  NEW: 'new',
  IGNORED: 'ignored',
  CONVERTED: 'converted',
};

export const OPPORTUNITY_STATUS_META = {
  new:       { label: { fr: 'Nouvelle',  en: 'New' },       color: 'bg-gold/15 text-gold border-gold/30' },
  ignored:   { label: { fr: 'Ignorée',   en: 'Ignored' },   color: 'bg-slate-700/40 text-slate-400 border-slate-600' },
  converted: { label: { fr: 'Convertie', en: 'Converted' }, color: 'bg-green-500/15 text-green-400 border-green-500/30' },
};

export const OPPORTUNITY_FILTERS = [
  { value: 'all',       label: { fr: 'Toutes',     en: 'All' } },
  { value: 'new',       label: { fr: 'Nouvelles',  en: 'New' } },
  { value: 'ignored',   label: { fr: 'Ignorées',   en: 'Ignored' } },
  { value: 'converted', label: { fr: 'Converties', en: 'Converted' } },
];

const SOURCE_LABELS = {
  chatgpt_watch:    { fr: 'Veille (antérieure)', en: 'Watch (earlier)' },
  chrome_extension: { fr: 'Extension Chrome', en: 'Chrome extension' },
  manual:           { fr: 'Ajout manuel',     en: 'Manual' },
  external_agent:   { fr: 'Agent externe',    en: 'External agent' },
  other:            { fr: 'Autre',            en: 'Other' },
};

export const getSourceLabel = (source, language = 'fr') =>
  SOURCE_LABELS[source]?.[language] || source || SOURCE_LABELS.other[language];

const WATCH_SOURCE = 'chatgpt_watch';

const WATCH_LABELS = {
  legacy: { fr: 'Veille (antérieure)', en: 'Watch (earlier)' },
  unknown: { fr: 'Veille (client inconnu)', en: 'Watch (unknown client)' },
  named: { fr: (n) => `Veille ${n}`, en: (n) => `${n} watch` },
};

/** Libellé d'une provenance calculée par le serveur (`origin`), aussi utilisé par les filtres. */
export const getOriginLabel = (origin, language = 'fr') => {
  const lang = language === 'en' ? 'en' : 'fr';
  if (!origin) return SOURCE_LABELS.other[lang];
  if (origin.kind === 'watch_legacy') return WATCH_LABELS.legacy[lang];
  if (origin.kind === 'client') {
    const name = typeof origin.client_name === 'string' ? origin.client_name.trim() : '';
    return name ? WATCH_LABELS.named[lang](name) : WATCH_LABELS.unknown[lang];
  }
  return getSourceLabel(origin.source, lang);
};

/**
 * Libellé de provenance d'une opportunité. Pour la veille MCP, le nom vient du client OAuth
 * VÉRIFIÉ, résolu par le backend à partir de `watch.client_id` : aucune liste de fournisseurs
 * côté interface. Veille antérieure sans client : « Veille (antérieure) », jamais attribuée
 * d'office à un fournisseur.
 */
export const getOpportunitySourceLabel = (opportunity, language = 'fr') => {
  if (opportunity?.origin) return getOriginLabel(opportunity.origin, language);
  const source = opportunity?.source;
  const watch = opportunity?.watch;
  if (source !== WATCH_SOURCE) return getSourceLabel(source, language);
  if (!watch?.client_id) return getOriginLabel({ kind: 'watch_legacy' }, language);
  return getOriginLabel({ kind: 'client', client_name: watch.client_name }, language);
};
