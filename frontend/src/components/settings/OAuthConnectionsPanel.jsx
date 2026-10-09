import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  Ban, Check, Copy, KeyRound, Link2, Loader2, Plus, Power, PowerOff, RefreshCw, Server, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOAuthAdmin } from '../../hooks/useOAuthAdmin';
import { useLanguage } from '../../i18n';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '../ui/alert-dialog';

const T = {
  fr: {
    intro: "Connectez ChatGPT à JobTracker via OAuth et MCP. Réservé à l'administrateur.",
    state: { none: 'Non configuré', configured: 'Configuré', active: 'Actif', disabled: 'Désactivé', unavailable: 'Indisponible' },
    stateHelp: {
      none: 'Aucun client ChatGPT : créez-le pour obtenir ses identifiants.',
      configured: 'Client prêt. Le service est coupé : ouvrez-le pour autoriser la connexion.',
      active: 'Le service est ouvert : ChatGPT peut se connecter avec ses identifiants.',
      disabled: 'Le client est désactivé : aucune connexion possible.',
      unavailable: 'Le MCP n\'est pas activé sur ce déploiement (variables de production).',
    },
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
    clientTitle: 'Client ChatGPT',
    createClient: 'Créer le client ChatGPT',
    createError: 'Impossible de créer le client.',
    clientActive: 'Actif', clientInactive: 'Désactivé',
    redirects: 'Adresses de retour autorisées',
    addRedirect: 'Ajouter',
    addRedirectLabel: 'Nouvelle adresse de retour (fournie par ChatGPT)',
    redirectAdded: 'Adresse de retour ajoutée',
    redirectError: "Adresse refusée.",
    rotate: 'Régénérer le secret',
    rotateTitle: 'Régénérer le secret ?',
    rotateText: "L'ancien secret sera refusé immédiatement. Vous devrez saisir le nouveau dans ChatGPT.",
    rotateError: 'Impossible de régénérer le secret.',
    deactivate: 'Désactiver', reactivate: 'Réactiver',
    deactivateTitle: 'Désactiver ce client ?',
    deactivateText: (n) => `Toutes ses connexions (${n}) et leurs jetons seront révoqués immédiatement. Une réactivation exigera une nouvelle connexion depuis ChatGPT.`,
    deactivated: 'Client désactivé', reactivated: 'Client réactivé', activeError: 'Impossible de modifier le client.',
    chatgptTitle: 'À saisir dans ChatGPT',
    mcpUrl: 'URL du serveur MCP',
    clientId: 'Client ID',
    secretNote: "Le secret n'est disponible que dans la fenêtre affichée à la création ou à la régénération.",
    authMethod: 'Authentification du client : client_secret_post ou client_secret_basic.',
    grantsTitle: 'Autorisations OAuth',
    grantsEmpty: 'Aucune autorisation pour le moment.',
    grantStatus: {
      active: 'Active', access_expired_observed: 'Active (jeton à renouveler)', reconnection_required: 'Reconnexion requise',
      revoked: 'Révoquée', compromised: 'Révoquée (sécurité)', superseded: 'Remplacée',
    },
    alerts: { refresh_not_observed: 'Renouvellement non observé', reconnection_soon: 'Reconnexion bientôt nécessaire' },
    createdAt: 'Créée le', lastRefresh: 'Dernier renouvellement', expires: 'Expire le', never: 'Jamais',
    revoke: 'Révoquer', revokeTitle: 'Révoquer cette autorisation ?',
    revokeText: 'ChatGPT perdra immédiatement son accès ; une nouvelle connexion sera nécessaire.',
    revoked: 'Autorisation révoquée', revokeError: "Impossible de révoquer l'autorisation.",
    cancel: 'Annuler', confirm: 'Confirmer',
    copy: 'Copier', copied: 'Copié', copyError: 'Copie impossible : sélectionnez la valeur et copiez-la manuellement.',
    secretTitle: 'Identifiants du client ChatGPT',
    secretWarning: 'Copiez le secret maintenant. Pour votre sécurité, il ne sera plus jamais affiché.',
    secretLabel: 'Client secret',
    done: "J'ai copié le secret",
    loadError: 'Impossible de charger les connexions OAuth.', retry: 'Réessayer',
  },
  en: {
    intro: 'Connect ChatGPT to JobTracker through OAuth and MCP. Administrator only.',
    state: { none: 'Not configured', configured: 'Configured', active: 'Active', disabled: 'Disabled', unavailable: 'Unavailable' },
    stateHelp: {
      none: 'No ChatGPT client yet: create it to get its credentials.',
      configured: 'Client ready. The service is cut: open it to allow the connection.',
      active: 'The service is open: ChatGPT can connect with its credentials.',
      disabled: 'The client is disabled: no connection is possible.',
      unavailable: 'MCP is not enabled on this deployment (production variables).',
    },
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
    clientTitle: 'ChatGPT client',
    createClient: 'Create the ChatGPT client',
    createError: 'Unable to create the client.',
    clientActive: 'Active', clientInactive: 'Disabled',
    redirects: 'Allowed redirect URLs',
    addRedirect: 'Add',
    addRedirectLabel: 'New redirect URL (provided by ChatGPT)',
    redirectAdded: 'Redirect URL added',
    redirectError: 'URL rejected.',
    rotate: 'Regenerate secret',
    rotateTitle: 'Regenerate the secret?',
    rotateText: 'The previous secret will be rejected immediately. You will need to enter the new one in ChatGPT.',
    rotateError: 'Unable to regenerate the secret.',
    deactivate: 'Disable', reactivate: 'Reactivate',
    deactivateTitle: 'Disable this client?',
    deactivateText: (n) => `All its connections (${n}) and their tokens will be revoked immediately. Reactivating will require a new connection from ChatGPT.`,
    deactivated: 'Client disabled', reactivated: 'Client reactivated', activeError: 'Unable to update the client.',
    chatgptTitle: 'To enter in ChatGPT',
    mcpUrl: 'MCP server URL',
    clientId: 'Client ID',
    secretNote: 'The secret is only available in the window shown at creation or regeneration.',
    authMethod: 'Client authentication: client_secret_post or client_secret_basic.',
    grantsTitle: 'OAuth authorizations',
    grantsEmpty: 'No authorization yet.',
    grantStatus: {
      active: 'Active', access_expired_observed: 'Active (token to renew)', reconnection_required: 'Reconnection required',
      revoked: 'Revoked', compromised: 'Revoked (security)', superseded: 'Superseded',
    },
    alerts: { refresh_not_observed: 'Renewal not observed', reconnection_soon: 'Reconnection needed soon' },
    createdAt: 'Created on', lastRefresh: 'Last renewal', expires: 'Expires on', never: 'Never',
    revoke: 'Revoke', revokeTitle: 'Revoke this authorization?',
    revokeText: 'ChatGPT will lose access immediately; a new connection will be required.',
    revoked: 'Authorization revoked', revokeError: 'Unable to revoke the authorization.',
    cancel: 'Cancel', confirm: 'Confirm',
    copy: 'Copy', copied: 'Copied', copyError: 'Copy failed: select the value and copy it manually.',
    secretTitle: 'ChatGPT client credentials',
    secretWarning: 'Copy the secret now. For your security, it will never be shown again.',
    secretLabel: 'Client secret',
    done: 'I have copied the secret',
    loadError: 'Unable to load OAuth connections.', retry: 'Retry',
  },
};

