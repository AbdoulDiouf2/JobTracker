import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { AgentTokensSection } from '../components/settings/AgentTokensSection';
import { renderWithProviders, axiosError } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const RAW_TOKEN = 'jt_agent_' + 'S3cr3tS3cr3tS3cr3tS3cr3tS3cr3tS3cr3tS3cr3tA'.slice(0, 43);

const token = (overrides = {}) => ({
  id: 'tok-1',
  name: 'Veille ChatGPT',
  token_prefix: 'jt_agent_S3cr',
  scopes: ['opportunities:create'],
  created_at: '2026-10-01T09:00:00+00:00',
  last_used_at: null,
  revoked_at: null,
  is_active: true,
  ...overrides,
});

let tokensOnServer;

beforeEach(() => {
  jest.clearAllMocks();
  tokensOnServer = [];
  api.get.mockImplementation((url) =>
    url === '/api/agent-tokens' ? Promise.resolve({ data: tokensOnServer }) : Promise.reject(new Error(url))
  );
});

const renderSection = () => renderWithProviders(<AgentTokensSection />);

describe('AgentTokensSection — liste', () => {
  test('affiche les tokens sans jamais de secret ni de hash', async () => {
    tokensOnServer = [
      token(),
      token({
        id: 'tok-2', name: 'Ancien agent', token_prefix: 'jt_agent_Old1', is_active: false,
        revoked_at: '2026-10-02T10:00:00+00:00', last_used_at: '2026-10-01T12:00:00+00:00',
        token_hash: 'deadbeef-should-never-render',
      }),
    ];
    renderSection();

    const active = await screen.findByTestId('agent-token-tok-1');
    expect(within(active).getByText('Veille ChatGPT')).toBeInTheDocument();
    expect(within(active).getByText('jt_agent_S3cr…')).toBeInTheDocument();
    expect(within(active).getByText(/Ajouter des opportunités/)).toBeInTheDocument();
    expect(within(active).getByText('Actif')).toBeInTheDocument();
    expect(within(active).getByText(/Jamais/)).toBeInTheDocument();
    expect(within(active).getByRole('button', { name: 'Révoquer : Veille ChatGPT' })).toBeInTheDocument();

    const revoked = screen.getByTestId('agent-token-tok-2');
    expect(within(revoked).getAllByText(/Révoqué/).length).toBeGreaterThan(0);
    expect(within(revoked).queryByRole('button', { name: /Révoquer/ })).toBeNull();

    expect(document.body.textContent).not.toContain('deadbeef');
  });

  test('état vide', async () => {
    renderSection();
    expect(await screen.findByText('Aucun accès externe configuré')).toBeInTheDocument();
    expect(screen.getByText('Créez un token pour autoriser un service externe à ajouter des opportunités.')).toBeInTheDocument();
  });
});

