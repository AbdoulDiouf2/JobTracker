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
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const SECRET = 'jt_ocs_' + 'TopSecretValueTopSecretValueTopSecret12';
const NEW_SECRET = 'jt_ocs_' + 'RotatedValueRotatedValueRotatedValue34';
const CLIENT_ID = 'jt_oc_AbCdEf123456';
const MCP_URL = 'https://jobtracker.maadec.com/api/mcp';
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';

const statusOf = (over = {}) => ({
  service: 'cut', mcp_enabled: true, kill_switch_active: true, production: true,
  keys: { mcp_enabled: true, production_allowed: true }, owner_watch_enabled: true, mcp_url: MCP_URL, ...over,
});
const clientOf = (over = {}) => ({
  client_id: CLIENT_ID, name: 'ChatGPT', redirect_uris: [REDIRECT], active: true,
  created_at: '2026-10-09T09:00:00+00:00', secret_rotated_at: '2026-10-09T09:00:00+00:00', active_grants: 1, ...over,
});
const grantOf = (over = {}) => ({
  id: 'grant-1', client_name: 'ChatGPT', client_id: CLIENT_ID, user_email: 'owner@test.local',
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

describe('Connexions OAuth / MCP — états', () => {
  test.each([
    [statusOf(), null, 'none'],
    [statusOf(), clientOf({ active: false }), 'disabled'],
    [statusOf({ service: 'unavailable', mcp_enabled: false }), clientOf(), 'unavailable'],
    [statusOf({ service: 'cut' }), clientOf(), 'configured'],
    [statusOf({ service: 'open', kill_switch_active: false }), clientOf(), 'active'],
  ])('connectionState %#', (status, client, expected) => {
    expect(connectionState(status, client)).toBe(expected);
  });

  test('client actif, service coupé : « Configuré » et valeurs pour ChatGPT', async () => {
    server.clients = [clientOf()];
    renderPanel();
    expect(await screen.findByTestId('oauth-state')).toHaveTextContent('Configuré');
    const values = screen.getByTestId('oauth-chatgpt-values');
    expect(within(values).getByTestId('oauth-mcp-url')).toHaveTextContent(MCP_URL);
    expect(within(values).getByTestId('oauth-client-id')).toHaveTextContent(CLIENT_ID);
    expect(values.textContent).not.toContain('jt_ocs_');
    expect(screen.getByTestId('oauth-redirect-list')).toHaveTextContent(REDIRECT);
    expect(screen.getByText('Fermé (service coupé)')).toBeInTheDocument();
  });

  test('déploiement non activé : « Indisponible » expliqué', async () => {
    server.status = statusOf({ service: 'unavailable', mcp_enabled: false });
    server.clients = [clientOf()];
    renderPanel();
    expect(await screen.findByTestId('oauth-state')).toHaveTextContent('Indisponible');
    expect(screen.getByText(/l'ouverture de l'interrupteur reste sans effet/)).toBeInTheDocument();
  });

  test('erreur de chargement lisible', async () => {
    api.get.mockRejectedValue(axiosError(500, 'x'));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger les connexions OAuth.');
  });
});

describe('Connexions OAuth / MCP — secret à usage unique', () => {
  test('création : client_id et secret affichés une fois, puis oubliés', async () => {
    const user = userEvent.setup();
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const consoleSpies = ['log', 'info', 'debug', 'warn', 'error'].map(m => jest.spyOn(console, m).mockImplementation(() => {}));
    api.post.mockImplementation(async (url) => {
      expect(url).toBe('/api/admin/oauth/clients');
      server.clients = [clientOf({ active_grants: 0 })];
      return { data: { client_id: CLIENT_ID, client_secret: SECRET, redirect_uris: [REDIRECT] } };
    });
    const { queryClient } = renderPanel();

    await user.click(await screen.findByTestId('oauth-create-client'));
    const dialog = await screen.findByTestId('oauth-secret-dialog');
    expect(within(dialog).getByTestId('oauth-secret-client-id')).toHaveTextContent(CLIENT_ID);
    expect(within(dialog).getByTestId('oauth-secret-value')).toHaveTextContent(SECRET);
    expect(within(dialog).getByText(/il ne sera plus jamais affiché/)).toBeInTheDocument();

    await user.click(within(dialog).getByTestId('oauth-secret-value-copy'));
    expect(await navigator.clipboard.readText()).toBe(SECRET);

    // Jamais dans le cache TanStack
    const cached = JSON.stringify([
      queryClient.getQueryCache().getAll().map(q => q.state.data),
      queryClient.getMutationCache().getAll().map(m => m.state.data),
    ]);
    expect(cached).not.toContain(SECRET);

    await user.click(within(dialog).getByTestId('oauth-secret-done'));
    await waitFor(() => expect(screen.queryByTestId('oauth-secret-dialog')).toBeNull());
    expect(await screen.findByTestId('oauth-client')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET);

    expect(setItem.mock.calls.some(args => args.join(' ').includes(SECRET))).toBe(false);
    consoleSpies.forEach(spy => {
      expect(spy.mock.calls.some(args => args.join(' ').includes(SECRET))).toBe(false);
      spy.mockRestore();
    });
    setItem.mockRestore();
  });

  test('création refusée (doublon) : message lisible, aucun secret', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(axiosError(409, 'Un client ChatGPT existe déjà : réactivez-le ou régénérez son secret'));
    renderPanel();
    await user.click(await screen.findByTestId('oauth-create-client'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Un client ChatGPT existe déjà : réactivez-le ou régénérez son secret'));
    expect(screen.queryByTestId('oauth-secret-dialog')).toBeNull();
  });

  test('régénération : confirmation, puis nouveau secret affiché une fois', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    api.post.mockResolvedValue({ data: { client_id: CLIENT_ID, client_secret: NEW_SECRET } });
    renderPanel();

    await user.click(await screen.findByTestId('oauth-rotate-secret'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent("L'ancien secret sera refusé immédiatement.");
    expect(api.post).not.toHaveBeenCalled();
    await user.click(within(confirm).getByTestId('oauth-confirm'));

    expect(api.post).toHaveBeenCalledWith(`/api/admin/oauth/clients/${CLIENT_ID}/rotate-secret`);
    const dialog = await screen.findByTestId('oauth-secret-dialog');
    expect(within(dialog).getByTestId('oauth-secret-value')).toHaveTextContent(NEW_SECRET);
    await user.click(within(dialog).getByTestId('oauth-secret-done'));
    await waitFor(() => expect(document.body.textContent).not.toContain(NEW_SECRET));
  });
});

describe('Connexions OAuth / MCP — gestion', () => {
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
    expect(await screen.findByTestId('oauth-state')).toHaveTextContent('Actif');
    await user.click(screen.getByTestId('oauth-cut-service'));
    await user.click(within(await screen.findByRole('alertdialog')).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/admin/settings/mcp-kill-switch', { active: true }));
  });

  test('ajout d\'une adresse de retour, erreur de validation affichée', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    api.post.mockRejectedValueOnce(axiosError(400, 'redirect_uri invalide : HTTPS obligatoire'));
    renderPanel();

    const input = await screen.findByTestId('oauth-redirect-input');
    await user.type(input, 'http://chatgpt.com/x');
    await user.click(screen.getByTestId('oauth-redirect-add'));
    expect(await screen.findByRole('alert')).toHaveTextContent('redirect_uri invalide : HTTPS obligatoire');

    const uri = 'https://chatgpt.com/connector/oauth/abc';
    api.post.mockImplementationOnce(async () => {
      server.clients = [clientOf({ redirect_uris: [REDIRECT, uri] })];
      return { data: { client_id: CLIENT_ID, redirect_uris: [REDIRECT, uri] } };
    });
    await user.clear(input);
    await user.type(input, uri);
    await user.click(screen.getByTestId('oauth-redirect-add'));
    expect(api.post).toHaveBeenLastCalledWith(`/api/admin/oauth/clients/${CLIENT_ID}/redirect-uris`, { redirect_uri: uri });
    await waitFor(() => expect(screen.getByTestId('oauth-redirect-list')).toHaveTextContent(uri));
  });

  test('désactivation : confirmation annonçant la révocation, puis réactivation', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf({ active_grants: 2 })];
    api.put.mockImplementation(async (url, body) => {
      server.clients = [clientOf({ active: body.active, active_grants: 0 })];
      return { data: { client: server.clients[0], revoked_grants: 2 } };
    });
    renderPanel();

    await user.click(await screen.findByTestId('oauth-deactivate'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Toutes ses connexions (2) et leurs jetons seront révoqués immédiatement.');
    await user.click(within(confirm).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/admin/oauth/clients/${CLIENT_ID}/active`, { active: false }));
    expect(await screen.findByTestId('oauth-state')).toHaveTextContent('Désactivé');

    await user.click(await screen.findByTestId('oauth-reactivate'));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith(`/api/admin/oauth/clients/${CLIENT_ID}/active`, { active: true }));
    expect(screen.queryByTestId('oauth-create-client')).toBeNull();
  });

  test('autorisations : consultation et révocation confirmée', async () => {
    const user = userEvent.setup();
    server.clients = [clientOf()];
    server.grants = [grantOf(), grantOf({ id: 'grant-2', status: 'revoked' })];
    api.delete.mockImplementation(async () => {
      server.grants = [grantOf({ status: 'revoked' }), grantOf({ id: 'grant-2', status: 'revoked' })];
      return { data: { revoked: true } };
    });
    renderPanel();

    const row = await screen.findByTestId('oauth-grant-grant-1');
    expect(row).toHaveTextContent('owner@test.local');
    expect(within(screen.getByTestId('oauth-grant-grant-2')).queryByRole('button')).toBeNull();

    await user.click(within(row).getByTestId('oauth-grant-revoke-grant-1'));
    await user.click(within(await screen.findByRole('alertdialog')).getByTestId('oauth-confirm'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/admin/oauth/grants/grant-1'));
    await waitFor(() => expect(within(screen.getByTestId('oauth-grant-grant-1')).queryByRole('button')).toBeNull());
    expect(toast.success).toHaveBeenCalledWith('Autorisation révoquée');
  });
});
