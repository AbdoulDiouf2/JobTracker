import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Ban, CheckCircle2, Clock, Eye, Loader2, LogIn, PlusCircle, ShieldCheck, XCircle,
} from 'lucide-react';
import { api, useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import {
  REQUEST_ID_RE, consentPath, isSafeContinueUrl, navigateTo, rememberOAuthReturn,
} from '../lib/oauthReturn';

// Textes génériques : le nom du client vient de la demande vérifiée par le backend.
// Avant de la connaître (connexion, lien invalide…), on parle de « l'application ».
const T = {
  fr: {
    title: (client) => `Autoriser ${client}`,
    lead: (client) => `${client} demande l'autorisation d'accéder à ta veille d'opportunités JobTracker.`,
    unknownClient: 'Application non identifiée',
    redirectLabel: 'Après ta décision, tu seras renvoyé vers',
    localWarning: "Application installée sur cet appareil : le retour se fait vers une adresse locale. N'autorise que si tu viens de lancer toi-même la connexion depuis cette application.",
    account: 'Compte concerné',
    permissions: (client) => `Ce que ${client} pourra faire`,
    notAllowed: (client) => `Ce que ${client} ne pourra jamais faire`,
    never: [
      'Lire ou modifier tes candidatures, documents, CV et entretiens',
      'Supprimer ou modifier une opportunité existante',
      'Envoyer une candidature à ta place',
    ],
    revoke: 'Tu pourras révoquer cet accès à tout moment depuis les paramètres de JobTracker.',
    approve: 'Autoriser',
    deny: 'Refuser',
    expiresAt: (time) => `Cette demande expire à ${time}.`,
    loading: 'Chargement de la demande…',
    redirecting: (domain) => `Retour vers ${domain}…`,
    loginTitle: 'Connexion requise',
    loginText: "Connecte-toi à JobTracker pour examiner la demande d'autorisation de l'application. Tu reviendras ensuite sur cette page.",
    login: 'Se connecter',
    notEligibleTitle: 'Compte non autorisé',
    notEligibleText: "La veille n'est pas activée pour ce compte. Seul le compte propriétaire peut autoriser cette connexion.",
    backToClient: (client) => `Refuser et revenir à ${client}`,
    expiredTitle: 'Demande expirée',
    expiredText: "Cette demande a expiré. Relance la connexion depuis l'application qui l'a demandée.",
    usedTitle: 'Demande déjà traitée',
    usedText: "Une décision a déjà été prise pour cette demande. Relance la connexion depuis l'application si nécessaire.",
    notFoundTitle: 'Demande introuvable',
    notFoundText: "Ce lien d'autorisation n'est pas valide. Relance la connexion depuis l'application qui l'a demandée.",
    errorTitle: 'Erreur',
    errorText: 'La demande n\'a pas pu être traitée. Réessaie dans un instant.',
    framedTitle: 'Affichage bloqué',
    framedText: 'Pour ta sécurité, cette page ne peut pas être affichée dans une autre page.',
    home: 'Retour à JobTracker',
  },
  en: {
    title: (client) => `Authorize ${client}`,
    lead: (client) => `${client} is requesting access to your JobTracker opportunity watch.`,
    unknownClient: 'Unidentified application',
    redirectLabel: 'After your decision, you will be sent back to',
    localWarning: 'Application installed on this device: you will be sent back to a local address. Only authorize if you just started the connection from this application yourself.',
    account: 'Account',
    permissions: (client) => `What ${client} will be able to do`,
    notAllowed: (client) => `What ${client} will never be able to do`,
    never: [
      'Read or modify your applications, documents, CVs and interviews',
      'Delete or modify an existing opportunity',
      'Apply to a job on your behalf',
    ],
    revoke: 'You can revoke this access at any time from the JobTracker settings.',
    approve: 'Authorize',
    deny: 'Deny',
    expiresAt: (time) => `This request expires at ${time}.`,
    loading: 'Loading the request…',
    redirecting: (domain) => `Returning to ${domain}…`,
    loginTitle: 'Sign-in required',
    loginText: "Sign in to JobTracker to review the application's authorization request. You will come back to this page afterwards.",
    login: 'Sign in',
    notEligibleTitle: 'Account not authorized',
    notEligibleText: 'The watch is not enabled for this account. Only the owner account can authorize this connection.',
    backToClient: (client) => `Deny and return to ${client}`,
    expiredTitle: 'Request expired',
    expiredText: 'This request has expired. Start the connection again from the application that requested it.',
    usedTitle: 'Request already handled',
    usedText: 'A decision has already been made for this request. Start the connection again from the application if needed.',
    notFoundTitle: 'Request not found',
    notFoundText: 'This authorization link is not valid. Start the connection again from the application that requested it.',
    errorTitle: 'Error',
    errorText: 'The request could not be processed. Please try again in a moment.',
    framedTitle: 'Display blocked',
    framedText: 'For your security, this page cannot be displayed inside another page.',
    home: 'Back to JobTracker',
  },
};

const SCOPE_ICONS = { 'watch:read': Eye, 'opportunities:write': PlusCircle };
const STATUS_ERRORS = { 410: 'expired', 409: 'used', 404: 'notFound' };
const DECISION_ERRORS = { request_expired: 'expired', request_already_used: 'used', request_not_found: 'notFound' };

const isFramed = () => {
  try {
    return window.top !== window.self;
  } catch {
    return true; // accès refusé au parent : on est dans un cadre d'une autre origine
  }
};

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center px-4 py-10">
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-lg"
      >
        <div className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8">{children}</div>
      </motion.main>
    </div>
  );
}

