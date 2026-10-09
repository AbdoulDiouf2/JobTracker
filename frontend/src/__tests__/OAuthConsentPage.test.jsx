import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api, useAuth } from '../contexts/AuthContext';
import { navigateTo } from '../lib/oauthReturn';
import OAuthConsentPage from '../pages/OAuthConsentPage';
import { renderWithProviders, LocationDisplay, axiosError } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  useAuth: jest.fn(),
}));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));
jest.mock('../lib/oauthReturn', () => ({
  ...jest.requireActual('../lib/oauthReturn'),
  navigateTo: jest.fn(),
}));

const REQUEST_ID = 'req_ABCdef0123456789xyz';
const CONTINUE_URL = 'https://jobtracker.maadec.com/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC';

const details = (overrides = {}) => ({
  request_id: REQUEST_ID,
  client: { name: 'ChatGPT', redirect_domain: 'chatgpt.com' },
  scopes: [
    { scope: 'watch:read', description: 'Lire tes critères de veille, l\'état du service et un résumé de tes opportunités récentes' },
    { scope: 'opportunities:write', description: 'Ajouter de nouvelles opportunités (statut « nouveau ») et le compte-rendu de chaque veille' },
  ],
  account: { email: 'owner@jobtracker.test', name: 'Owner' },
  eligible: true,
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  ...overrides,
});

const renderPage = (requestId = REQUEST_ID) =>
  renderWithProviders(<OAuthConsentPage />, {
    route: `/oauth/consent?request=${requestId}`,
    path: '/oauth/consent',
    routes: [{ path: '/login', element: <LocationDisplay /> }],
  });

const httpError = (status, body) => {
  const error = new Error(`HTTP ${status}`);
  error.response = { status, data: body };
  return error;
};

const ORIGINAL_BACKEND = process.env.REACT_APP_BACKEND_URL;

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  useAuth.mockReturnValue({ isAuthenticated: true });
  process.env.REACT_APP_BACKEND_URL = 'https://jobtracker.maadec.com';
});

afterAll(() => {
  process.env.REACT_APP_BACKEND_URL = ORIGINAL_BACKEND;
});

