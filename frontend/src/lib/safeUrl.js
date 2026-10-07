/**
 * Retourne l'URL si elle est absolue en http(s), sinon null.
 * À utiliser pour tout lien externe provenant de données (ex: offres reçues d'agents).
 */
export const toSafeExternalUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
};
