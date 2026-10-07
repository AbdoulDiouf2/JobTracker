/**
 * Constantes partagées pour les candidatures.
 * Source unique de vérité — ne pas dupliquer dans les composants.
 */

export const STATUS_OPTIONS = [
  { value: 'pending',     label: 'En attente',      color: 'bg-yellow-500/20 text-yellow-400', textColor: 'text-yellow-400', dotColor: 'bg-yellow-400' },
  { value: 'contacted',  label: 'Contacté(e)',      color: 'bg-blue-500/20 text-blue-400',    textColor: 'text-blue-400',   dotColor: 'bg-blue-400' },
  { value: 'positive',    label: 'Positive',         color: 'bg-green-500/20 text-green-400',  textColor: 'text-green-400',  dotColor: 'bg-green-400' },
  { value: 'negative',    label: 'Négative',         color: 'bg-red-500/20 text-red-400',      textColor: 'text-red-400',    dotColor: 'bg-red-400' },
  { value: 'no_response', label: 'Pas de réponse',   color: 'bg-slate-500/20 text-slate-400',  textColor: 'text-slate-400',  dotColor: 'bg-slate-400' },
  { value: 'cancelled',   label: 'Annulé',           color: 'bg-red-500/20 text-red-400',      textColor: 'text-red-400',    dotColor: 'bg-red-400' },
  // Candidature pas encore envoyée (ex: issue d'une Opportunité). Gardée en fin de liste :
  // STATUS_OPTIONS[0] sert de fallback pour les statuts inconnus.
  { value: 'to_apply',    label: 'À postuler',       color: 'bg-violet-500/20 text-violet-400', textColor: 'text-violet-400', dotColor: 'bg-violet-400' },
];

export const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

/**
 * `to_apply` = « je souhaite candidater, mais la candidature n'est PAS encore envoyée ».
 * Sa date_candidature est technique : ne jamais l'afficher comme date de candidature.
 */
export const TO_APPLY = 'to_apply';
export const isToApply = (app) => app?.reponse === TO_APPLY;

/**
 * Statuts proposés dans le menu rapide.
 * Depuis to_apply, seul le passage « envoyée » (pending, avec date réelle) est proposé :
 * parcours normal to_apply → pending + date → réponse.
 */
export const getStatusOptionsFor = (currentStatus) =>
  currentStatus === TO_APPLY
    ? STATUS_OPTIONS.filter(s => s.value === TO_APPLY || s.value === 'pending')
    : STATUS_OPTIONS;

export const TYPE_OPTIONS = [
  { value: 'cdi',        label: 'CDI' },
  { value: 'cdd',        label: 'CDD' },
  { value: 'stage',      label: 'Stage' },
  { value: 'alternance', label: 'Alternance' },
  { value: 'freelance',  label: 'Freelance' },
  { value: 'interim',    label: 'Intérim' },
  { value: 'mastere',    label: 'Mastère' },
];

export const INTERVIEW_STATUS_OPTIONS = [
  { value: 'planned',   label: 'Planifié', color: 'bg-blue-500/20 text-blue-400',  textColor: 'text-blue-400',  dotColor: 'bg-blue-400' },
  { value: 'completed', label: 'Effectué', color: 'bg-green-500/20 text-green-400', textColor: 'text-green-400', dotColor: 'bg-green-400' },
  { value: 'cancelled', label: 'Annulé',   color: 'bg-red-500/20 text-red-400',    textColor: 'text-red-400',   dotColor: 'bg-red-400' },
];

export const INTERVIEW_STATUS_MAP = Object.fromEntries(INTERVIEW_STATUS_OPTIONS.map(s => [s.value, s]));

export const METHOD_OPTIONS = [
  { value: 'linkedin',          label: 'LinkedIn' },
  { value: 'company_website',   label: 'Site entreprise' },
  { value: 'email',             label: 'Email' },
  { value: 'indeed',            label: 'Indeed' },
  { value: 'apec',              label: 'APEC' },
  { value: 'pole_emploi',       label: 'France Travail' },
  { value: 'welcome_to_jungle', label: 'Welcome to the Jungle' },
  { value: 'other',             label: 'Autre' },
];