const USABLE = ['active', 'access_expired_observed'];

const STATE_STYLE = {
  none: 'border-slate-600 bg-slate-700/30 text-slate-300',
  configured: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  active: 'border-green-500/30 bg-green-500/10 text-green-400',
  disabled: 'border-slate-600 bg-slate-700/30 text-slate-400',
  unavailable: 'border-red-500/30 bg-red-500/10 text-red-400',
};

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

/** État global affiché en tête : non configuré, configuré, actif, désactivé ou indisponible. */
export const connectionState = (status, client) => {
  if (!client) return 'none';
  if (!client.active) return 'disabled';
  if (!status || status.service === 'unavailable') return 'unavailable';
  return status.service === 'open' ? 'active' : 'configured';
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
        <DialogTitle className="font-heading text-lg flex items-center gap-2">
          <KeyRound size={18} className="text-gold" aria-hidden="true" />
          {t.secretTitle}
        </DialogTitle>
        <DialogDescription className="flex items-start gap-2 text-amber-300">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t.secretWarning}
        </DialogDescription>
      </DialogHeader>
      {credentials && (
        <div className="flex flex-col gap-3">
          <CopyField label={t.clientId} value={credentials.client_id} testId="oauth-secret-client-id" t={t} />
          <CopyField label={t.secretLabel} value={credentials.client_secret} testId="oauth-secret-value" t={t} />
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
        <AlertDialogTitle>{title}</AlertDialogTitle>
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

const AddRedirectForm = ({ clientId, mutation, t }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setValue(''); setError(''); }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim() || mutation.isPending) return;
    setError('');
    try {
      await mutation.mutateAsync({ clientId, redirectUri: value.trim() });
      setValue('');
      toast.success(t.redirectAdded);
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
          placeholder="https://chatgpt.com/connector/oauth/…"
          maxLength={512}
          autoComplete="off"
          inputMode="url"
          className="h-10 bg-slate-900/50 border-slate-700 text-white font-mono text-sm"
          aria-invalid={!!error}
          aria-describedby={error ? `oauth-redirect-error-${clientId}` : undefined}
          data-testid="oauth-redirect-input"
        />
        <Button type="submit" variant="outline" className="h-10 shrink-0 border-slate-700 transition-colors"
          disabled={!value.trim() || mutation.isPending} data-testid="oauth-redirect-add">
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {t.addRedirect}
        </Button>
      </div>
      {error && <p id={`oauth-redirect-error-${clientId}`} role="alert" className="text-sm text-red-400">{error}</p>}
    </form>
  );
};

