/**
 * Filtres de la page Opportunités : conversion URL <-> état <-> paramètres d'API.
 * Module pur (sans React) : l'URL est la source de vérité, ce qui conserve les filtres lors
 * de la navigation et du retour arrière. Toute valeur invalide de l'URL est ignorée.
 */

export const STATUS_VALUES = ['all', 'new', 'ignored', 'converted'];
export const SORT_VALUES = ['discovered', 'relevance', 'company'];
export const PERIOD_VALUES = ['today', '7d', '30d', 'custom'];
export const CONTRACT_VALUES = ['permanent', 'fixed_term', 'freelance', 'internship', 'apprenticeship'];
export const SENIORITY_VALUES = ['junior', 'entry_level', 'graduate', 'mid'];
export const SCORE_PRESETS = [
  { key: '75-84', min: 75, max: 84 },
  { key: '85-94', min: 85, max: 94 },
  { key: '95-100', min: 95, max: 100 },
];

const ORIGIN_RE = /^(client:[A-Za-z0-9_-]{1,100}|watch_legacy|source:[a-z0-9_-]{1,50})$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MULTI = 20;

export const DEFAULT_FILTERS = Object.freeze({
  status: 'all', q: '', origin: [], country: [], score: '', period: '', from: '', to: '',
  contract: [], seniority: [], location: '', sort: 'discovered', page: 1,
});

const uniq = (values) => Array.from(new Set(values));
const multi = (params, key, accept) => uniq(params.getAll(key).filter(accept)).slice(0, MAX_MULTI);

/** URLSearchParams -> état des filtres (valeurs invalides ignorées). */
export const parseFilters = (params) => {
  const get = (key) => params.get(key) || '';
  const status = get('status');
  const sort = get('sort');
  const score = get('score');
  const period = get('period');
  const page = Number.parseInt(get('page'), 10);
  const from = DATE_RE.test(get('from')) ? get('from') : '';
  const to = DATE_RE.test(get('to')) ? get('to') : '';
  return {
    status: STATUS_VALUES.includes(status) ? status : 'all',
    q: get('q').slice(0, 200),
    origin: multi(params, 'origin', (v) => ORIGIN_RE.test(v) && v !== 'source:chatgpt_watch'),
    country: multi(params, 'country', (v) => COUNTRY_RE.test(v)),
    score: SCORE_PRESETS.some((p) => p.key === score) ? score : '',
    period: PERIOD_VALUES.includes(period) ? period : '',
    from: period === 'custom' ? from : '',
    to: period === 'custom' ? to : '',
    contract: multi(params, 'contract', (v) => CONTRACT_VALUES.includes(v)),
    seniority: multi(params, 'seniority', (v) => SENIORITY_VALUES.includes(v)),
    location: get('location').slice(0, 100),
    sort: SORT_VALUES.includes(sort) ? sort : 'discovered',
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
};

/** État -> URLSearchParams (les valeurs par défaut sont omises : URL courte et stable). */
export const toSearchParams = (filters) => {
  const params = new URLSearchParams();
  const f = { ...DEFAULT_FILTERS, ...filters };
  if (f.status !== 'all') params.set('status', f.status);
  if (f.q.trim()) params.set('q', f.q.trim());
  ['origin', 'country', 'contract', 'seniority'].forEach((key) => f[key].forEach((v) => params.append(key, v)));
  if (f.score) params.set('score', f.score);
  if (f.period) params.set('period', f.period);
  if (f.period === 'custom') {
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
  }
  if (f.location.trim()) params.set('location', f.location.trim());
  if (f.sort !== 'discovered') params.set('sort', f.sort);
  if (f.page > 1) params.set('page', String(f.page));
  return params;
};

/** Date du jour à Paris (AAAA-MM-JJ), décalée de `offsetDays`. */
export const parisDate = (offsetDays = 0, now = new Date()) => {
  const shifted = new Date(now.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(shifted);
};

/** Bornes INCLUSES de la période (jours de Paris). */
export const periodRange = (filters, now = new Date()) => {
  switch (filters.period) {
    case 'today': return { from: parisDate(0, now), to: '' };
    case '7d': return { from: parisDate(-6, now), to: '' };
    case '30d': return { from: parisDate(-29, now), to: '' };
    case 'custom': return { from: filters.from, to: filters.to };
    default: return { from: '', to: '' };
  }
};

/** État -> paramètres de GET /api/opportunities (tableaux répétés : origin=a&origin=b). */
export const toApiParams = (filters, perPage, now = new Date()) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const params = { page: f.page, per_page: perPage };
  if (f.status !== 'all') params.status = f.status;
  if (f.q.trim()) params.search = f.q.trim();
  ['origin', 'country', 'contract', 'seniority'].forEach((key) => { if (f[key].length) params[key] = f[key]; });
  const preset = SCORE_PRESETS.find((p) => p.key === f.score);
  if (preset) { params.min_score = preset.min; params.max_score = preset.max; }
  const { from, to } = periodRange(f, now);
  if (from) params.discovered_from = from;
  if (to) params.discovered_to = to;
  if (f.location.trim()) params.location = f.location.trim();
  if (f.sort !== 'discovered') params.sort = f.sort;
  return params;
};

/** Nombre de filtres avancés actifs (badge du bouton « Plus de filtres »). */
export const advancedCount = (f) =>
  (f.score ? 1 : 0) + (f.period ? 1 : 0) + f.contract.length + f.seniority.length + (f.location.trim() ? 1 : 0)
  + (f.sort !== 'discovered' ? 1 : 0);

/** Vrai si un filtre (hors statut et tri) est actif. */
export const hasActiveFilters = (f) =>
  !!(f.q.trim() || f.origin.length || f.country.length || f.score || f.period || f.contract.length
    || f.seniority.length || f.location.trim());
