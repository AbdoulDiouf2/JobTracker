import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  AppWindow, Ban, Check, Copy, KeyRound, Link2, Loader2, Plus, Power, PowerOff, RefreshCw, Server, ShieldAlert,
  ShieldCheck, Sparkles, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOAuthAdmin } from '../../hooks/useOAuthAdmin';
import { useLanguage } from '../../i18n';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '../ui/alert-dialog';

const T = {
  fr: {
    lang: 'fr',
    intro: "Connectez des applications compatibles MCP (ChatGPT, agents…) à JobTracker via OAuth. Réservé à l'administrateur.",
    state: { none: 'Non configuré', configured: 'Configuré', active: 'Actif', disabled: 'Désactivé', unavailable: 'Indisponible' },
    stateHelp: {
      configured: 'Client prêt. Le service est coupé : ouvrez-le pour autoriser la connexion.',
      active: 'Le service est ouvert : cette application peut se connecter avec ses identifiants.',
      disabled: 'Client désactivé : aucune connexion possible.',
      unavailable: "Le MCP n'est pas activé sur ce déploiement (variables de production).",
    },
    service: { open: 'Service ouvert', cut: 'Service coupé', unavailable: 'Service indisponible' },
    serviceTitle: 'Service OAuth / MCP',
    checkKeys: 'Activation du déploiement',
    checkSwitch: "Interrupteur d'urgence",
    checkWatch: 'Veille sur votre compte',
    keysOk: 'Activé', keysMissing: 'Non activé',
    switchClosed: 'Fermé (service coupé)', switchOpen: 'Ouvert',
    watchOn: 'Activée', watchOff: 'Désactivée',
    open: 'Ouvrir le service', cut: 'Couper le service',
    openTitle: 'Ouvrir le service OAuth / MCP ?',
    openText: "OAuth et MCP seront activés pour les clients autorisés uniquement. Les outils restent inaccessibles sans jeton valide : aucun accès anonyme n'est ouvert. Vous pourrez couper le service à tout moment.",
    cutTitle: 'Couper le service OAuth / MCP ?',
    cutText: 'OAuth et MCP seront coupés immédiatement pour tous les clients, sans redéploiement. Les connexions existantes sont conservées et reprendront à la réouverture.',
    unavailableNote: "Tant que le déploiement n'est pas activé, l'ouverture de l'interrupteur reste sans effet.",
    opened: 'Service ouvert', cutDone: 'Service coupé', switchError: "Impossible de modifier l'interrupteur.",
    clientsTitle: 'Applications clientes',
    clientsEmpty: 'Aucune application cliente enregistrée.',
    addClient: 'Ajouter une application',
    createTitle: 'Nouvelle application cliente',
    createText: "Le nom est affiché à l'utilisateur lors du consentement. Les adresses de retour doivent être exactes et en HTTPS.",
    nameLabel: "Nom de l'application",
    namePlaceholder: 'Agent MAADEC',
    urisLabel: 'Adresses de retour autorisées (une par ligne)',
    urisPlaceholder: 'https://exemple.com/oauth/callback',
    preset: 'Préréglage',
    presetUsed: 'déjà configuré',
    create: "Créer l'application",
    createError: "Impossible de créer l'application.",
    sharedRedirect: (uri, names) => `Adresse ${uri} également utilisée par : ${names}.`,
    clientActive: 'Actif', clientInactive: 'Désactivé',
    redirects: 'Adresses de retour autorisées',
    addRedirect: 'Ajouter',
    addRedirectLabel: "Nouvelle adresse de retour (fournie par l'application)",
    redirectAdded: 'Adresse de retour ajoutée',
    redirectError: 'Adresse refusée.',
    rotate: 'Régénérer le secret',
    rotateTitle: (n) => `Régénérer le secret de ${n} ?`,
    rotateText: "L'ancien secret sera refusé immédiatement. Vous devrez saisir le nouveau dans l'application.",
    rotateError: 'Impossible de régénérer le secret.',
    deactivate: 'Désactiver', reactivate: 'Réactiver',
    deactivateTitle: (n) => `Désactiver ${n} ?`,
    deactivateText: (n) => `Toutes ses connexions (${n}) et leurs jetons seront révoqués immédiatement. Une réactivation exigera une nouvelle connexion depuis l'application. Les autres applications ne sont pas affectées.`,
    deactivated: 'Application désactivée', reactivated: 'Application réactivée', activeError: "Impossible de modifier l'application.",
    valuesTitle: (n) => `À saisir dans ${n}`,
    mcpUrl: 'URL du serveur MCP',
    clientId: 'Client ID',
    secretNote: "Le secret n'est disponible que dans la fenêtre affichée à la création ou à la régénération.",
    authMethod: 'Authentification du client : client_secret_post ou client_secret_basic. PKCE S256 obligatoire.',
    authMethodPublic: 'Authentification du client : aucune (client public). PKCE S256 obligatoire.',
    publicNoSecret: "Application publique : aucun secret. Elle s'identifie par son Client ID et doit utiliser PKCE (S256).",
    typeLabel: "Type d'application",
    types: { confidential: 'Service web (confidentiel)', public: 'Application installée (publique)' },
    typeBadge: { confidential: 'Confidentiel', public: 'Public' },
    typeHelp: {
      confidential: 'Pour un service hébergé (ChatGPT, Claude sur le web…) : il reçoit un secret, affiché une seule fois.',
      public: "Pour une application installée sur un ordinateur (outil en ligne de commande, éditeur de code…) : aucun secret, la sécurité repose sur PKCE. Adresses de retour locales autorisées.",
    },
    urisHelp: {
      confidential: 'Adresses HTTPS exactes.',
      public: 'Adresses HTTPS exactes, ou adresses locales http://127.0.0.1/<chemin> et http://[::1]/<chemin> sans port (le port est choisi par l’application).',
    },
    scopesLabel: 'Permissions accordées à cette application',
    scopeNames: {
      'watch:read': "Lire les critères, l'état de la veille et les offres récentes",
      'opportunities:write': 'Ajouter des offres et les comptes-rendus de veille',
    },
    scopesRequired: 'Choisissez au moins une permission.',
    scopesHelp: "Retirer une permission s'applique immédiatement ; en ajouter une demande une nouvelle connexion depuis l'application.",
    scopesSave: 'Enregistrer les permissions', scopesSaved: 'Permissions mises à jour', scopesError: 'Impossible de modifier les permissions.',
    publicCreatedTitle: (n) => `Application ${n} créée`,
    publicCreatedText: "Application publique : il n'y a aucun secret à conserver. Saisissez ce Client ID dans l'application.",
    removeRedirect: (u) => `Retirer l'adresse ${u}`,
    removeRedirectTitle: 'Retirer cette adresse de retour ?',
    removeRedirectText: (u) => `${u} ne pourra plus servir à se connecter. Les connexions déjà établies ne sont pas révoquées.`,
    redirectRemoved: 'Adresse retirée', removeError: "Impossible de retirer l'adresse.", removeLabel: 'Retirer',
    connections: (n) => `${n} connexion(s) active(s)`,
    toggleDetails: " — afficher ou masquer les détails de l'application",
    cimdBadge: 'Identité publiée',
    cimdNote: (host, date) => `Identité publiée par ${host}${date ? ` — document lu le ${date}` : ''}. Pas de secret : PKCE obligatoire.`,
    cimdRedirects: "Adresses fournies par le document de l'éditeur : non modifiables ici.",
    cimd: {
      title: 'Applications à identité publiée (CIMD)',
      help: "Permet à des applications comme Claude Code, Codex ou VS Code de se connecter sans création manuelle : leur nom et leurs adresses de retour sont lus dans un document publié sur leur propre domaine. Seuls les domaines approuvés ci-dessous sont acceptés, et chaque connexion exige ton consentement.",
      on: 'Actif — annoncé aux applications', off: 'Désactivé',
      enable: 'Accepter les applications à identité publiée',
      hosts: 'Domaines approuvés (un par ligne, correspondance exacte)',
      hostsPlaceholder: 'claude.ai',
      suggestions: 'Domaines vérifiés :',
      scopes: 'Permissions accordées par défaut aux nouvelles applications',
      scopesHelp: 'Lecture seule recommandée : tu pourras élargir ensuite, application par application.',
      save: 'Enregistrer la politique', saved: 'Politique enregistrée', error: "Impossible d'enregistrer la politique.",
      confirmTitle: 'Enregistrer la politique CIMD ?',
      confirmEnable: (n) => `Les applications publiées par ${n} domaine(s) approuvé(s) pourront demander une connexion. Chaque connexion reste soumise à ton consentement explicite.`,
      confirmDisable: "Aucune nouvelle application à identité publiée ne pourra se connecter. Les connexions existantes restent actives : désactive-les une par une si nécessaire.",
      noHosts: 'Ajoute au moins un domaine pour activer.',
    },
    grantsTitle: 'Autorisations OAuth',
    grantsEmpty: 'Aucune autorisation pour le moment.',
    grantStatus: {
      active: 'Active', access_expired_observed: 'Active (jeton à renouveler)', reconnection_required: 'Reconnexion requise',
      revoked: 'Révoquée', compromised: 'Révoquée (sécurité)', superseded: 'Remplacée',
    },
    alerts: { refresh_not_observed: 'Renouvellement non observé', reconnection_soon: 'Reconnexion bientôt nécessaire' },
    createdAt: 'Créée le', lastRefresh: 'Dernier renouvellement', expires: 'Expire le', never: 'Jamais',
    revoke: 'Révoquer', revokeTitle: 'Révoquer cette autorisation ?',
    revokeText: (n) => `${n} perdra immédiatement cet accès ; une nouvelle connexion sera nécessaire. Les autres applications ne sont pas affectées.`,
    revoked: 'Autorisation révoquée', revokeError: "Impossible de révoquer l'autorisation.",
    cancel: 'Annuler', confirm: 'Confirmer',
    copy: 'Copier', copied: 'Copié', copyError: 'Copie impossible : sélectionnez la valeur et copiez-la manuellement.',
    secretTitle: (n) => `Identifiants de ${n}`,
    secretWarning: 'Copiez le secret maintenant. Pour votre sécurité, il ne sera plus jamais affiché.',
    secretLabel: 'Client secret',
    done: "J'ai copié le secret",
    loadError: 'Impossible de charger les connexions OAuth.', retry: 'Réessayer',
  },
  en: {
    lang: 'en',
    intro: 'Connect MCP-compatible applications (ChatGPT, agents…) to JobTracker through OAuth. Administrator only.',
    state: { none: 'Not configured', configured: 'Configured', active: 'Active', disabled: 'Disabled', unavailable: 'Unavailable' },
    stateHelp: {
      configured: 'Client ready. The service is cut: open it to allow the connection.',
      active: 'The service is open: this application can connect with its credentials.',
      disabled: 'Client disabled: no connection is possible.',
      unavailable: 'MCP is not enabled on this deployment (production variables).',
    },
    service: { open: 'Service open', cut: 'Service cut', unavailable: 'Service unavailable' },
    serviceTitle: 'OAuth / MCP service',
    checkKeys: 'Deployment activation',
    checkSwitch: 'Emergency switch',
    checkWatch: 'Watch on your account',
    keysOk: 'Enabled', keysMissing: 'Not enabled',
    switchClosed: 'Closed (service cut)', switchOpen: 'Open',
    watchOn: 'Enabled', watchOff: 'Disabled',
    open: 'Open the service', cut: 'Cut the service',
    openTitle: 'Open the OAuth / MCP service?',
    openText: 'OAuth and MCP will be enabled for authorized clients only. Tools stay unreachable without a valid token: no anonymous access is opened. You can cut the service at any time.',
    cutTitle: 'Cut the OAuth / MCP service?',
    cutText: 'OAuth and MCP will be cut immediately for every client, without redeploying. Existing connections are kept and resume when reopened.',
    unavailableNote: 'Until the deployment is enabled, opening the switch has no effect.',
    opened: 'Service opened', cutDone: 'Service cut', switchError: 'Unable to change the switch.',
    clientsTitle: 'Client applications',
    clientsEmpty: 'No client application registered.',
    addClient: 'Add an application',
    createTitle: 'New client application',
    createText: 'The name is shown to the user at consent time. Redirect URLs must be exact and use HTTPS.',
    nameLabel: 'Application name',
    namePlaceholder: 'MAADEC agent',
    urisLabel: 'Allowed redirect URLs (one per line)',
    urisPlaceholder: 'https://example.com/oauth/callback',
    preset: 'Preset',
    presetUsed: 'already configured',
    create: 'Create application',
    createError: 'Unable to create the application.',
    sharedRedirect: (uri, names) => `URL ${uri} is also used by: ${names}.`,
    clientActive: 'Active', clientInactive: 'Disabled',
    redirects: 'Allowed redirect URLs',
    addRedirect: 'Add',
    addRedirectLabel: 'New redirect URL (provided by the application)',
    redirectAdded: 'Redirect URL added',
    redirectError: 'URL rejected.',
    rotate: 'Regenerate secret',
    rotateTitle: (n) => `Regenerate the secret of ${n}?`,
    rotateText: 'The previous secret will be rejected immediately. You will need to enter the new one in the application.',
    rotateError: 'Unable to regenerate the secret.',
    deactivate: 'Disable', reactivate: 'Reactivate',
    deactivateTitle: (n) => `Disable ${n}?`,
    deactivateText: (n) => `All its connections (${n}) and their tokens will be revoked immediately. Reactivating will require a new connection from the application. Other applications are not affected.`,
    deactivated: 'Application disabled', reactivated: 'Application reactivated', activeError: 'Unable to update the application.',
    valuesTitle: (n) => `To enter in ${n}`,
    mcpUrl: 'MCP server URL',
    clientId: 'Client ID',
    secretNote: 'The secret is only available in the window shown at creation or regeneration.',
    authMethod: 'Client authentication: client_secret_post or client_secret_basic. PKCE S256 required.',
    authMethodPublic: 'Client authentication: none (public client). PKCE S256 required.',
    publicNoSecret: 'Public application: no secret. It identifies itself with its Client ID and must use PKCE (S256).',
    typeLabel: 'Application type',
    types: { confidential: 'Web service (confidential)', public: 'Installed application (public)' },
    typeBadge: { confidential: 'Confidential', public: 'Public' },
    typeHelp: {
      confidential: 'For a hosted service (ChatGPT, Claude on the web…): it gets a secret, shown only once.',
      public: 'For an application installed on a computer (command-line tool, code editor…): no secret, security relies on PKCE. Local redirect URLs allowed.',
    },
    urisHelp: {
      confidential: 'Exact HTTPS URLs.',
      public: 'Exact HTTPS URLs, or local URLs http://127.0.0.1/<path> and http://[::1]/<path> without a port (the application picks it).',
    },
    scopesLabel: 'Permissions granted to this application',
    scopeNames: {
      'watch:read': 'Read the criteria, the watch status and recent offers',
      'opportunities:write': 'Add offers and watch reports',
    },
    scopesRequired: 'Choose at least one permission.',
    scopesHelp: 'Removing a permission applies immediately; adding one requires a new connection from the application.',
    scopesSave: 'Save permissions', scopesSaved: 'Permissions updated', scopesError: 'Unable to update the permissions.',
    publicCreatedTitle: (n) => `Application ${n} created`,
    publicCreatedText: 'Public application: there is no secret to keep. Enter this Client ID in the application.',
    removeRedirect: (u) => `Remove URL ${u}`,
    removeRedirectTitle: 'Remove this redirect URL?',
    removeRedirectText: (u) => `${u} will no longer be usable to connect. Existing connections are not revoked.`,
    redirectRemoved: 'URL removed', removeError: 'Unable to remove the URL.', removeLabel: 'Remove',
    connections: (n) => `${n} active connection(s)`,
    toggleDetails: ' — show or hide the application details',
    cimdBadge: 'Published identity',
    cimdNote: (host, date) => `Identity published by ${host}${date ? ` — document read on ${date}` : ''}. No secret: PKCE required.`,
    cimdRedirects: "URLs provided by the publisher's document: not editable here.",
    cimd: {
      title: 'Applications with a published identity (CIMD)',
      help: 'Lets applications such as Claude Code, Codex or VS Code connect without manual creation: their name and redirect URLs are read from a document published on their own domain. Only the approved domains below are accepted, and every connection requires your consent.',
      on: 'Active — advertised to applications', off: 'Disabled',
      enable: 'Accept applications with a published identity',
      hosts: 'Approved domains (one per line, exact match)',
      hostsPlaceholder: 'claude.ai',
      suggestions: 'Verified domains:',
      scopes: 'Permissions granted by default to new applications',
      scopesHelp: 'Read-only recommended: you can widen them later, application by application.',
      save: 'Save policy', saved: 'Policy saved', error: 'Unable to save the policy.',
      confirmTitle: 'Save the CIMD policy?',
      confirmEnable: (n) => `Applications published by ${n} approved domain(s) will be able to request a connection. Every connection still requires your explicit consent.`,
      confirmDisable: 'No new application with a published identity will be able to connect. Existing connections stay active: disable them one by one if needed.',
      noHosts: 'Add at least one domain to enable.',
    },
    grantsTitle: 'OAuth authorizations',
    grantsEmpty: 'No authorization yet.',
    grantStatus: {
      active: 'Active', access_expired_observed: 'Active (token to renew)', reconnection_required: 'Reconnection required',
      revoked: 'Revoked', compromised: 'Revoked (security)', superseded: 'Superseded',
    },
    alerts: { refresh_not_observed: 'Renewal not observed', reconnection_soon: 'Reconnection needed soon' },
    createdAt: 'Created on', lastRefresh: 'Last renewal', expires: 'Expires on', never: 'Never',
    revoke: 'Revoke', revokeTitle: 'Revoke this authorization?',
    revokeText: (n) => `${n} will lose this access immediately; a new connection will be required. Other applications are not affected.`,
    revoked: 'Authorization revoked', revokeError: 'Unable to revoke the authorization.',
    cancel: 'Cancel', confirm: 'Confirm',
    copy: 'Copy', copied: 'Copied', copyError: 'Copy failed: select the value and copy it manually.',
    secretTitle: (n) => `Credentials of ${n}`,
    secretWarning: 'Copy the secret now. For your security, it will never be shown again.',
    secretLabel: 'Client secret',
    done: 'I have copied the secret',
    loadError: 'Unable to load OAuth connections.', retry: 'Retry',
  },
};