describe('OAuthConsentPage — consentement réussi', () => {
  test('présente clairement la demande, le compte et les permissions', async () => {
    api.get.mockResolvedValue({ data: details() });
    renderPage();

    expect(screen.getByTestId('consent-loading')).toBeInTheDocument();
    const form = await screen.findByTestId('consent-form');
    expect(api.get).toHaveBeenCalledWith(`/api/oauth/requests/${REQUEST_ID}`);
    expect(within(form).getByRole('heading', { level: 1 })).toHaveTextContent('Autoriser ChatGPT');
    expect(screen.getByTestId('consent-lead')).toHaveTextContent(
      "ChatGPT demande l'autorisation d'accéder à ta veille d'opportunités JobTracker.",
    );
    expect(screen.getByTestId('consent-account')).toHaveTextContent('owner@jobtracker.test');
    expect(screen.getByTestId('consent-scope-watch:read')).toHaveTextContent(/critères de veille/);
    expect(screen.getByTestId('consent-scope-opportunities:write')).toHaveTextContent(/Ajouter de nouvelles opportunités/);
    expect(screen.getByText(/Lire ou modifier tes candidatures/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Autoriser' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Refuser' })).toBeEnabled();
  });

  test('Autoriser : envoie la décision puis suit l\'URL de continuation (aucun code dans la page)', async () => {
    api.get.mockResolvedValue({ data: details() });
    let resolvePost;
    api.post.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Autoriser' }));

    expect(api.post).toHaveBeenCalledWith('/api/oauth/consent', { request_id: REQUEST_ID, approve: true });
    expect(screen.getByRole('button', { name: /Autoriser/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refuser' })).toBeDisabled();

    resolvePost({ data: { continue_url: CONTINUE_URL } });
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(CONTINUE_URL));
    expect(document.body.innerHTML).not.toMatch(/ticket=|code=|access_token|refresh_token|client_secret/);
  });

  test('Refuser : envoie approve=false puis revient vers ChatGPT', async () => {
    api.get.mockResolvedValue({ data: details() });
    api.post.mockResolvedValue({ data: { continue_url: CONTINUE_URL } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Refuser' }));
    expect(api.post).toHaveBeenCalledWith('/api/oauth/consent', { request_id: REQUEST_ID, approve: false });
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(CONTINUE_URL));
  });

  test.each([
    ['autre domaine', 'https://evil.example/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC'],
    ['autre chemin', 'https://jobtracker.maadec.com/api/oauth/token?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC'],
    ['http distant', 'http://jobtracker.maadec.com/api/oauth/continue?ticket=Tk_abcdefghijklmnopqrstuvwxyz0123456789ABC'],
    ['javascript', 'javascript:alert(1)'],
    ['absente', undefined],
  ])('URL de continuation non sûre (%s) : aucune navigation', async (_, url) => {
    api.get.mockResolvedValue({ data: details() });
    api.post.mockResolvedValue({ data: { continue_url: url } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Autoriser' }));
    expect(await screen.findByTestId('consent-error-generic')).toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test('boutons empilés sur mobile, alignés sur écran large', async () => {
    api.get.mockResolvedValue({ data: details() });
    renderPage();
    const approve = await screen.findByTestId('consent-approve-button');
    expect(approve.className).toMatch(/w-full/);
    expect(approve.className).toMatch(/sm:w-auto/);
    expect(approve.parentElement.className).toMatch(/flex-col-reverse/);
    expect(approve.parentElement.className).toMatch(/sm:flex-row/);
  });
});

describe('OAuthConsentPage — utilisateur déconnecté', () => {
  test('demande la connexion, mémorise le retour et ne charge rien', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderPage();
    expect(screen.getByTestId('consent-login-required')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem('jt_oauth_return')).path).toBe(`/oauth/consent?request=${REQUEST_ID}`);
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });
});

describe('OAuthConsentPage — compte non autorisé', () => {
  test('explique le refus et permet de revenir à ChatGPT avec un refus', async () => {
    api.get.mockResolvedValue({ data: details({ eligible: false }) });
    api.post.mockResolvedValue({ data: { continue_url: CONTINUE_URL } });
    renderPage();
    expect(await screen.findByTestId('consent-not-eligible')).toHaveTextContent(/Compte non autorisé/);
    expect(screen.queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refuser et revenir à ChatGPT' }));
    expect(api.post).toHaveBeenCalledWith('/api/oauth/consent', { request_id: REQUEST_ID, approve: false });
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(CONTINUE_URL));
  });
});

describe('OAuthConsentPage — demandes inutilisables', () => {
  test.each([
    [410, { error: 'request_expired' }, 'consent-error-expired', /expiré/],
    [409, { error: 'request_already_used' }, 'consent-error-used', /déjà été prise/],
    [404, { error: 'request_not_found' }, 'consent-error-notFound', /n'est pas valide/],
    [500, {}, 'consent-error-generic', /n'a pas pu être traitée/],
  ])('chargement en %s : message adapté, aucun bouton de décision', async (status, body, testId, text) => {
    api.get.mockRejectedValue(httpError(status, body));
    renderPage();
    expect(await screen.findByTestId(testId)).toHaveTextContent(text);
    expect(screen.queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument();
  });

  test.each([
    ['request_expired', 'consent-error-expired'],
    ['request_already_used', 'consent-error-used'],
    ['request_not_found', 'consent-error-notFound'],
  ])('décision refusée par le serveur (%s) : message adapté, aucune navigation', async (code, testId) => {
    api.get.mockResolvedValue({ data: details() });
    api.post.mockRejectedValue(httpError(400, { error: code }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Autoriser' }));
    expect(await screen.findByTestId(testId)).toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test.each(['', 'court', 'avec espaces dedans!!!', '../../admin'])('lien invalide (%s) : aucun appel', (id) => {
    renderPage(encodeURIComponent(id));
    expect(screen.getByTestId('consent-not-found')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('jt_oauth_return')).toBeNull();
  });
});

describe('OAuthConsentPage — anti-clickjacking', () => {
  test('affichée dans un cadre : bloquée, sans aucun appel', () => {
    const topSpy = jest.spyOn(window, 'top', 'get').mockReturnValue({});
    try {
      renderPage();
      expect(screen.getByTestId('consent-framed')).toBeInTheDocument();
      expect(api.get).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument();
    } finally {
      topSpy.mockRestore();
    }
  });
});

test('axiosError reste disponible pour les autres suites', () => {
  expect(axiosError(400, 'x').response.status).toBe(400);
});

describe('OAuthConsentPage — client générique (P1.1)', () => {
  test('affiche le vrai nom du client et son domaine de retour, sans mention de ChatGPT', async () => {
    api.get.mockResolvedValue({ data: details({ client: { name: 'Agent MAADEC', redirect_domain: 'agent.maadec.com' } }) });
    api.post.mockResolvedValue({ data: { continue_url: CONTINUE_URL } });
    renderPage();
    const form = await screen.findByTestId('consent-form');
    expect(within(form).getByRole('heading', { level: 1 })).toHaveTextContent('Autoriser Agent MAADEC');
    expect(screen.getByTestId('consent-redirect-domain')).toHaveTextContent('agent.maadec.com');
    expect(screen.getByText('Ce que Agent MAADEC pourra faire')).toBeInTheDocument();
    expect(screen.getByText('Ce que Agent MAADEC ne pourra jamais faire')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ChatGPT/);
    await userEvent.click(screen.getByRole('button', { name: 'Autoriser' }));
    expect(await screen.findByText('Retour vers agent.maadec.com…')).toBeInTheDocument();
  });

  test('client sans nom : jamais « ChatGPT » en remplacement', async () => {
    api.get.mockResolvedValue({ data: details({ client: { name: '  ', redirect_domain: 'agent.maadec.com' } }) });
    renderPage();
    const form = await screen.findByTestId('consent-form');
    expect(within(form).getByRole('heading', { level: 1 })).toHaveTextContent('Autoriser Application non identifiée');
    expect(document.body.textContent).not.toMatch(/ChatGPT/);
  });

  test('sans domaine de retour vérifié : aucun formulaire de consentement', async () => {
    api.get.mockResolvedValue({ data: details({ client: { name: 'Agent MAADEC' } }) });
    renderPage();
    expect(await screen.findByTestId('consent-error-generic')).toBeInTheDocument();
    expect(screen.queryByTestId('consent-form')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Autoriser' })).toBeNull();
  });

  test('nom et domaine rendus comme du texte (aucune interprétation HTML)', async () => {
    const name = '<img src=x onerror="window.__pwned=1">Agent';
    api.get.mockResolvedValue({ data: details({ client: { name, redirect_domain: 'agent.maadec.com' } }) });
    renderPage();
    const form = await screen.findByTestId('consent-form');
    expect(within(form).getByRole('heading', { level: 1 })).toHaveTextContent(`Autoriser ${name}`);
    expect(document.querySelector('img')).toBeNull();
    expect(window.__pwned).toBeUndefined();
  });

  test('compte non éligible : retour proposé vers le vrai client', async () => {
    api.get.mockResolvedValue({ data: details({ eligible: false, client: { name: 'Agent MAADEC', redirect_domain: 'agent.maadec.com' } }) });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Refuser et revenir à Agent MAADEC' })).toBeInTheDocument();
    expect(screen.getByText(/La veille n'est pas activée pour ce compte/)).toBeInTheDocument();
  });
});

describe('OAuthConsentPage — application locale (P2.3)', () => {
  test('retour vers une adresse locale : avertissement explicite', async () => {
    api.get.mockResolvedValue({ data: details({ client: { name: 'Agent local', redirect_domain: '127.0.0.1', redirect_local: true } }) });
    renderPage();
    await screen.findByTestId('consent-form');
    expect(screen.getByTestId('consent-redirect-domain')).toHaveTextContent('127.0.0.1');
    expect(screen.getByTestId('consent-local-warning')).toHaveTextContent('Application installée sur cet appareil');
  });

  test('retour web : aucun avertissement local', async () => {
    api.get.mockResolvedValue({ data: details() });
    renderPage();
    await screen.findByTestId('consent-form');
    expect(screen.queryByTestId('consent-local-warning')).toBeNull();
  });
});
