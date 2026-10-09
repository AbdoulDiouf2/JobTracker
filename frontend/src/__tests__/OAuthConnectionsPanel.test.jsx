import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api, useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { ApiAgentsSection } from '../components/settings/ApiAgentsSection';
import { OAuthConnectionsPanel, connectionState } from '../components/settings/OAuthConnectionsPanel';
import { renderWithProviders, axiosError } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  useAuth: jest.fn(),
}));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));

const SECRET = 'jt_ocs_' + 'TopSecretValueTopSecretValueTopSecret12';
const NEW_SECRET = 'jt_ocs_' + 'RotatedValueRotatedValueRotatedValue34';
const GPT_ID = 'jt_oc_ChatGPT123456';
const AGENT_ID = 'jt_oc_Agent7890abcd';
const MCP_URL = 'https://jobtracker.maadec.com/api/mcp';
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';
const AGENT_REDIRECT = 'https://agent.maadec.com/oauth/callback';
const PRESETS = [{ key: 'chatgpt', name: 'ChatGPT', redirect_uris: [REDIRECT] }];

const statusOf = (over = {}) => ({
  service: 'cut', mcp_enabled: true, kill_switch_active: true, production: true,
  keys: { mcp_enabled: true, production_allowed: true }, owner_watch_enabled: true, mcp_url: MCP_URL,
  presets: PRESETS, ...over,
});
const clientOf = (over = {}) => ({
  client_id: GPT_ID, name: 'ChatGPT', redirect_uris: [REDIRECT], active: true,
  created_at: '2026-10-09T09:00:00+00:00', secret_rotated_at: '2026-10-09T09:00:00+00:00', active_grants: 1, ...over,
});
const agentOf = (over = {}) => clientOf({ client_id: AGENT_ID, name: 'Agent MAADEC', redirect_uris: [AGENT_REDIRECT],
  active_grants: 0, ...over });
const grantOf = (over = {}) => ({
  id: 'grant-1', client_name: 'ChatGPT', client_id: GPT_ID, user_email: 'owner@test.local',
  scopes: ['watch:read'], status: 'active', created_at: '2026-10-09T10:00:00+00:00',
  last_refresh_at: null, expires_at: '2027-01-07T10:00:00+00:00', alert: null, ...over,
});

let server;

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ isAdmin: true });
  server = { status: statusOf(), clients: [], grants: [], tokens: [] };
  api.get.mockImplementation((url) => {
    const data = {
      '/api/admin/oauth/status': server.status,
      '/api/admin/oauth/clients': { items: server.clients },
      '/api/admin/oauth/grants': { items: server.grants },
      '/api/agent-tokens': server.tokens,
    }[url];
    return data === undefined ? Promise.reject(new Error(url)) : Promise.resolve({ data });
  });
});

const renderPanel = () => renderWithProviders(<OAuthConnectionsPanel />);

// Collage plutôt que frappe caractère par caractère : rapide et stable sous charge
const fill = async (user, element, text) => {
  await user.click(element);
  await user.paste(text);
};

/** Carte repliée : région masquée et vide (Radix ne rend pas le contenu fermé). */
const expectCollapsed = (id) => {
  const region = screen.getByTestId(`oauth-client-details-${id}`);
  expect(region).toHaveAttribute('data-state', 'closed');
  expect(region).toHaveAttribute('hidden');
  expect(region).toBeEmptyDOMElement();
};

/** Déplie la carte d'un client (accordéon : contenu non rendu tant qu'elle est repliée). */
const expand = async (user, id) => {
  await user.click(await screen.findByTestId(`oauth-client-toggle-${id}`));
  return screen.findByTestId(`oauth-client-details-${id}`);
};

const openCreate = async (user) => {
  await user.click(await screen.findByTestId('oauth-add-client'));
  return screen.findByTestId('oauth-create-dialog');
};

describe('API / Agents — onglets', () => {
  test('utilisateur standard : section des tokens inchangée, aucun appel OAuth', async () => {
    useAuth.mockReturnValue({ isAdmin: false });
    renderWithProviders(<ApiAgentsSection />);
    expect(await screen.findByTestId('agent-token-create')).toHaveTextContent('Créer un token');
    expect(screen.getByRole('heading', { name: 'API / Agents' })).toBeInTheDocument();
    expect(screen.queryByTestId('api-agents-tab-oauth')).toBeNull();
    expect(api.get.mock.calls.some(([url]) => url.startsWith('/api/admin/oauth'))).toBe(false);
  });

  test('administrateur : deux espaces distincts, tokens par défaut', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiAgentsSection />);
    expect(screen.getAllByRole('heading', { name: 'API / Agents' })).toHaveLength(1);
    expect(await screen.findByTestId('agent-token-create')).toBeInTheDocument();
    await user.click(screen.getByTestId('api-agents-tab-oauth'));
    expect(await screen.findByTestId('oauth-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-token-create')).toBeNull();
  });
});

