/**
 * Retour vers la page de consentement OAuth après une connexion (Lot 2).
 *
 * Seul un chemin de consentement OAuth exact est mémorisé et restitué (liste blanche) :
 * aucune redirection ouverte possible. Mémoire de session limitée à 15 minutes, effacée
 * dès sa lecture.
 */

const KEY = 'jt_oauth_return';
const TTL_MS = 15 * 60 * 1000;
export const REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,100}$/;
const CONSENT_PATH_RE = /^\/oauth\/consent\?request=([A-Za-z0-9_-]{16,100})$/;

export const consentPath = (requestId) => `/oauth/consent?request=${requestId}`;

export const isSafeConsentPath = (path) => typeof path === 'string' && CONSENT_PATH_RE.test(path);

export function rememberOAuthReturn(path) {
  if (!isSafeConsentPath(path)) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function consumeOAuthReturn() {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw);
    if (!isSafeConsentPath(path) || typeof at !== 'number' || Date.now() - at > TTL_MS) return null;
    return path;
  } catch {
    return null;
  }
}

/** Origines autorisées : celle de la page et celle du backend configuré (même domaine en production). */
function allowedOrigins() {
  const origins = [window.location.origin];
  try {
    if (process.env.REACT_APP_BACKEND_URL) origins.push(new URL(process.env.REACT_APP_BACKEND_URL).origin);
  } catch {
    // URL de backend mal formée : seule l'origine de la page reste autorisée
  }
  return origins;
}

/**
 * URL de continuation renvoyée par le backend : uniquement /api/oauth/continue, sur une
 * origine autorisée, en HTTPS (ou en local pour le développement). Tout le reste est refusé.
 */
export function isSafeContinueUrl(url) {
  try {
    const u = new URL(url);
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    return allowedOrigins().includes(u.origin)
      && (u.protocol === 'https:' || (local && u.protocol === 'http:'))
      && u.pathname === '/api/oauth/continue'
      && /^\?ticket=[A-Za-z0-9_-]{20,100}$/.test(u.search)
      && !u.username && !u.password && !u.hash;
  } catch {
    return false;
  }
}

/** Navigation de premier niveau (isolée pour les tests). */
export function navigateTo(url) {
  window.location.assign(url);
}