const USABLE = ['active', 'access_expired_observed'];
const SCOPES = ['watch:read', 'opportunities:write'];
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

const STATE_STYLE = {
  none: 'border-slate-600 bg-slate-700/30 text-slate-300',
  configured: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  active: 'border-green-500/30 bg-green-500/10 text-green-400',
  disabled: 'border-slate-600 bg-slate-700/30 text-slate-400',
  unavailable: 'border-red-500/30 bg-red-500/10 text-red-400',
};
const SERVICE_STYLE = { open: STATE_STYLE.active, cut: STATE_STYLE.configured, unavailable: STATE_STYLE.unavailable };

const formatDate = (value, language) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, language === 'fr' ? 'd MMM yyyy, HH:mm' : 'MMM d, yyyy, HH:mm', { locale: language === 'fr' ? fr : enUS });
};

const errorDetail = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

/** État d'UN client : non configuré, configuré, actif, désactivé ou indisponible. */
export const connectionState = (status, client) => {
  if (!client) return 'none';
  if (!client.active) return 'disabled';
  if (!status || status.service === 'unavailable') return 'unavailable';
  return status.service === 'open' ? 'active' : 'configured';
};

/** Avertissements de collision d'adresses de retour, regroupés par adresse. */
const reportSharedRedirects = (warnings, t) => {
  const byUri = {};
  (warnings || []).filter(w => w.code === 'redirect_uri_shared').forEach((w) => {
    (byUri[w.redirect_uri] = byUri[w.redirect_uri] || []).push(w.client_name);
  });
  Object.entries(byUri).forEach(([uri, names]) => toast.warning(t.sharedRedirect(uri, names.join(', '))));
};

