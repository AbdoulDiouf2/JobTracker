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
  chatgpt_watch:    { fr: 'Veille ChatGPT',   en: 'ChatGPT watch' },
  chrome_extension: { fr: 'Extension Chrome', en: 'Chrome extension' },
  manual:           { fr: 'Ajout manuel',     en: 'Manual' },
  external_agent:   { fr: 'Agent externe',    en: 'External agent' },
  other:            { fr: 'Autre',            en: 'Other' },
};

export const getSourceLabel = (source, language = 'fr') =>
  SOURCE_LABELS[source]?.[language] || source || SOURCE_LABELS.other[language];

const WATCH_SOURCE = 'chatgpt_watch';

/**
 * Libellé de provenance d'une opportunité. Pour la veille MCP, le nom vient du client OAuth
 * VÉRIFIÉ, résolu par le backend (`watch.client_name`) à partir de `watch.client_id` :
 * aucune liste de fournisseurs côté interface.
 * - offre antérieure sans `client_id` : libellé historique (« Veille ChatGPT ») ;
 * - client introuvable et sans nom conservé : « Veille (client inconnu) ».
 */
export const getOpportunitySourceLabel = (opportunity, language = 'fr') => {
  const source = opportunity?.source;
  const watch = opportunity?.watch;
  if (source !== WATCH_SOURCE || !watch?.client_id) return getSourceLabel(source, language);
  const name = typeof watch.client_name === 'string' ? watch.client_name.trim() : '';
  if (!name) return language === 'en' ? 'Watch (unknown client)' : 'Veille (client inconnu)';
  return language === 'en' ? `${name} watch` : `Veille ${name}`;
};