function Notice({ icon: Icon, tone = 'slate', title, text, children, testId }) {
  const tones = {
    slate: 'text-slate-300',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };
  return (
    <Shell>
      <div className="text-center" data-testid={testId}>
        <Icon className={`mx-auto mb-4 h-10 w-10 ${tones[tone]}`} aria-hidden="true" />
        <h1 className="font-heading text-xl font-bold text-white mb-2">{title}</h1>
        <p className="text-sm text-slate-400 mb-6">{text}</p>
        {children}
      </div>
    </Shell>
  );
}

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const t = T[language] || T.fr;

  const requestId = searchParams.get('request') || '';
  const validId = REQUEST_ID_RE.test(requestId);
  const framed = isFramed();

  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null); // expired | used | notFound | generic
  const [submitting, setSubmitting] = useState(null); // 'approve' | 'deny'

  // Mémorise le retour AVANT tout appel : une session expirée (401) renvoie vers /login,
  // puis la connexion ramène ici.
  useEffect(() => {
    if (validId && !framed) rememberOAuthReturn(consentPath(requestId));
  }, [validId, framed, requestId]);

  useEffect(() => {
    if (!validId || !isAuthenticated || framed) return undefined;
    let cancelled = false;
    api.get(`/api/oauth/requests/${requestId}`)
      .then((r) => { if (!cancelled) setDetails(r.data); })
      .catch((err) => {
        if (!cancelled) setError(STATUS_ERRORS[err.response?.status] || 'generic');
      });
    return () => { cancelled = true; };
  }, [validId, isAuthenticated, framed, requestId]);

  const decide = async (approve) => {
    setSubmitting(approve ? 'approve' : 'deny');
    try {
      const r = await api.post('/api/oauth/consent', { request_id: requestId, approve });
      const url = r.data?.continue_url;
      if (!isSafeContinueUrl(url)) throw new Error('unsafe continue_url');
      navigateTo(url); // le backend redirige vers le client ; aucun code ne transite ici
    } catch (err) {
      setSubmitting(null);
      setError(DECISION_ERRORS[err.response?.data?.error] || 'generic');
    }
  };

  if (framed) {
    return <Notice icon={Ban} tone="red" title={t.framedTitle} text={t.framedText} testId="consent-framed" />;
  }
  if (!validId) {
    return (
      <Notice icon={XCircle} tone="red" title={t.notFoundTitle} text={t.notFoundText} testId="consent-not-found">
        <Link to="/dashboard" className="text-sm text-[#c4a052] hover:underline">{t.home}</Link>
      </Notice>
    );
  }
  if (!isAuthenticated) {
    return (
      <Notice icon={LogIn} title={t.loginTitle} text={t.loginText} testId="consent-login-required">
        <Button
          onClick={() => navigate('/login')}
          className="bg-[#c4a052] hover:bg-[#b08f45] text-slate-950 font-semibold transition-colors"
          data-testid="consent-login-button"
        >
          <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
          {t.login}
        </Button>
      </Notice>
    );
  }
  if (error) {
    const map = {
      expired: [Clock, 'amber', t.expiredTitle, t.expiredText],
      used: [CheckCircle2, 'slate', t.usedTitle, t.usedText],
      notFound: [XCircle, 'red', t.notFoundTitle, t.notFoundText],
      generic: [AlertTriangle, 'red', t.errorTitle, t.errorText],
    };
    const [icon, tone, title, text] = map[error];
    return (
      <Notice icon={icon} tone={tone} title={title} text={text} testId={`consent-error-${error}`}>
        <Link to="/dashboard" className="text-sm text-[#c4a052] hover:underline">{t.home}</Link>
      </Notice>
    );
  }
  if (!details) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-3 py-8 text-slate-400" role="status" data-testid="consent-loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-sm">{t.loading}</span>
        </div>
      </Shell>
    );
  }

  // Jamais de nom de remplacement « ChatGPT » : un client sans nom est signalé comme tel.
  // Rendu React = texte échappé ; le domaine est revalidé côté serveur.
  const clientName = typeof details.client?.name === 'string' ? details.client.name.trim() : '';
  const client = clientName || t.unknownClient;
  const redirectDomain = typeof details.client?.redirect_domain === 'string' ? details.client.redirect_domain : '';
  if (!redirectDomain) {
    // Sans domaine de retour vérifié, l'utilisateur ne peut pas savoir où il sera renvoyé : pas de formulaire
    return (
      <Notice icon={AlertTriangle} tone="red" title={t.errorTitle} text={t.errorText} testId="consent-error-generic">
        <Link to="/dashboard" className="text-sm text-[#c4a052] hover:underline">{t.home}</Link>
      </Notice>
    );
  }
  const account = details.account?.email || details.account?.name || '';
  const expires = details.expires_at
    ? new Date(details.expires_at).toLocaleTimeString(language === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (!details.eligible) {
    return (
      <Notice icon={Ban} tone="amber" title={t.notEligibleTitle} text={t.notEligibleText} testId="consent-not-eligible">
        {account && <p className="text-xs text-slate-500 mb-4" data-testid="consent-account">{account}</p>}
        <Button
          variant="outline"
          onClick={() => decide(false)}
          disabled={!!submitting}
          className="border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
          data-testid="consent-deny-button"
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t.backToClient(client)}
        </Button>
      </Notice>
    );
  }

  return (
    <Shell>
      <div data-testid="consent-form">
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-[#c4a052]" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold text-white mb-2 break-words">{t.title(client)}</h1>
          <p className="text-sm text-slate-300" data-testid="consent-lead">{t.lead(client)}</p>
        </div>

        <div className="mb-5 rounded-xl border border-[#c4a052]/30 bg-[#c4a052]/5 px-4 py-3" data-testid="consent-redirect">
          <p className="text-xs text-slate-400">{t.redirectLabel}</p>
          <p className="font-mono text-sm font-semibold text-white break-all" data-testid="consent-redirect-domain">
            {redirectDomain}
          </p>
          {details.client?.redirect_local === true && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-300" role="note" data-testid="consent-local-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t.localWarning}
            </p>
          )}
        </div>

        {account && (
          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t.account}</p>
            <p className="text-sm font-medium text-white break-all" data-testid="consent-account">{account}</p>
          </div>
        )}

        <section className="mb-5" aria-labelledby="consent-permissions-title">
          <h2 id="consent-permissions-title" className="mb-3 text-sm font-semibold text-white">{t.permissions(client)}</h2>
          <ul className="space-y-2" data-testid="consent-scopes">
            {details.scopes.map(({ scope, description }) => {
              const Icon = SCOPE_ICONS[scope] || CheckCircle2;
              return (
                <li key={scope} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3" data-testid={`consent-scope-${scope}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#c4a052]" aria-hidden="true" />
                  <span className="text-sm text-slate-300">{description}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-5" aria-labelledby="consent-never-title">
          <h2 id="consent-never-title" className="mb-2 text-sm font-semibold text-white">{t.notAllowed(client)}</h2>
          <ul className="space-y-1.5">
            {t.never.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-slate-400">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mb-6 text-xs text-slate-500">
          {t.revoke}{expires ? ` ${t.expiresAt(expires)}` : ''}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => decide(false)}
            disabled={!!submitting}
            className="w-full sm:w-auto border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
            data-testid="consent-deny-button"
          >
            {submitting === 'deny' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t.deny}
          </Button>
          <Button
            onClick={() => decide(true)}
            disabled={!!submitting}
            className="w-full sm:w-auto bg-[#c4a052] hover:bg-[#b08f45] text-slate-950 font-semibold transition-colors"
            data-testid="consent-approve-button"
          >
            {submitting === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t.approve}
          </Button>
        </div>
        {submitting && (
          <p className="mt-4 text-center text-xs text-slate-500" role="status">{t.redirecting(redirectDomain)}</p>
        )}
      </div>
    </Shell>
  );
}
