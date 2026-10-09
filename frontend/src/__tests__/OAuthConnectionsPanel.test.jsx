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
    server.status = statusOf({ service: 'open', kill_switch_active: false });
    server.clients = [clientOf(), agentOf({ active: false })];
    renderPanel();
    expect(await screen.findByTestId('oauth-service-state')).toHaveTextContent('Service ouvert');

    const gpt = screen.getByTestId(`oauth-client-${GPT_ID}`);
    expect(within(gpt).getByTestId(`oauth-client-state-${GPT_ID}`)).toHaveTextContent('Actif');
    expect(within(gpt).getByText('À saisir dans ChatGPT')).toBeInTheDocument();
    expect(within(gpt).getByTestId(`oauth-client-id-${GPT_ID}`)).toHaveTextContent(GPT_ID);
    expect(within(gpt).getByTestId(`oauth-mcp-url-${GPT_ID}`)).toHaveTextContent(MCP_URL);

    const agent = screen.getByTestId(`oauth-client-${AGENT_ID}`);
    expect(within(agent).getByTestId(`oauth-client-state-${AGENT_ID}`)).toHaveTextContent('Désactivé');
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
      { name: 'Agent MAADEC', redirect_uris: [AGENT_REDIRECT, 'https://agent.maadec.com/cb2'] });

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

    await user.click(await screen.findByTestId(`oauth-deactivate-${AGENT_ID}`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Désactiver Agent MAADEC ?');
    expect(confirm).toHaveTextContent('Toutes ses connexions (2)');
    expect(confirm).toHaveTextContent('Les autres applications ne sont pas affectées.');
    await user.click(within(confirm).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/admin/oauth/clients/${AGENT_ID}/active`, { active: false }));
    expect(await screen.findByTestId(`oauth-reactivate-${AGENT_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`oauth-deactivate-${GPT_ID}`)).toBeInTheDocument();

    await user.click(screen.getByTestId(`oauth-reactivate-${AGENT_ID}`));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith(`/api/admin/oauth/clients/${AGENT_ID}/active`, { active: true }));
  });

  test('ajout d’adresse de retour par client, erreur et collision affichées', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf(), agentOf()];
    api.post.mockRejectedValueOnce(axiosError(400, 'redirect_uri invalide : HTTPS obligatoire'));
    renderPanel();

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