describe('Connexions OAuth / MCP — plusieurs clients', () => {
  test.each([
    [statusOf(), null, 'none'],
    [statusOf(), clientOf({ active: false }), 'disabled'],
    [statusOf({ service: 'unavailable', mcp_enabled: false }), clientOf(), 'unavailable'],
    [statusOf({ service: 'cut' }), clientOf(), 'configured'],
    [statusOf({ service: 'open', kill_switch_active: false }), clientOf(), 'active'],
  ])('connectionState %#', (status, client, expected) => {
    expect(connectionState(status, client)).toBe(expected);
  });

  test('affiche tous les clients, chacun avec son état, ses valeurs et ses adresses', async () => {
    const user = userEvent.setup();
    server.status = statusOf({ service: 'open', kill_switch_active: false });
    server.clients = [clientOf(), agentOf({ active: false })];
    renderPanel();
    expect(await screen.findByTestId('oauth-service-state')).toHaveTextContent('Service ouvert');

    const gpt = screen.getByTestId(`oauth-client-${GPT_ID}`);
    expect(within(gpt).getByTestId(`oauth-client-state-${GPT_ID}`)).toHaveTextContent('Actif');
    await expand(user, GPT_ID);
    expect(within(gpt).getByText('À saisir dans ChatGPT')).toBeInTheDocument();
    expect(within(gpt).getByTestId(`oauth-client-id-${GPT_ID}`)).toHaveTextContent(GPT_ID);
    expect(within(gpt).getByTestId(`oauth-mcp-url-${GPT_ID}`)).toHaveTextContent(MCP_URL);

    const agent = screen.getByTestId(`oauth-client-${AGENT_ID}`);
    expect(within(agent).getByTestId(`oauth-client-state-${AGENT_ID}`)).toHaveTextContent('Désactivé');
    await expand(user, AGENT_ID);
    expect(within(agent).getByText('À saisir dans Agent MAADEC')).toBeInTheDocument();
    expect(within(agent).getByTestId(`oauth-redirect-list-${AGENT_ID}`)).toHaveTextContent(AGENT_REDIRECT);
    expect(within(agent).getByTestId(`oauth-reactivate-${AGENT_ID}`)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('jt_ocs_');
  });

  test('aucun client : état vide et bouton d’ajout', async () => {
    renderPanel();
    expect(await screen.findByTestId('oauth-clients-empty')).toBeInTheDocument();
    expect(screen.getByTestId('oauth-add-client')).toBeEnabled();
  });

  test('déploiement non activé : service « Indisponible » expliqué', async () => {
    server.status = statusOf({ service: 'unavailable', mcp_enabled: false });
    server.clients = [clientOf()];
    renderPanel();
    expect(await screen.findByTestId('oauth-service-state')).toHaveTextContent('Service indisponible');
    expect(screen.getByTestId(`oauth-client-state-${GPT_ID}`)).toHaveTextContent('Indisponible');
    expect(screen.getByText(/l'ouverture de l'interrupteur reste sans effet/)).toBeInTheDocument();
  });

  test('nom de client rendu comme du texte', async () => {
    server.clients = [agentOf({ name: '<img src=x onerror="window.__p=1">Agent' })];
    renderPanel();
    expect(await screen.findByTestId(`oauth-client-name-${AGENT_ID}`)).toHaveTextContent('<img src=x');
    expect(document.querySelector('img')).toBeNull();
  });

  test('erreur de chargement lisible', async () => {
    api.get.mockRejectedValue(axiosError(500, 'x'));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger les connexions OAuth.');
  });
});

describe('Connexions OAuth / MCP — création', () => {
  test('client générique : nom + adresses, secret affiché une fois puis oublié', async () => {
    const user = userEvent.setup();
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const consoleSpies = ['log', 'info', 'debug', 'warn', 'error'].map(m => jest.spyOn(console, m).mockImplementation(() => {}));
    api.post.mockImplementation(async (url, body) => {
      server.clients = [agentOf()];
      return { data: { client_id: AGENT_ID, client_secret: SECRET, name: body.name, redirect_uris: body.redirect_uris, warnings: [] } };
    });
    const { queryClient } = renderPanel();

    const dialog = await openCreate(user);
    expect(within(dialog).getByTestId('oauth-create-submit')).toBeDisabled();
    await fill(user, within(dialog).getByTestId('oauth-client-name'), 'Agent MAADEC');
    // Espaces et lignes vides ignorés
    await fill(user, within(dialog).getByTestId('oauth-client-uris'), ` ${AGENT_REDIRECT} \n\nhttps://agent.maadec.com/cb2`);
    await user.click(within(dialog).getByTestId('oauth-create-submit'));
    expect(api.post).toHaveBeenCalledWith('/api/admin/oauth/clients',
      { name: 'Agent MAADEC', redirect_uris: [AGENT_REDIRECT, 'https://agent.maadec.com/cb2'],
        client_type: 'confidential', allowed_scopes: ['watch:read', 'opportunities:write'] });

    const secretDialog = await screen.findByTestId('oauth-secret-dialog');
    expect(within(secretDialog).getByText('Identifiants de Agent MAADEC')).toBeInTheDocument();
    expect(within(secretDialog).getByTestId('oauth-secret-client-id')).toHaveTextContent(AGENT_ID);
    expect(within(secretDialog).getByTestId('oauth-secret-value')).toHaveTextContent(SECRET);
    await user.click(within(secretDialog).getByTestId('oauth-secret-value-copy'));
    expect(await navigator.clipboard.readText()).toBe(SECRET);

    const cached = JSON.stringify([
      queryClient.getQueryCache().getAll().map(q => q.state.data),
      queryClient.getMutationCache().getAll().map(m => m.state.data),
    ]);
    expect(cached).not.toContain(SECRET);

    await user.click(within(secretDialog).getByTestId('oauth-secret-done'));
    await waitFor(() => expect(screen.queryByTestId('oauth-secret-dialog')).toBeNull());
    expect(await screen.findByTestId(`oauth-client-${AGENT_ID}`)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET);
    expect(setItem.mock.calls.some(args => args.join(' ').includes(SECRET))).toBe(false);
    consoleSpies.forEach(spy => {
      expect(spy.mock.calls.some(args => args.join(' ').includes(SECRET))).toBe(false);
      spy.mockRestore();
    });
    setItem.mockRestore();
  });

  test('préréglage ChatGPT facultatif : remplit le formulaire, désactivé si déjà configuré', async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await openCreate(user);
    await user.click(within(dialog).getByTestId('oauth-preset-chatgpt'));
    expect(within(dialog).getByTestId('oauth-client-name')).toHaveValue('ChatGPT');
    expect(within(dialog).getByTestId('oauth-client-uris')).toHaveValue(REDIRECT);
    expect(api.post).not.toHaveBeenCalled(); // un préréglage ne crée rien

    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(screen.queryByTestId('oauth-create-dialog')).toBeNull());
    expect(api.post).not.toHaveBeenCalled();
  });

  test('préréglage indisponible quand ChatGPT existe déjà', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    renderPanel();
    const dialog = await openCreate(user);
    expect(within(dialog).getByTestId('oauth-preset-chatgpt')).toBeDisabled();
    expect(within(dialog).getByTestId('oauth-preset-chatgpt')).toHaveTextContent('déjà configuré');
  });

  test('doublon de nom refusé : message lisible, aucun secret', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    api.post.mockRejectedValue(axiosError(409, 'Un client nommé « ChatGPT » existe déjà'));
    renderPanel();
    const dialog = await openCreate(user);
    await fill(user, within(dialog).getByTestId('oauth-client-name'), 'chatgpt');
    await fill(user, within(dialog).getByTestId('oauth-client-uris'), AGENT_REDIRECT);
    await user.click(within(dialog).getByTestId('oauth-create-submit'));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Un client nommé « ChatGPT » existe déjà');
    expect(screen.queryByTestId('oauth-secret-dialog')).toBeNull();
  });

  test('adresse de retour partagée : création acceptée et collision signalée', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    api.post.mockResolvedValue({ data: {
      client_id: AGENT_ID, client_secret: SECRET, name: 'ChatGPT pro', redirect_uris: [REDIRECT],
      warnings: [{ code: 'redirect_uri_shared', redirect_uri: REDIRECT, client_id: GPT_ID, client_name: 'ChatGPT' }],
    } });
    renderPanel();
    const dialog = await openCreate(user);
    await fill(user, within(dialog).getByTestId('oauth-client-name'), 'ChatGPT pro');
    await fill(user, within(dialog).getByTestId('oauth-client-uris'), REDIRECT);
    await user.click(within(dialog).getByTestId('oauth-create-submit'));
    await screen.findByTestId('oauth-secret-dialog');
    expect(toast.warning).toHaveBeenCalledWith(`Adresse ${REDIRECT} également utilisée par : ChatGPT.`);
  });
});