const Badge = ({ className, children, testId }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${className}`} data-testid={testId}>
    {children}
  </span>
);

const CopyField = ({ label, value, testId, t }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error(t.copyError);
    }
  };
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 min-w-0 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg font-mono text-xs sm:text-sm text-slate-200 break-all select-all"
          data-testid={testId}>
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}
          className="h-auto min-h-9 shrink-0 border-slate-700 transition-colors" aria-label={`${t.copy} : ${label}`}
          data-testid={`${testId}-copy`}>
          {copied ? <Check /> : <Copy />}
          <span className="hidden sm:inline">{copied ? t.copied : t.copy}</span>
        </Button>
      </div>
    </div>
  );
};

/**
 * Affiche UNE fois le client_secret (création ou rotation). Il ne vit que dans le state du
 * panneau et est effacé à la fermeture ; jamais écrit ailleurs (storage, cache, URL, logs).
 */
const OAuthSecretDialog = ({ credentials, onClose, t }) => (
  <Dialog open={!!credentials} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent
      className="bg-[#0a0f1a] border-slate-800 text-white w-[calc(100%-2rem)] max-w-lg rounded-xl"
      onInteractOutside={(e) => e.preventDefault()}
      data-testid="oauth-secret-dialog"
    >
      <DialogHeader className="text-left pr-6">
        <DialogTitle className="font-heading text-lg flex items-center gap-2 break-words">
          <KeyRound size={18} className="text-gold shrink-0" aria-hidden="true" />
          {credentials?.client_secret ? t.secretTitle(credentials?.name || '') : t.publicCreatedTitle(credentials?.name || '')}
        </DialogTitle>
        {credentials?.client_secret ? (
          <DialogDescription className="flex items-start gap-2 text-amber-300">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t.secretWarning}
          </DialogDescription>
        ) : (
          <DialogDescription className="text-slate-400" data-testid="oauth-public-created">{t.publicCreatedText}</DialogDescription>
        )}
      </DialogHeader>
      {credentials && (
        <div className="flex flex-col gap-3">
          <CopyField label={t.clientId} value={credentials.client_id} testId="oauth-secret-client-id" t={t} />
          {credentials.client_secret && (
            <CopyField label={t.secretLabel} value={credentials.client_secret} testId="oauth-secret-value" t={t} />
          )}
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" className="w-full sm:w-auto h-10 border-slate-700" onClick={onClose}
          data-testid="oauth-secret-done">
          {t.done}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const ConfirmDialog = ({ open, title, text, confirmLabel, danger, onConfirm, onCancel, testId, t }) => (
  <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
    <AlertDialogContent className="bg-[#0a0f1a] border-slate-800 text-white w-[calc(100%-2rem)] max-w-md rounded-xl">
      <AlertDialogHeader className="text-left">
        <AlertDialogTitle className="break-words">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-slate-400">{text}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel className="h-10 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
          {t.cancel}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className={`h-10 ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gold hover:bg-gold-light text-[#020817] font-semibold'}`}
          data-testid={testId}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const CheckRow = ({ label, ok, value }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-slate-400">{label}</span>
    <span className={`flex items-center gap-1.5 ${ok ? 'text-green-400' : 'text-amber-300'}`}>
      {ok ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldAlert size={14} aria-hidden="true" />}
      {value}
    </span>
  </div>
);

const Choice = ({ role, checked, onClick, children, testId, disabled }) => (
  <button type="button" role={role} aria-checked={checked} onClick={onClick} disabled={disabled}
    className={`min-h-9 px-3 py-1.5 rounded-lg border text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:opacity-50
      ${checked ? 'border-gold/50 bg-gold/15 text-gold' : 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'}`}
    data-testid={testId}>
    {children}
  </button>
);

const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Permissions (scopes) : cases à cocher accessibles, au moins une requise. */
const ScopePicker = ({ value, onChange, idPrefix, t }) => (
  <div className="flex flex-col gap-2" role="group" aria-label={t.scopesLabel}>
    {SCOPES.map((scope) => (
      <Choice key={scope} role="checkbox" checked={value.includes(scope)} onClick={() => onChange(toggle(value, scope))}
        testId={`${idPrefix}-scope-${scope}`}>
        <span className="block">{t.scopeNames[scope]}</span>
        <code className="text-xs text-slate-500">{scope}</code>
      </Choice>
    ))}
    {value.length === 0 && <p className="text-xs text-red-400" role="alert">{t.scopesRequired}</p>}
  </div>
);

/** Création d'un client : type, nom, adresses de retour, permissions ; préréglages facultatifs. */
const CreateClientDialog = ({ open, onClose, onCreate, presets, existingNames, t }) => {
  const [name, setName] = useState('');
  const [uris, setUris] = useState('');
  const [clientType, setClientType] = useState('confidential');
  const [scopes, setScopes] = useState(SCOPES);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName(''); setUris(''); setClientType('confidential'); setScopes(SCOPES); setError(''); setSubmitting(false);
    }
  }, [open]);

  const redirectUris = uris.split('\n').map(u => u.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || redirectUris.length === 0 || scopes.length === 0 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), redirectUris, clientType, allowedScopes: scopes });
    } catch (err) {
      setError(errorDetail(err, t.createError));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white w-[calc(100%-2rem)] max-w-lg rounded-xl"
        data-testid="oauth-create-dialog">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader className="text-left pr-6">
            <DialogTitle className="font-heading text-lg">{t.createTitle}</DialogTitle>
            <DialogDescription className="text-slate-400">{t.createText}</DialogDescription>
          </DialogHeader>

          {presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">{t.preset} :</span>
              {presets.map((p) => {
                const used = existingNames.includes(p.name.toLowerCase());
                return (
                  <Button key={p.key} type="button" variant="outline" size="sm" disabled={used}
                    onClick={() => {
                      setName(p.name); setUris(p.redirect_uris.join('\n'));
                      setClientType(p.client_type || 'confidential'); setScopes(p.allowed_scopes || SCOPES);
                    }}
                    className="h-8 border-slate-700 transition-colors" data-testid={`oauth-preset-${p.key}`}>
                    <Sparkles size={14} aria-hidden="true" />
                    {p.name}{used ? ` (${t.presetUsed})` : ''}
                  </Button>
                );
              })}
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-slate-300 mb-2">{t.typeLabel}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t.typeLabel}>
              {['confidential', 'public'].map((kind) => (
                <Choice key={kind} role="radio" checked={clientType === kind} onClick={() => setClientType(kind)}
                  testId={`oauth-client-type-${kind}`}>
                  {t.types[kind]}
                </Choice>
              ))}
            </div>
            <p className="text-xs text-slate-400" data-testid="oauth-client-type-help">{t.typeHelp[clientType]}</p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="oauth-client-name" className="text-slate-300">{t.nameLabel}</Label>
            <Input id="oauth-client-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder} maxLength={100} required autoComplete="off"
              className="h-10 bg-slate-900/50 border-slate-700 text-white" data-testid="oauth-client-name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="oauth-client-uris" className="text-slate-300">{t.urisLabel}</Label>
            <Textarea id="oauth-client-uris" value={uris} onChange={(e) => setUris(e.target.value)}
              placeholder={t.urisPlaceholder} rows={3} autoComplete="off" spellCheck={false}
              className="bg-slate-900/50 border-slate-700 text-white font-mono text-sm"
              aria-invalid={!!error} aria-describedby={error ? 'oauth-create-error' : 'oauth-client-uris-help'}
              data-testid="oauth-client-uris" />
            <p id="oauth-client-uris-help" className="text-xs text-slate-500">{t.urisHelp[clientType]}</p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-slate-300 mb-2">{t.scopesLabel}</legend>
            <ScopePicker value={scopes} onChange={setScopes} idPrefix="oauth-create" t={t} />
          </fieldset>
          {error && <p id="oauth-create-error" role="alert" className="text-sm text-red-400">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="h-10" onClick={onClose} disabled={submitting}>{t.cancel}</Button>
            <Button type="submit" disabled={!name.trim() || redirectUris.length === 0 || scopes.length === 0 || submitting}
              aria-busy={submitting}
              className="h-10 bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
              data-testid="oauth-create-submit">
              {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
              {t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddRedirectForm = ({ clientId, mutation, t }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setValue(''); setError(''); }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim() || mutation.isPending) return;
    setError('');
    try {
      const result = await mutation.mutateAsync({ clientId, redirectUri: value.trim() });
      setValue('');
      toast.success(t.redirectAdded);
      reportSharedRedirects(result?.warnings, t);
    } catch (err) {
      setError(errorDetail(err, t.redirectError));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <Label htmlFor={`oauth-redirect-${clientId}`} className="text-xs text-slate-500">{t.addRedirectLabel}</Label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          id={`oauth-redirect-${clientId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…"
          maxLength={512}
          autoComplete="off"
          inputMode="url"
          className="h-10 bg-slate-900/50 border-slate-700 text-white font-mono text-sm"
          aria-invalid={!!error}
          aria-describedby={error ? `oauth-redirect-error-${clientId}` : undefined}
          data-testid={`oauth-redirect-input-${clientId}`}
        />
        <Button type="submit" variant="outline" className="h-10 shrink-0 border-slate-700 transition-colors"
          disabled={!value.trim() || mutation.isPending} data-testid={`oauth-redirect-add-${clientId}`}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {t.addRedirect}
        </Button>
      </div>
      {error && <p id={`oauth-redirect-error-${clientId}`} role="alert" className="text-sm text-red-400">{error}</p>}
    </form>
  );
};

/** Permissions d'un client existant : modification explicite (bouton Enregistrer). */
const ClientScopes = ({ client, mutation, t }) => {
  const current = client.allowed_scopes || SCOPES;
  const [value, setValue] = useState(current);
  const currentKey = current.join(' ');
  useEffect(() => { setValue(currentKey ? currentKey.split(' ') : []); }, [currentKey]);
  const changed = !sameSet(value, current);

  const save = async () => {
    try {
      await mutation.mutateAsync({ clientId: client.client_id, scopes: SCOPES.filter((s) => value.includes(s)) });
      toast.success(t.scopesSaved);
    } catch (err) {
      toast.error(errorDetail(err, t.scopesError));
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid={`oauth-scopes-${client.client_id}`}>
      <p className="text-xs text-slate-500">{t.scopesLabel}</p>
      <ScopePicker value={value} onChange={setValue} idPrefix={`oauth-${client.client_id}`} t={t} />
      <p className="text-xs text-slate-500">{t.scopesHelp}</p>
      {changed && (
        <Button type="button" size="sm" onClick={save} disabled={value.length === 0 || mutation.isPending}
          className="self-start h-9 bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
          data-testid={`oauth-scopes-save-${client.client_id}`}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
          {t.scopesSave}
        </Button>
      )}
    </div>
  );
};

const ClientCard = ({ client, status, busy, addRedirectUri, setClientActive, setClientScopes, onConfirm, onReactivate, t }) => {
  const state = connectionState(status, client);
  const id = client.client_id;
  const isPublic = client.client_type === 'public';
  const isCimd = client.registration === 'cimd';
  return (
    <AccordionItem
      value={id}
      className={`rounded-lg border ${client.active ? 'border-slate-700 bg-slate-900/40' : 'border-slate-800 bg-slate-900/20'}`}
      data-testid={`oauth-client-${id}`}
    >
      {/* En-tête compact : bouton natif (Radix) avec aria-expanded / aria-controls, Entrée et Espace */}
      <AccordionTrigger
        className="min-h-14 px-4 py-3 gap-3 rounded-lg hover:no-underline transition-colors hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 [&>svg]:text-slate-400"
        data-testid={`oauth-client-toggle-${id}`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <AppWindow size={16} className="text-gold shrink-0" aria-hidden="true" />
            <span className="text-white font-medium break-words min-w-0" data-testid={`oauth-client-name-${id}`}>{client.name}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge className={STATE_STYLE[state]} testId={`oauth-client-state-${id}`}>{t.state[state]}</Badge>
            <Badge className="border-slate-600 bg-slate-800/60 text-slate-300" testId={`oauth-client-type-${id}`}>
              {t.typeBadge[isPublic ? 'public' : 'confidential']}
            </Badge>
            {isCimd && (
              <Badge className="border-gold/30 bg-gold/10 text-gold" testId={`oauth-client-cimd-${id}`}>{t.cimdBadge}</Badge>
            )}
            <span className="text-xs text-slate-500 whitespace-nowrap" data-testid={`oauth-client-connections-${id}`}>
              {t.connections(client.active_grants ?? 0)}
            </span>
          </span>
        </span>
        <span className="sr-only">{t.toggleDetails}</span>
      </AccordionTrigger>

      <AccordionContent className="flex flex-col gap-4 px-4 pb-4 pt-1" data-testid={`oauth-client-details-${id}`}>
      <p className="text-xs text-slate-400">{t.stateHelp[state]}</p>

      <div className="flex flex-col gap-3 p-3 rounded-lg border border-gold/20 bg-gold/5" data-testid={`oauth-values-${id}`}>
        <p className="text-sm text-white font-medium break-words">{t.valuesTitle(client.name)}</p>
        <CopyField label={t.mcpUrl} value={status.mcp_url} testId={`oauth-mcp-url-${id}`} t={t} />
        <CopyField label={t.clientId} value={id} testId={`oauth-client-id-${id}`} t={t} />
        <p className="text-xs text-slate-400">
          {isCimd ? t.cimdNote(client.metadata_host, formatDate(client.metadata_fetched_at, t.lang))
            : isPublic ? t.publicNoSecret : t.secretNote}
        </p>
        <p className="text-xs text-slate-500">{isPublic ? t.authMethodPublic : t.authMethod}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-500 flex items-center gap-1.5"><Link2 size={12} aria-hidden="true" />{t.redirects}</p>
        <ul className="flex flex-col gap-1" data-testid={`oauth-redirect-list-${id}`}>
          {client.redirect_uris.map(uri => (
            <li key={uri} className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-300 break-all">{uri}</span>
              {!isCimd && <button type="button" onClick={() => onConfirm({ kind: 'removeRedirect', client, uri })}
                disabled={client.redirect_uris.length <= 1} aria-label={t.removeRedirect(uri)}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                data-testid={`oauth-redirect-remove-${id}-${uri}`}>
                <Trash2 size={14} aria-hidden="true" />
              </button>}
            </li>
          ))}
        </ul>
        {isCimd ? <p className="text-xs text-slate-500">{t.cimdRedirects}</p>
          : <AddRedirectForm clientId={id} mutation={addRedirectUri} t={t} />}
      </div>

      <ClientScopes client={client} mutation={setClientScopes} t={t} />

      <div className="flex flex-col sm:flex-row gap-2">
        {!isPublic && (
          <Button variant="outline" onClick={() => onConfirm({ kind: 'rotate', client })} disabled={busy}
            className="h-10 border-slate-700 transition-colors" data-testid={`oauth-rotate-${id}`}>
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t.rotate}
          </Button>
        )}
        {client.active ? (
          <Button variant="outline" onClick={() => onConfirm({ kind: 'deactivate', client })}
            disabled={setClientActive.isPending}
            className="h-10 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            data-testid={`oauth-deactivate-${id}`}>
            <Ban />
            {t.deactivate}
          </Button>
        ) : (
          <Button onClick={() => onReactivate(client)} disabled={setClientActive.isPending}
            className="h-10 bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
            data-testid={`oauth-reactivate-${id}`}>
            <Power />
            {t.reactivate}
          </Button>
        )}
      </div>
      </AccordionContent>
    </AccordionItem>
  );
};

const VERIFIED_HOSTS = ['claude.ai', 'chatgpt.com', 'vscode.dev'];

/** Politique CIMD : activation, domaines approuvés, permissions par défaut (enregistrement confirmé). */
const CimdPolicyCard = ({ query, onSave, t }) => {
  const c = t.cimd;
  const data = query.data;
  const [enabled, setEnabled] = useState(false);
  const [hosts, setHosts] = useState('');
  const [scopes, setScopes] = useState(['watch:read']);
  const key = data ? JSON.stringify([data.enabled, data.allowed_hosts, data.default_scopes]) : '';
  useEffect(() => {
    if (!key) return;
    const [e, h, sc] = JSON.parse(key);
    setEnabled(e); setHosts(h.join('\n')); setScopes(sc);
  }, [key]);
  if (!data) return null;
  const hostList = hosts.split('\n').map((h) => h.trim()).filter(Boolean);
  const addHost = (h) => { if (!hostList.includes(h)) setHosts([...hostList, h].join('\n')); };

  return (
    <div className="p-4 rounded-lg border border-slate-700 bg-slate-900/40 flex flex-col gap-3" data-testid="oauth-cimd">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-white font-medium">{c.title}</p>
        <Badge className={data.operational ? STATE_STYLE.active : STATE_STYLE.disabled} testId="oauth-cimd-state">
          {data.operational ? c.on : c.off}
        </Badge>
      </div>
      <p className="text-xs text-slate-400">{c.help}</p>
      <Choice role="checkbox" checked={enabled} onClick={() => setEnabled(!enabled)} testId="oauth-cimd-enabled">{c.enable}</Choice>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="oauth-cimd-hosts" className="text-xs text-slate-400">{c.hosts}</Label>
        <Textarea id="oauth-cimd-hosts" value={hosts} onChange={(e) => setHosts(e.target.value)} rows={3}
          placeholder={c.hostsPlaceholder} spellCheck={false} autoComplete="off"
          className="bg-slate-900/50 border-slate-700 text-white font-mono text-sm" data-testid="oauth-cimd-hosts" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">{c.suggestions}</span>
          {VERIFIED_HOSTS.map((h) => (
            <Button key={h} type="button" variant="outline" size="sm" disabled={hostList.includes(h)} onClick={() => addHost(h)}
              className="h-8 border-slate-700 transition-colors font-mono" data-testid={`oauth-cimd-suggest-${h}`}>
              <Plus size={12} aria-hidden="true" />{h}
            </Button>
          ))}
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-slate-400 mb-1">{c.scopes}</legend>
        <ScopePicker value={scopes} onChange={setScopes} idPrefix="oauth-cimd" t={t} />
        <p className="text-xs text-slate-500">{c.scopesHelp}</p>
      </fieldset>
      {enabled && hostList.length === 0 && <p className="text-xs text-amber-300" role="note">{c.noHosts}</p>}
      <Button type="button" onClick={() => onSave({ enabled, allowed_hosts: hostList, default_scopes: SCOPES.filter((sc) => scopes.includes(sc)) })}
        disabled={scopes.length === 0} className="self-start h-10 bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
        data-testid="oauth-cimd-save">
        <Check />{c.save}
      </Button>
    </div>
  );
};

export const OAuthConnectionsPanel = () => {
  const { language } = useLanguage();
  const t = T[language];
  const {
    status, clients, grants, createClient, rotateSecret, addRedirectUri, removeRedirectUri, setClientScopes,
    setClientActive, revokeGrant, setKillSwitch, cimdPolicy, setCimdPolicy,
  } = useOAuthAdmin();

  // Le secret ne vit que dans ce state local : effacé à la fermeture, détruit au démontage.
  const [credentials, setCredentials] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busyClient, setBusyClient] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const s = status.data;
  const clientList = clients.data ?? [];

  const handleCreate = async (definition) => {
    const created = await createClient(definition);
    setCreateOpen(false);
    reportSharedRedirects(created.warnings, t);
    setCredentials({ name: created.name, client_id: created.client_id, client_secret: created.client_secret });
  };

  const rotate = async (client) => {
    if (busyClient) return;
    setBusyClient(client.client_id);
    try {
      const rotated = await rotateSecret(client.client_id);
      setCredentials({ name: client.name, client_id: rotated.client_id, client_secret: rotated.client_secret });
    } catch (err) {
      toast.error(errorDetail(err, t.rotateError));
    } finally {
      setBusyClient(null);
    }
  };

  const runConfirmed = async () => {
    const current = confirm;
    setConfirm(null);
    if (!current) return;
    try {
      if (current.kind === 'open' || current.kind === 'cut') {
        await setKillSwitch.mutateAsync(current.kind === 'cut');
        toast.success(current.kind === 'cut' ? t.cutDone : t.opened);
      } else if (current.kind === 'deactivate') {
        await setClientActive.mutateAsync({ clientId: current.client.client_id, active: false });
        toast.success(t.deactivated);
      } else if (current.kind === 'rotate') {
        await rotate(current.client);
      } else if (current.kind === 'revoke') {
        await revokeGrant.mutateAsync(current.grant.id);
        toast.success(t.revoked);
      } else if (current.kind === 'cimd') {
        await setCimdPolicy.mutateAsync(current.policy);
        toast.success(t.cimd.saved);
      } else if (current.kind === 'removeRedirect') {
        await removeRedirectUri.mutateAsync({ clientId: current.client.client_id, redirectUri: current.uri });
        toast.success(t.redirectRemoved);
      }
    } catch (err) {
      const fallback = {
        open: t.switchError, cut: t.switchError, deactivate: t.activeError, revoke: t.revokeError, removeRedirect: t.removeError,
        cimd: t.cimd.error,
      }[current.kind];
      toast.error(errorDetail(err, fallback));
    }
  };

  const reactivate = async (c) => {
    try {
      await setClientActive.mutateAsync({ clientId: c.client_id, active: true });
      toast.success(t.reactivated);
    } catch (err) {
      toast.error(errorDetail(err, t.activeError));
    }
  };

  if (status.isLoading || clients.isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-500" aria-label="Chargement" /></div>;
  }
  if (status.isError || clients.isError) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-red-500/30" role="alert">
        <p className="text-sm text-slate-300">{t.loadError}</p>
        <Button variant="outline" size="sm" className="border-slate-700"
          onClick={() => { status.refetch(); clients.refetch(); grants.refetch(); }}>{t.retry}</Button>
      </div>
    );
  }

  const confirmProps = confirm && {
    open: { title: t.openTitle, text: t.openText, confirmLabel: t.open, danger: false },
    cut: { title: t.cutTitle, text: t.cutText, confirmLabel: t.cut, danger: true },
    deactivate: {
      title: t.deactivateTitle(confirm.client?.name), text: t.deactivateText(confirm.client?.active_grants ?? 0),
      confirmLabel: t.deactivate, danger: true,
    },
    rotate: { title: t.rotateTitle(confirm.client?.name), text: t.rotateText, confirmLabel: t.rotate, danger: false },
    revoke: { title: t.revokeTitle, text: t.revokeText(confirm.grant?.client_name), confirmLabel: t.revoke, danger: true },
    removeRedirect: { title: t.removeRedirectTitle, text: t.removeRedirectText(confirm.uri), confirmLabel: t.removeLabel, danger: true },
    cimd: {
      title: t.cimd.confirmTitle,
      text: confirm.policy?.enabled && confirm.policy?.allowed_hosts?.length
        ? t.cimd.confirmEnable(confirm.policy.allowed_hosts.length) : t.cimd.confirmDisable,
      confirmLabel: t.cimd.save, danger: false,
    },
  }[confirm.kind];

  return (
    <div className="flex flex-col gap-4" data-testid="oauth-panel">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <p className="text-slate-400 text-sm">{t.intro}</p>
        <Badge className={SERVICE_STYLE[s.service]} testId="oauth-service-state">{t.service[s.service]}</Badge>
      </div>

      {/* Service */}
      <div className="p-4 rounded-lg border border-slate-700 bg-slate-900/40 flex flex-col gap-3" data-testid="oauth-service">
        <p className="text-white font-medium flex items-center gap-2">
          <Server size={16} className="text-gold" aria-hidden="true" />
          {t.serviceTitle}
        </p>
        <div className="flex flex-col gap-1.5">
          <CheckRow label={t.checkKeys} ok={s.mcp_enabled} value={s.mcp_enabled ? t.keysOk : t.keysMissing} />
          <CheckRow label={t.checkSwitch} ok={!s.kill_switch_active} value={s.kill_switch_active ? t.switchClosed : t.switchOpen} />
          <CheckRow label={t.checkWatch} ok={s.owner_watch_enabled} value={s.owner_watch_enabled ? t.watchOn : t.watchOff} />
        </div>
        {!s.mcp_enabled && <p className="text-xs text-slate-500">{t.unavailableNote}</p>}
        {s.kill_switch_active ? (
          <Button onClick={() => setConfirm({ kind: 'open' })} disabled={setKillSwitch.isPending}
            className="h-10 self-start bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
            data-testid="oauth-open-service">
            <Power />
            {t.open}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setConfirm({ kind: 'cut' })} disabled={setKillSwitch.isPending}
            className="h-10 self-start border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            data-testid="oauth-cut-service">
            <PowerOff />
            {t.cut}
          </Button>
        )}
      </div>

      <CimdPolicyCard query={cimdPolicy} onSave={(policy) => setConfirm({ kind: 'cimd', policy })} t={t} />

      {/* Applications clientes */}
      <div className="flex flex-col gap-2" data-testid="oauth-clients">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <p className="text-white font-medium">{t.clientsTitle}</p>
          <Button onClick={() => setCreateOpen(true)}
            className="h-10 self-start sm:self-auto bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
            data-testid="oauth-add-client">
            <Plus />
            {t.addClient}
          </Button>
        </div>
        {clientList.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-slate-700 rounded-lg" data-testid="oauth-clients-empty">
            <KeyRound className="mx-auto mb-3 text-slate-500" aria-hidden="true" />
            <p className="text-sm text-slate-400">{t.clientsEmpty}</p>
          </div>
        ) : (
          // Accordéon : toutes repliées par défaut, une seule ouverte à la fois, re-clic pour replier
          <Accordion type="single" collapsible className="flex flex-col gap-2" data-testid="oauth-clients-list">
            {clientList.map(c => (
              <ClientCard key={c.client_id} client={c} status={s} busy={busyClient === c.client_id}
                addRedirectUri={addRedirectUri} setClientActive={setClientActive} setClientScopes={setClientScopes}
                onConfirm={setConfirm} onReactivate={reactivate} t={t} />
            ))}
          </Accordion>
        )}
      </div>

      {/* Autorisations */}
      <div className="flex flex-col gap-2" data-testid="oauth-grants">
        <p className="text-white font-medium">{t.grantsTitle}</p>
        {grants.isLoading ? (
          <Loader2 className="animate-spin text-slate-500" aria-label="Chargement" />
        ) : (grants.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500" data-testid="oauth-grants-empty">{t.grantsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {grants.data.map(g => {
              const usable = USABLE.includes(g.status);
              return (
                <li key={g.id} className={`p-3 rounded-lg border ${usable ? 'border-slate-700 bg-slate-900/40' : 'border-slate-800 bg-slate-900/20 opacity-70'}`}
                  data-testid={`oauth-grant-${g.id}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 justify-between">
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-white text-sm font-medium break-words">{g.client_name}</p>
                        <Badge className={usable ? STATE_STYLE.active : STATE_STYLE.disabled}>{t.grantStatus[g.status] || g.status}</Badge>
                        {g.alert && <Badge className={STATE_STYLE.configured}>{t.alerts[g.alert] || g.alert}</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 break-all">{g.user_email}</p>
                      <p className="text-xs text-slate-500">
                        {t.createdAt} {formatDate(g.created_at, language)}
                        {' · '}{t.lastRefresh} : {formatDate(g.last_refresh_at, language) || t.never}
                        {' · '}{t.expires} {formatDate(g.expires_at, language)}
                      </p>
                    </div>
                    {usable && (
                      <Button variant="outline" size="sm" onClick={() => setConfirm({ kind: 'revoke', grant: g })}
                        className="h-10 sm:h-9 shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        aria-label={`${t.revoke} : ${g.client_name} (${g.user_email})`}
                        data-testid={`oauth-grant-revoke-${g.id}`}>
                        <Ban />
                        {t.revoke}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CreateClientDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        presets={s.presets ?? []}
        existingNames={clientList.map(c => c.name.toLowerCase())}
        t={t}
      />

      <ConfirmDialog
        open={!!confirm}
        {...(confirmProps || { title: '', text: '', confirmLabel: t.confirm })}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
        testId="oauth-confirm"
        t={t}
      />

      <OAuthSecretDialog credentials={credentials} onClose={() => setCredentials(null)} t={t} />
    </div>
  );
};