describe('AgentTokensSection — création', () => {
  const createToken = async (user) => {
    await user.click(await screen.findByTestId('agent-token-create'));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nom du token'), 'Veille ChatGPT');
    await user.click(within(dialog).getByTestId('agent-token-create-submit'));
  };

  test('affiche le token une seule fois, copiable, puis l’oublie', async () => {
    const user = userEvent.setup();
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const consoleSpies = ['log', 'info', 'debug', 'warn'].map(m => jest.spyOn(console, m).mockImplementation(() => {}));
    api.post.mockImplementation(async () => {
      tokensOnServer = [token()];
      return { data: { ...token(), token: RAW_TOKEN } };
    });
    renderSection();

    await createToken(user);
    expect(api.post).toHaveBeenCalledWith('/api/agent-tokens', { name: 'Veille ChatGPT', scopes: ['opportunities:create'] });

    const secretDialog = await screen.findByTestId('agent-token-secret-dialog');
    expect(within(secretDialog).getByTestId('agent-token-secret')).toHaveTextContent(RAW_TOKEN);
    expect(within(secretDialog).getByText('Copiez ce token maintenant. Pour votre sécurité, il ne sera plus affiché.')).toBeInTheDocument();

    // Copier
    await user.click(within(secretDialog).getByTestId('agent-token-copy'));
    expect(await navigator.clipboard.readText()).toBe(RAW_TOKEN);
    expect(within(secretDialog).getByTestId('agent-token-copy')).toHaveTextContent('Copié');

    // Fermer : le secret disparaît et ne réapparaît pas
    await user.click(within(secretDialog).getByRole('button', { name: "J'ai copié le token" }));
    await waitFor(() => expect(screen.queryByTestId('agent-token-secret-dialog')).toBeNull());
    expect(document.body.textContent).not.toContain(RAW_TOKEN);
    expect(await screen.findByTestId('agent-token-tok-1')).toHaveTextContent('jt_agent_S3cr…');
    expect(document.body.textContent).not.toContain(RAW_TOKEN);

    // Jamais persisté ni journalisé
    expect(setItem.mock.calls.some(args => args.join(' ').includes(RAW_TOKEN))).toBe(false);
    consoleSpies.forEach(spy => {
      expect(spy.mock.calls.some(args => args.join(' ').includes(RAW_TOKEN))).toBe(false);
      spy.mockRestore();
    });
    setItem.mockRestore();
  });

  test('le token n’entre jamais dans le cache TanStack', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { ...token(), token: RAW_TOKEN } });
    const { queryClient } = renderSection();

    await createToken(user);
    await screen.findByTestId('agent-token-secret-dialog');

    const cached = JSON.stringify([
      queryClient.getQueryCache().getAll().map(q => q.state.data),
      queryClient.getMutationCache().getAll().map(m => m.state.data),
    ]);
    expect(cached).not.toContain(RAW_TOKEN);
  });

  test('un clic hors du dialog du secret ne le ferme pas', async () => {
    // Radix pose pointer-events:none sur le body (modal) : on simule tout de même le clic extérieur
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    api.post.mockResolvedValue({ data: { ...token(), token: RAW_TOKEN } });
    renderSection();
    await createToken(user);
    await screen.findByTestId('agent-token-secret-dialog');

    await user.click(document.body);
    expect(screen.getByTestId('agent-token-secret-dialog')).toBeInTheDocument();
  });

  test('erreur de création lisible (ex: limite atteinte)', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(axiosError(409, 'Nombre maximum de tokens actifs atteint (10)'));
    renderSection();
    await createToken(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Nombre maximum de tokens actifs atteint (10)');
    expect(screen.queryByTestId('agent-token-secret-dialog')).toBeNull();
  });

  test('bouton de création désactivé sans nom', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByTestId('agent-token-create'));
    expect(await screen.findByTestId('agent-token-create-submit')).toBeDisabled();
  });
});

describe('AgentTokensSection — révocation', () => {
  test('confirme puis révoque et rafraîchit la liste', async () => {
    const user = userEvent.setup();
    tokensOnServer = [token()];
    api.delete.mockImplementation(async () => {
      tokensOnServer = [token({ is_active: false, revoked_at: '2026-10-07T10:00:00+00:00' })];
      return { data: tokensOnServer[0] };
    });
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Révoquer : Veille ChatGPT' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/Ce service ne pourra plus accéder à JobTracker avec ce token\./)).toBeInTheDocument();

    await user.click(within(confirm).getByTestId('agent-token-revoke-confirm'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/agent-tokens/tok-1'));
    await waitFor(() =>
      expect(within(screen.getByTestId('agent-token-tok-1')).queryByRole('button', { name: /Révoquer/ })).toBeNull()
    );
    expect(toast.success).toHaveBeenCalledWith('Token révoqué');
  });

  test('annuler la révocation ne fait rien', async () => {
    const user = userEvent.setup();
    tokensOnServer = [token()];
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Révoquer : Veille ChatGPT' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Annuler' }));
    expect(api.delete).not.toHaveBeenCalled();
  });
});