describe('Connexions OAuth / MCP — gestion individuelle', () => {
  test('régénération ciblée : confirmation nommée, nouveau secret affiché une fois', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), agentOf()];
    api.post.mockResolvedValue({ data: { client_id: AGENT_ID, client_secret: NEW_SECRET } });
    renderPanel();

    await expand(user, AGENT_ID);
    await user.click(await screen.findByTestId(`oauth-rotate-${AGENT_ID}`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Régénérer le secret de Agent MAADEC ?');
    expect(api.post).not.toHaveBeenCalled();
    await user.click(within(confirm).getByTestId('oauth-confirm'));

    expect(api.post).toHaveBeenCalledWith(`/api/admin/oauth/clients/${AGENT_ID}/rotate-secret`);
    const dialog = await screen.findByTestId('oauth-secret-dialog');
    expect(within(dialog).getByTestId('oauth-secret-value')).toHaveTextContent(NEW_SECRET);
    await user.click(within(dialog).getByTestId('oauth-secret-done'));
    await waitFor(() => expect(document.body.textContent).not.toContain(NEW_SECRET));
  });

  test('désactivation ciblée puis réactivation, sans toucher l’autre client', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), agentOf({ active_grants: 2 })];
    api.put.mockImplementation(async (url, body) => {
      server.clients = [clientOf(), agentOf({ active: body.active, active_grants: 0 })];
      return { data: { client: server.clients[1], revoked_grants: 2 } };
    });
    renderPanel();

    await expand(user, AGENT_ID);
    await user.click(await screen.findByTestId(`oauth-deactivate-${AGENT_ID}`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Désactiver Agent MAADEC ?');
    expect(confirm).toHaveTextContent('Toutes ses connexions (2)');
    expect(confirm).toHaveTextContent('Les autres applications ne sont pas affectées.');
    await user.click(within(confirm).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/admin/oauth/clients/${AGENT_ID}/active`, { active: false }));
    expect(await screen.findByTestId(`oauth-reactivate-${AGENT_ID}`)).toBeInTheDocument();
    // La carte reste ouverte après l'action ; l'autre client n'est pas touché
    expect(screen.getByTestId(`oauth-client-state-${GPT_ID}`)).toHaveTextContent('Configuré');

    await user.click(screen.getByTestId(`oauth-reactivate-${AGENT_ID}`));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith(`/api/admin/oauth/clients/${AGENT_ID}/active`, { active: true }));
  });

  test('ajout d’adresse de retour par client, erreur et collision affichées', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), agentOf()];
    api.post.mockRejectedValueOnce(axiosError(400, 'redirect_uri invalide : HTTPS obligatoire'));
    renderPanel();

    await expand(user, AGENT_ID);
    const input = await screen.findByTestId(`oauth-redirect-input-${AGENT_ID}`);
    await user.type(input, 'http://agent.maadec.com/x');
    await user.click(screen.getByTestId(`oauth-redirect-add-${AGENT_ID}`));
    expect(await screen.findByRole('alert')).toHaveTextContent('redirect_uri invalide : HTTPS obligatoire');

    api.post.mockImplementationOnce(async () => {
      server.clients = [clientOf(), agentOf({ redirect_uris: [AGENT_REDIRECT, REDIRECT] })];
      return { data: { client_id: AGENT_ID, redirect_uris: [AGENT_REDIRECT, REDIRECT],
        warnings: [{ code: 'redirect_uri_shared', redirect_uri: REDIRECT, client_id: GPT_ID, client_name: 'ChatGPT' }] } };
    });
    await user.clear(input);
    await user.type(input, REDIRECT);
    await user.click(screen.getByTestId(`oauth-redirect-add-${AGENT_ID}`));
    expect(api.post).toHaveBeenLastCalledWith(`/api/admin/oauth/clients/${AGENT_ID}/redirect-uris`, { redirect_uri: REDIRECT });
    await waitFor(() => expect(screen.getByTestId(`oauth-redirect-list-${AGENT_ID}`)).toHaveTextContent(REDIRECT));
    expect(toast.warning).toHaveBeenCalledWith(`Adresse ${REDIRECT} également utilisée par : ChatGPT.`);
  });

  test('ouvrir le service exige une confirmation explicite qui écarte tout accès anonyme', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    api.put.mockResolvedValue({ data: { active: false } });
    renderPanel();

    await user.click(await screen.findByTestId('oauth-open-service'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('pour les clients autorisés uniquement');
    expect(confirm).toHaveTextContent("aucun accès anonyme n'est ouvert");
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(api.put).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('oauth-open-service'));
    await user.click(within(await screen.findByRole('alertdialog')).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/admin/settings/mcp-kill-switch', { active: false }));
    expect(toast.success).toHaveBeenCalledWith('Service ouvert');
  });

  test('couper le service (ouvert) après confirmation', async () => {
    const user = userEvent.setup();
    server.status = statusOf({ service: 'open', kill_switch_active: false });
    server.clients = [clientOf()];
    api.put.mockResolvedValue({ data: { active: true } });
    renderPanel();
    await user.click(await screen.findByTestId('oauth-cut-service'));
    await user.click(within(await screen.findByRole('alertdialog')).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/admin/settings/mcp-kill-switch', { active: true }));
  });

  test('autorisations de plusieurs clients : révocation ciblée et confirmée', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), agentOf()];
    server.grants = [grantOf(), grantOf({ id: 'grant-2', client_name: 'Agent MAADEC', client_id: AGENT_ID })];
    api.delete.mockImplementation(async () => {
      server.grants = [grantOf(), grantOf({ id: 'grant-2', client_name: 'Agent MAADEC', client_id: AGENT_ID, status: 'revoked' })];
      return { data: { revoked: true } };
    });
    renderPanel();

    const row = await screen.findByTestId('oauth-grant-grant-2');
    expect(row).toHaveTextContent('Agent MAADEC');
    await user.click(within(row).getByTestId('oauth-grant-revoke-grant-2'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Agent MAADEC perdra immédiatement cet accès');
    await user.click(within(confirm).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/admin/oauth/grants/grant-2'));
    await waitFor(() => expect(within(screen.getByTestId('oauth-grant-grant-2')).queryByRole('button')).toBeNull());
    expect(within(screen.getByTestId('oauth-grant-grant-1')).getByRole('button')).toBeInTheDocument();
  });
});

describe('Connexions OAuth / MCP — clients publics et permissions (P2)', () => {
  const LOCAL = 'http://127.0.0.1/callback';
  const PUB_ID = 'jt_oc_Public123456';
  const publicOf = (over = {}) => clientOf({ client_id: PUB_ID, name: 'Agent local', redirect_uris: [LOCAL],
    client_type: 'public', allowed_scopes: ['watch:read'], token_endpoint_auth_method: 'none', active_grants: 0, ...over });

  test('création d’une application publique : type, permissions, aucun secret affiché', async () => {
    const user = userEvent.setup();
    api.post.mockImplementation(async (url, body) => {
      server.clients = [publicOf()];
      return { data: { client_id: PUB_ID, client_secret: null, name: body.name, client_type: 'public',
        allowed_scopes: body.allowed_scopes, redirect_uris: body.redirect_uris, warnings: [] } };
    });
    renderPanel();
    const dialog = await openCreate(user);
    await user.click(within(dialog).getByTestId('oauth-client-type-public'));
    expect(within(dialog).getByTestId('oauth-client-type-public')).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByTestId('oauth-client-type-help')).toHaveTextContent('aucun secret');
    expect(within(dialog).getByText(/http:\/\/127\.0\.0\.1\/<chemin>/)).toBeInTheDocument();
    await fill(user, within(dialog).getByTestId('oauth-client-name'), 'Agent local');
    await fill(user, within(dialog).getByTestId('oauth-client-uris'), LOCAL);
    // Retirer l'écriture : lecture seule
    await user.click(within(dialog).getByTestId('oauth-create-scope-opportunities:write'));
    await user.click(within(dialog).getByTestId('oauth-create-submit'));
    expect(api.post).toHaveBeenCalledWith('/api/admin/oauth/clients',
      { name: 'Agent local', redirect_uris: [LOCAL], client_type: 'public', allowed_scopes: ['watch:read'] });
    const created = await screen.findByTestId('oauth-secret-dialog');
    expect(within(created).getByTestId('oauth-public-created')).toHaveTextContent("il n'y a aucun secret");
    expect(within(created).getByTestId('oauth-secret-client-id')).toHaveTextContent(PUB_ID);
    expect(within(created).queryByTestId('oauth-secret-value')).toBeNull();
  });

  test('au moins une permission requise à la création', async () => {
    const user = userEvent.setup();
    renderPanel();
    const dialog = await openCreate(user);
    await fill(user, within(dialog).getByTestId('oauth-client-name'), 'X');
    await fill(user, within(dialog).getByTestId('oauth-client-uris'), AGENT_REDIRECT);
    await user.click(within(dialog).getByTestId('oauth-create-scope-watch:read'));
    await user.click(within(dialog).getByTestId('oauth-create-scope-opportunities:write'));
    expect(within(dialog).getByText('Choisissez au moins une permission.')).toBeInTheDocument();
    expect(within(dialog).getByTestId('oauth-create-submit')).toBeDisabled();
  });

  test('carte d’un client public : badge, pas de secret ni de régénération', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), publicOf()];
    renderPanel();
    const card = await screen.findByTestId(`oauth-client-${PUB_ID}`);
    expect(within(card).getByTestId(`oauth-client-type-${PUB_ID}`)).toHaveTextContent('Public');
    await expand(user, PUB_ID);
    expect(within(card).getByText(/Application publique : aucun secret/)).toBeInTheDocument();
    expect(within(card).getByText(/aucune \(client public\)/)).toBeInTheDocument();
    expect(within(card).queryByTestId(`oauth-rotate-${PUB_ID}`)).toBeNull();
    await expand(user, GPT_ID);
    expect(screen.getByTestId(`oauth-rotate-${GPT_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`oauth-client-type-${GPT_ID}`)).toHaveTextContent('Confidentiel');
  });

  test('modification des permissions d’un client existant', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    api.put.mockImplementation(async (url, body) => {
      server.clients = [clientOf({ allowed_scopes: body.allowed_scopes })];
      return { data: { client: server.clients[0] } };
    });
    renderPanel();
    await expand(user, GPT_ID);
    const scopes = await screen.findByTestId(`oauth-scopes-${GPT_ID}`);
    expect(within(scopes).queryByTestId(`oauth-scopes-save-${GPT_ID}`)).toBeNull();
    await user.click(within(scopes).getByTestId(`oauth-${GPT_ID}-scope-opportunities:write`));
    await user.click(within(scopes).getByTestId(`oauth-scopes-save-${GPT_ID}`));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/admin/oauth/clients/${GPT_ID}/scopes`,
      { allowed_scopes: ['watch:read'] }));
    expect(toast.success).toHaveBeenCalledWith('Permissions mises à jour');
  });

  test('retrait confirmé d’une adresse de retour ; la dernière ne peut pas être retirée', async () => {
    const user = userEvent.setup();
    server.clients = [publicOf({ redirect_uris: [LOCAL, 'http://[::1]/cb'] })];
    api.delete.mockImplementation(async () => {
      server.clients = [publicOf({ redirect_uris: ['http://[::1]/cb'] })];
      return { data: { client_id: PUB_ID, redirect_uris: ['http://[::1]/cb'] } };
    });
    renderPanel();
    await expand(user, PUB_ID);
    await user.click(await screen.findByTestId(`oauth-redirect-remove-${PUB_ID}-${LOCAL}`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('ne pourra plus servir à se connecter');
    await user.click(within(confirm).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/api/admin/oauth/clients/${PUB_ID}/redirect-uris`,
      { params: { redirect_uri: LOCAL } }));
    await waitFor(() => expect(screen.getByTestId(`oauth-redirect-remove-${PUB_ID}-http://[::1]/cb`)).toBeDisabled());
  });

  test('préréglage : type et permissions repris', async () => {
    const user = userEvent.setup();
    server.status = statusOf({ presets: [{ ...PRESETS[0], client_type: 'confidential', allowed_scopes: ['watch:read', 'opportunities:write'] }] });
    renderPanel();
    const dialog = await openCreate(user);
    await user.click(within(dialog).getByTestId('oauth-client-type-public'));
    await user.click(within(dialog).getByTestId('oauth-preset-chatgpt'));
    expect(within(dialog).getByTestId('oauth-client-type-confidential')).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByTestId('oauth-create-scope-opportunities:write')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Connexions OAuth / MCP — accordéon des applications', () => {
  const PUB_ID = 'jt_oc_Public123456';
  const publicOf = () => clientOf({ client_id: PUB_ID, name: 'Agent local', redirect_uris: ['http://127.0.0.1/callback'],
    client_type: 'public', allowed_scopes: ['watch:read'], active_grants: 3 });

  test('cartes compactes repliées par défaut : nom, statut, type et connexions visibles', async () => {
    server.clients = [clientOf(), agentOf(), publicOf()];
    renderPanel();
    for (const [id, name, type, count] of [[GPT_ID, 'ChatGPT', 'Confidentiel', '1'], [AGENT_ID, 'Agent MAADEC', 'Confidentiel', '0'],
      [PUB_ID, 'Agent local', 'Public', '3']]) {
      const toggle = await screen.findByTestId(`oauth-client-toggle-${id}`);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle.tagName).toBe('BUTTON');
      expect(toggle).toHaveTextContent(name);
      expect(within(toggle).getByTestId(`oauth-client-type-${id}`)).toHaveTextContent(type);
      expect(within(toggle).getByTestId(`oauth-client-state-${id}`)).toHaveTextContent('Configuré');
      expect(within(toggle).getByTestId(`oauth-client-connections-${id}`)).toHaveTextContent(`${count} connexion(s) active(s)`);
      expectCollapsed(id);
    }
    // Intitulé accessible explicite
    expect(screen.getByRole('button', { name: /ChatGPT.*afficher ou masquer les détails de l'application/ })).toBeInTheDocument();
  });

  test('ouverture, fermeture au second clic, une seule carte ouverte à la fois', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), agentOf()];
    renderPanel();
    const gptToggle = await screen.findByTestId(`oauth-client-toggle-${GPT_ID}`);
    const agentToggle = screen.getByTestId(`oauth-client-toggle-${AGENT_ID}`);

    await user.click(gptToggle);
    expect(gptToggle).toHaveAttribute('aria-expanded', 'true');
    const details = await screen.findByTestId(`oauth-client-details-${GPT_ID}`);
    expect(gptToggle).toHaveAttribute('aria-controls', details.id);

    // Changement de carte : la première se replie
    await user.click(agentToggle);
    expect(agentToggle).toHaveAttribute('aria-expanded', 'true');
    expect(gptToggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expectCollapsed(GPT_ID));
    expect(screen.getByTestId(`oauth-client-details-${AGENT_ID}`)).toHaveAttribute('data-state', 'open');
    expect(screen.getByTestId(`oauth-values-${AGENT_ID}`)).toBeInTheDocument();

    // Second clic : repliée
    await user.click(agentToggle);
    expect(agentToggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expectCollapsed(AGENT_ID));
  });

  test('clavier : Entrée et Espace ouvrent et ferment', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), agentOf()];
    renderPanel();
    const gptToggle = await screen.findByTestId(`oauth-client-toggle-${GPT_ID}`);
    gptToggle.focus();
    await user.keyboard('{Enter}');
    expect(gptToggle).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(gptToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('partie dépliée : tous les champs et actions restent disponibles, avec confirmations', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    renderPanel();
    const details = await expand(user, GPT_ID);
    for (const testId of [`oauth-values-${GPT_ID}`, `oauth-client-id-${GPT_ID}`, `oauth-mcp-url-${GPT_ID}`,
      `oauth-redirect-list-${GPT_ID}`, `oauth-redirect-input-${GPT_ID}`, `oauth-scopes-${GPT_ID}`,
      `oauth-rotate-${GPT_ID}`, `oauth-deactivate-${GPT_ID}`]) {
      expect(within(details).getByTestId(testId)).toBeInTheDocument();
    }
    // Les actions sensibles gardent leur confirmation
    await user.click(within(details).getByTestId(`oauth-deactivate-${GPT_ID}`));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Désactiver ChatGPT ?');
    expect(api.put).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Annuler' }));
    await user.click(within(details).getByTestId(`oauth-rotate-${GPT_ID}`));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Régénérer le secret de ChatGPT ?');
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('Connexions OAuth / MCP — identité publiée (P3, CIMD)', () => {
  const CC = 'https://claude.ai/oauth/claude-code-client-metadata';
  const cimdClient = clientOf({ client_id: CC, name: 'Claude Code', client_type: 'public', registration: 'cimd',
    metadata_host: 'claude.ai', metadata_fetched_at: '2026-10-10T08:00:00+00:00', allowed_scopes: ['watch:read'],
    redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'], active_grants: 1 });
  let policy;

  beforeEach(() => {
    policy = { enabled: false, allowed_hosts: [], default_scopes: ['watch:read'], operational: false };
    const base = api.get.getMockImplementation();
    api.get.mockImplementation((url) => (url === '/api/admin/oauth/cimd-policy'
      ? Promise.resolve({ data: policy }) : base(url)));
  });

  test('politique désactivée par défaut, activation confirmée avec domaines vérifiés', async () => {
    const user = userEvent.setup();
    api.put.mockImplementation(async (url, body) => {
      policy = { ...body, operational: true };
      return { data: policy };
    });
    renderPanel();
    const card = await screen.findByTestId('oauth-cimd');
    expect(within(card).getByTestId('oauth-cimd-state')).toHaveTextContent('Désactivé');
    expect(within(card).getByTestId('oauth-cimd-enabled')).toHaveAttribute('aria-checked', 'false');
    await user.click(within(card).getByTestId('oauth-cimd-enabled'));
    expect(within(card).getByText('Ajoute au moins un domaine pour activer.')).toBeInTheDocument();
    await user.click(within(card).getByTestId('oauth-cimd-suggest-claude.ai'));
    await user.click(within(card).getByTestId('oauth-cimd-suggest-vscode.dev'));
    expect(within(card).getByTestId('oauth-cimd-suggest-claude.ai')).toBeDisabled();
    await user.click(within(card).getByTestId('oauth-cimd-save'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('2 domaine(s) approuvé(s)');
    expect(confirm).toHaveTextContent('consentement explicite');
    expect(api.put).not.toHaveBeenCalled();
    await user.click(within(confirm).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/admin/oauth/cimd-policy',
      { enabled: true, allowed_hosts: ['claude.ai', 'vscode.dev'], default_scopes: ['watch:read'] }));
    expect(toast.success).toHaveBeenCalledWith('Politique enregistrée');
    await waitFor(() => expect(screen.getByTestId('oauth-cimd-state')).toHaveTextContent('Actif'));
  });

  test('désactivation : confirmation expliquant que les connexions existantes restent', async () => {
    const user = userEvent.setup();
    policy = { enabled: true, allowed_hosts: ['claude.ai'], default_scopes: ['watch:read'], operational: true };
    renderPanel();
    const card = await screen.findByTestId('oauth-cimd');
    await waitFor(() => expect(within(card).getByTestId('oauth-cimd-hosts')).toHaveValue('claude.ai'));
    await user.click(within(card).getByTestId('oauth-cimd-enabled'));
    await user.click(within(card).getByTestId('oauth-cimd-save'));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Les connexions existantes restent actives');
  });

  test('carte d’un client CIMD : badge, éditeur, adresses non modifiables, pas de secret', async () => {
    const user = userEvent.setup();
    server.clients = [cimdClient];
    renderPanel();
    expect(await screen.findByTestId(`oauth-client-cimd-${CC}`)).toHaveTextContent('Identité publiée');
    const details = await expand(user, CC);
    expect(details).toHaveTextContent('Identité publiée par claude.ai');
    expect(details).toHaveTextContent("Adresses fournies par le document de l'éditeur");
    expect(within(details).getByTestId(`oauth-redirect-list-${CC}`)).toHaveTextContent('http://localhost/callback');
    expect(within(details).queryByTestId(`oauth-redirect-input-${CC}`)).toBeNull();
    expect(within(details).queryByRole('button', { name: /Retirer l'adresse/ })).toBeNull();
    expect(within(details).queryByTestId(`oauth-rotate-${CC}`)).toBeNull();
    // Permissions et désactivation restent disponibles
    expect(within(details).getByTestId(`oauth-scopes-${CC}`)).toBeInTheDocument();
    await user.click(within(details).getByTestId(`oauth-deactivate-${CC}`));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Désactiver Claude Code ?');
  });
});