export const OAuthConnectionsPanel = () => {
  const { language } = useLanguage();
  const t = T[language];
  const {
    status, clients, grants, createClient, rotateSecret, addRedirectUri, setClientActive, revokeGrant, setKillSwitch,
  } = useOAuthAdmin();

  // Le secret ne vit que dans ce state local : effacé à la fermeture, détruit au démontage.
  const [credentials, setCredentials] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const s = status.data;
  const clientList = clients.data ?? [];
  const client = clientList.find(c => c.name.toLowerCase() === 'chatgpt') || clientList[0] || null;
  const state = connectionState(s, client);

  const runSecretAction = async (action, fallback) => {
    if (busy) return;
    setBusy(true);
    try {
      setCredentials(await action());
    } catch (err) {
      toast.error(errorDetail(err, fallback));
    } finally {
      setBusy(false);
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
        await runSecretAction(() => rotateSecret(current.client.client_id), t.rotateError);
      } else if (current.kind === 'revoke') {
        await revokeGrant.mutateAsync(current.grant.id);
        toast.success(t.revoked);
      }
    } catch (err) {
      const fallback = { open: t.switchError, cut: t.switchError, deactivate: t.activeError, revoke: t.revokeError }[current.kind];
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
    deactivate: { title: t.deactivateTitle, text: t.deactivateText(confirm.client?.active_grants ?? 0), confirmLabel: t.deactivate, danger: true },
    rotate: { title: t.rotateTitle, text: t.rotateText, confirmLabel: t.rotate, danger: false },
    revoke: { title: t.revokeTitle, text: t.revokeText, confirmLabel: t.revoke, danger: true },
  }[confirm.kind];

  return (
    <div className="flex flex-col gap-4" data-testid="oauth-panel">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <p className="text-slate-400 text-sm">{t.intro}</p>
        <Badge className={STATE_STYLE[state]} testId="oauth-state">{t.state[state]}</Badge>
      </div>
      <p className="text-sm text-slate-300 -mt-2" data-testid="oauth-state-help">{t.stateHelp[state]}</p>

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

      {/* Client */}
      {!client ? (
        <div className="text-center py-8 px-4 border border-dashed border-slate-700 rounded-lg" data-testid="oauth-client-empty">
          <KeyRound className="mx-auto mb-3 text-slate-500" aria-hidden="true" />
          <p className="text-white font-medium mb-3">{t.clientTitle}</p>
          <Button onClick={() => runSecretAction(createClient, t.createError)} disabled={busy} aria-busy={busy}
            className="h-10 bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
            data-testid="oauth-create-client">
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
            {t.createClient}
          </Button>
        </div>
      ) : (
        <div className={`p-4 rounded-lg border flex flex-col gap-4 ${client.active ? 'border-slate-700 bg-slate-900/40' : 'border-slate-800 bg-slate-900/20'}`}
          data-testid="oauth-client">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-white font-medium">{t.clientTitle}</p>
            <Badge className={client.active ? STATE_STYLE.active : STATE_STYLE.disabled} testId="oauth-client-status">
              {client.active ? t.clientActive : t.clientInactive}
            </Badge>
          </div>

          <div className="flex flex-col gap-3 p-3 rounded-lg border border-gold/20 bg-gold/5" data-testid="oauth-chatgpt-values">
            <p className="text-sm text-white font-medium">{t.chatgptTitle}</p>
            <CopyField label={t.mcpUrl} value={s.mcp_url} testId="oauth-mcp-url" t={t} />
            <CopyField label={t.clientId} value={client.client_id} testId="oauth-client-id" t={t} />
            <p className="text-xs text-slate-400">{t.secretNote}</p>
            <p className="text-xs text-slate-500">{t.authMethod}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><Link2 size={12} aria-hidden="true" />{t.redirects}</p>
            <ul className="flex flex-col gap-1" data-testid="oauth-redirect-list">
              {client.redirect_uris.map(uri => (
                <li key={uri} className="font-mono text-xs text-slate-300 break-all">{uri}</li>
              ))}
            </ul>
            <AddRedirectForm clientId={client.client_id} mutation={addRedirectUri} t={t} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirm({ kind: 'rotate', client })} disabled={busy}
              className="h-10 border-slate-700 transition-colors" data-testid="oauth-rotate-secret">
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t.rotate}
            </Button>
            {client.active ? (
              <Button variant="outline" onClick={() => setConfirm({ kind: 'deactivate', client })}
                disabled={setClientActive.isPending}
                className="h-10 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                data-testid="oauth-deactivate">
                <Ban />
                {t.deactivate}
              </Button>
            ) : (
              <Button onClick={() => reactivate(client)} disabled={setClientActive.isPending}
                className="h-10 bg-gold hover:bg-gold-light text-[#020817] font-semibold transition-colors"
                data-testid="oauth-reactivate">
                <Power />
                {t.reactivate}
              </Button>
            )}
          </div>
        </div>
      )}

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
                        <p className="text-white text-sm font-medium">{g.client_name}</p>
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
