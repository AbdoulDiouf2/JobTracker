import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Bot, Plus, Copy, Check, KeyRound, ShieldAlert, Loader2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentTokens } from '../../hooks/useAgentTokens';
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

const SCOPE_LABELS = {
  'opportunities:create': { fr: 'Ajouter des opportunités', en: 'Add opportunities' },
};

const T = {
  fr: {
    title: 'API / Agents',
    description: 'Autorisez des services externes à ajouter des opportunités à votre compte JobTracker.',
    create: 'Créer un token',
    emptyTitle: 'Aucun accès externe configuré',
    emptyText: 'Créez un token pour autoriser un service externe à ajouter des opportunités.',
    loadError: 'Impossible de charger vos tokens.',
    retry: 'Réessayer',
    active: 'Actif',
    revoked: 'Révoqué',
    createdAt: 'Créé le',
    lastUsed: 'Dernière utilisation',
    never: 'Jamais',
    permissions: 'Permissions',
    revoke: 'Révoquer',
    revokeTitle: 'Révoquer ce token ?',
    revokeText: 'Ce service ne pourra plus accéder à JobTracker avec ce token.',
    cancel: 'Annuler',
    revoked_ok: 'Token révoqué',
    revokeError: 'Impossible de révoquer ce token.',
    createTitle: 'Créer un token',
    createText: "Donnez un nom au service qui utilisera ce token pour le reconnaître plus tard.",
    nameLabel: 'Nom du token',
    namePlaceholder: 'Veille ChatGPT',
    scopeLabel: 'Permission accordée',
    createSubmit: 'Créer le token',
    createError: 'Impossible de créer le token.',
    secretTitle: 'Votre nouveau token',
    secretWarning: 'Copiez ce token maintenant. Pour votre sécurité, il ne sera plus affiché.',
    secretLabel: 'Token agent',
    copy: 'Copier',
    copied: 'Copié',
    copyError: 'Copie impossible : sélectionnez le token et copiez-le manuellement.',
    done: "J'ai copié le token",
    prefixLabel: 'Préfixe',
  },
  en: {
    title: 'API / Agents',
    description: 'Allow external services to add opportunities to your JobTracker account.',
    create: 'Create a token',
    emptyTitle: 'No external access configured',
    emptyText: 'Create a token to allow an external service to add opportunities.',
    loadError: 'Unable to load your tokens.',
    retry: 'Retry',
    active: 'Active',
    revoked: 'Revoked',
    createdAt: 'Created on',
    lastUsed: 'Last used',
    never: 'Never',
    permissions: 'Permissions',
    revoke: 'Revoke',
    revokeTitle: 'Revoke this token?',
    revokeText: 'This service will no longer be able to access JobTracker with this token.',
    cancel: 'Cancel',
    revoked_ok: 'Token revoked',
    revokeError: 'Unable to revoke this token.',
    createTitle: 'Create a token',
    createText: 'Name the service that will use this token so you can recognize it later.',
    nameLabel: 'Token name',
    namePlaceholder: 'ChatGPT watch',
    scopeLabel: 'Granted permission',
    createSubmit: 'Create token',
    createError: 'Unable to create the token.',
    secretTitle: 'Your new token',
    secretWarning: 'Copy this token now. For your security, it will not be shown again.',
    secretLabel: 'Agent token',
    copy: 'Copy',
    copied: 'Copied',
    copyError: 'Copy failed: select the token and copy it manually.',
    done: 'I have copied the token',
    prefixLabel: 'Prefix',
  },
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

/**
 * Affiche UNE fois le token brut. Le secret ne vit que dans le state du parent
 * et est effacé à la fermeture ; il n'est jamais écrit ailleurs (storage, URL, logs).
 */
const SecretDialog = ({ secret, onClose, t }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      toast.error(t.copyError);
    }
  };

  return (
    <Dialog open={!!secret} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="bg-[#0a0f1a] border-slate-800 text-white w-[calc(100%-2rem)] max-w-lg rounded-xl"
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="agent-token-secret-dialog"
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

        <div className="flex flex-col gap-3">
          <p id="agent-token-secret-label" className="text-xs text-slate-500">{t.secretLabel}</p>
          <code
            aria-labelledby="agent-token-secret-label"
            className="block w-full p-3 bg-slate-900 border border-gold/30 rounded-lg font-mono text-sm text-gold break-all select-all"
            data-testid="agent-token-secret"
          >
            {secret}
          </code>
          <Button
            type="button"
            onClick={handleCopy}
            className="w-full h-11 bg-gold hover:bg-gold-light text-[#020817] font-semibold"
            data-testid="agent-token-copy"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? t.copied : t.copy}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="w-full sm:w-auto h-10 border-slate-700" onClick={onClose}>
            {t.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreateTokenDialog = ({ isOpen, onClose, onCreate, t, language }) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) { setName(''); setError(''); setSubmitting(false); }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onCreate(name.trim());
    } catch (err) {
      setError(errorDetail(err, t.createError));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white w-[calc(100%-2rem)] max-w-md rounded-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader className="text-left pr-6">
            <DialogTitle className="font-heading text-lg">{t.createTitle}</DialogTitle>
            <DialogDescription className="text-slate-400">{t.createText}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-token-name" className="text-slate-300">{t.nameLabel}</Label>
            <Input
              id="agent-token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={100}
              required
              autoComplete="off"
              className="h-10 bg-slate-900/50 border-slate-700 text-white"
              aria-invalid={!!error}
              aria-describedby={error ? 'agent-token-create-error' : undefined}
              data-testid="agent-token-name"
            />
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-slate-300">{t.scopeLabel}</p>
            <p className="text-sm text-slate-400 flex items-center gap-2">
              <Check size={14} className="text-green-400" aria-hidden="true" />
              {SCOPE_LABELS['opportunities:create'][language]}
              <code className="text-xs text-slate-500">opportunities:create</code>
            </p>
          </div>

          {error && (
            <p id="agent-token-create-error" role="alert" className="text-sm text-red-400">{error}</p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="h-10" onClick={onClose} disabled={submitting}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              className="h-10 bg-gold hover:bg-gold-light text-[#020817] font-semibold"
              disabled={!name.trim() || submitting}
              aria-busy={submitting}
              data-testid="agent-token-create-submit"
            >
              {submitting && <Loader2 className="animate-spin" />}
              {t.createSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * `embedded` : rendu dans l'onglet « Tokens API » de la section API / Agents (titre porté
 * par le conteneur). Par défaut, rendu autonome inchangé.
 */
export const AgentTokensSection = ({ embedded = false } = {}) => {
  const { language } = useLanguage();
  const t = T[language];
  const { tokens, isLoading, isError, refetch, createToken, revokeToken } = useAgentTokens();

  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

  // Le secret ne vit que dans ce state local : effacé à la fermeture du dialog,
  // et détruit avec le composant en cas de navigation.
  const handleCreate = async (name) => {
    const created = await createToken(name);
    setCreateOpen(false);
    setSecret(created.token);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeToken.mutateAsync(revokeTarget.id);
      toast.success(t.revoked_ok);
    } catch (err) {
      toast.error(errorDetail(err, t.revokeError));
    } finally {
      setRevokeTarget(null);
    }
  };

  const sorted = [...tokens].sort((a, b) =>
    (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1) ||
    String(b.created_at).localeCompare(String(a.created_at))
  );

  return (
    <section data-testid="agent-tokens-section">
      {!embedded && (
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
          <Bot size={20} className="text-gold" aria-hidden="true" />
          {t.title}
        </h2>
      )}

      <div className="glass-card rounded-xl p-4 sm:p-6 border border-slate-800 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-slate-400 text-sm">{t.description}</p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-10 shrink-0 bg-gold hover:bg-gold-light text-[#020817] font-semibold"
            data-testid="agent-token-create"
          >
            <Plus />
            {t.create}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-500" aria-label="Chargement" /></div>
        ) : isError ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-red-500/30" role="alert">
            <p className="text-sm text-slate-300">{t.loadError}</p>
            <Button variant="outline" size="sm" className="border-slate-700" onClick={() => refetch()}>{t.retry}</Button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-slate-700 rounded-lg" data-testid="agent-tokens-empty">
            <KeyRound className="mx-auto mb-3 text-slate-500" aria-hidden="true" />
            <p className="text-white font-medium">{t.emptyTitle}</p>
            <p className="text-slate-400 text-sm mt-1">{t.emptyText}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="agent-tokens-list">
            {sorted.map(token => (
              <li
                key={token.id}
                className={`p-4 rounded-lg border ${token.is_active ? 'border-slate-700 bg-slate-900/40' : 'border-slate-800 bg-slate-900/20 opacity-70'}`}
                data-testid={`agent-token-${token.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-white font-medium break-words">{token.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${token.is_active
                        ? 'border-green-500/30 bg-green-500/10 text-green-400'
                        : 'border-slate-600 bg-slate-700/30 text-slate-400'}`}
                      >
                        {token.is_active ? t.active : t.revoked}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {t.prefixLabel} : <code className="font-mono text-slate-300">{token.token_prefix}…</code>
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.permissions} : {token.scopes.map(s => SCOPE_LABELS[s]?.[language] || s).join(', ')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.createdAt} {formatDate(token.created_at, language)}
                      {' · '}
                      {t.lastUsed} : {formatDate(token.last_used_at, language) || t.never}
                    </p>
                    {!token.is_active && token.revoked_at && (
                      <p className="text-xs text-slate-500">{t.revoked} : {formatDate(token.revoked_at, language)}</p>
                    )}
                  </div>
                  {token.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 sm:h-9 shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => setRevokeTarget(token)}
                      aria-label={`${t.revoke} : ${token.name}`}
                      data-testid={`agent-token-revoke-${token.id}`}
                    >
                      <Ban />
                      {t.revoke}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateTokenDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        t={t}
        language={language}
      />

      <SecretDialog secret={secret} onClose={() => setSecret(null)} t={t} />

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent className="bg-[#0a0f1a] border-slate-800 text-white w-[calc(100%-2rem)] max-w-md rounded-xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>{t.revokeTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {revokeTarget?.name && <strong className="text-white">{revokeTarget.name}</strong>}
              {revokeTarget?.name && ' — '}
              {t.revokeText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-10 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="h-10 bg-red-600 hover:bg-red-700 text-white"
              data-testid="agent-token-revoke-confirm"
            >
              {t.revoke}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
