import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import OpportunitiesPage from '../pages/OpportunitiesPage';
import { renderWithProviders, LocationDisplay, axiosError } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const today = new Date().toISOString();

const opp = (overrides = {}) => ({
  id: 'opp-1',
  title: 'Data Engineer Junior',
  company: 'Orange',
  url: 'https://company.com/jobs/1',
  location: 'Paris',
  country: 'France',
  contract_type: 'CDI',
  description: 'Pipelines Spark et Airflow.',
  source: 'chatgpt_watch',
  external_id: null,
  status: 'new',
  discovered_at: today,
  created_at: today,
  updated_at: today,
  converted_application_id: null,
  converted_at: null,
  metadata: {},
  ...overrides,
});

const page = (items) => ({ items, total: items.length, page: 1, per_page: 20, total_pages: items.length ? 1 : 0 });

const mockList = (items) => {
  api.get.mockImplementation((url) => {
    if (url === '/api/opportunities') return Promise.resolve({ data: page(items) });
    if (url === '/api/opportunities/count') return Promise.resolve({ data: { new: 0 } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};

const renderPage = () =>
  renderWithProviders(<OpportunitiesPage />, {
    route: '/dashboard/opportunities',
    path: '/dashboard/opportunities',
    routes: [{ path: '/dashboard/applications', element: <LocationDisplay /> }],
  });

const listCalls = () => api.get.mock.calls.filter(([url]) => url === '/api/opportunities');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OpportunitiesPage — liste', () => {
  test('affiche les opportunités en cartes avec les informations clés', async () => {
    mockList([opp()]);
    renderPage();

    const card = await screen.findByTestId('opportunity-card-opp-1');
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('Data Engineer Junior');
    expect(within(card).getByRole('button', { name: 'Voir les détails : Data Engineer Junior' })).toBeInTheDocument();
    expect(within(card).getByText('Orange')).toBeInTheDocument();
    expect(within(card).getByText('Paris, France')).toBeInTheDocument();
    expect(within(card).getByText('CDI')).toBeInTheDocument();
    expect(within(card).getByText(/Veille ChatGPT/)).toBeInTheDocument();
    expect(within(card).getByText("Trouvée aujourd'hui")).toBeInTheDocument();
    expect(within(card).getByText('Nouvelle')).toBeInTheDocument();
    // Mobile : de vraies cartes, pas de tableau desktop compressé
    expect(document.querySelector('table')).toBeNull();
    expect(card.tagName).toBe('ARTICLE');
  });

  test("état vide générique", async () => {
    mockList([]);
    renderPage();
    expect(await screen.findByText('Aucune opportunité pour le moment')).toBeInTheDocument();
    expect(screen.getByText('Les offres détectées par vos outils et agents apparaîtront ici.')).toBeInTheDocument();
  });

  test('filtres : envoie le statut au backend', async () => {
    const user = userEvent.setup();
    mockList([opp()]);
    renderPage();
    await screen.findByTestId('opportunity-card-opp-1');
    expect(listCalls()[0][1].params).toEqual({ page: 1, per_page: 20 });

    await user.click(screen.getByRole('button', { name: 'Ignorées' }));
    await waitFor(() => expect(listCalls().at(-1)[1].params).toEqual({ page: 1, per_page: 20, status: 'ignored' }));
    expect(screen.getByRole('button', { name: 'Ignorées' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Converties' }));
    await waitFor(() => expect(listCalls().at(-1)[1].params.status).toBe('converted'));

    await user.click(screen.getByRole('button', { name: 'Toutes' }));
    await waitFor(() => expect(listCalls().at(-1)[1].params).toEqual({ page: 1, per_page: 20 }));
  });

  test('recherche poste/entreprise (debounce)', async () => {
    const user = userEvent.setup();
    mockList([opp()]);
    renderPage();
    await screen.findByTestId('opportunity-card-opp-1');

    await user.type(screen.getByLabelText('Rechercher par poste ou entreprise'), 'orange');
    await waitFor(() => expect(listCalls().at(-1)[1].params.search).toBe('orange'), { timeout: 2000 });
  });

  test('aucun résultat avec un filtre actif', async () => {
    const user = userEvent.setup();
    mockList([]);
    renderPage();
    await screen.findByText('Aucune opportunité pour le moment');
    await user.click(screen.getByRole('button', { name: 'Ignorées' }));
    expect(await screen.findByText('Aucun résultat')).toBeInTheDocument();
  });
});

describe('OpportunitiesPage — détail', () => {
  test('ouvre le détail avec description, lien sécurisé et actions', async () => {
    const user = userEvent.setup();
    mockList([opp({ description: 'Ligne 1\nLigne 2 '.repeat(50) })]);
    renderPage();

    await user.click(await screen.findByTestId('opportunity-open-opp-1'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Data Engineer Junior' })).toBeInTheDocument();
    expect(within(dialog).getByTestId('opportunity-description')).toHaveTextContent('Ligne 1');

    const link = within(dialog).getByTestId('opportunity-original-link');
    expect(link).toHaveAttribute('href', 'https://company.com/jobs/1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(dialog).getByRole('button', { name: /Candidater/ })).toBeInTheDocument();
  });

  test("une URL non http(s) n'est jamais rendue comme lien", async () => {
    const user = userEvent.setup();
    mockList([opp({ url: 'javascript:alert(1)' })]);
    renderPage();

    const card = await screen.findByTestId('opportunity-card-opp-1');
    expect(within(card).queryByText("Voir l'offre")).toBeNull();
    await user.click(screen.getByTestId('opportunity-open-opp-1'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByTestId('opportunity-original-link')).toBeNull();
    expect(within(dialog).getByText(/Lien non disponible/)).toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });

  test("bouton Voir l'offre : nouvel onglet protégé", async () => {
    mockList([opp()]);
    renderPage();
    const link = await screen.findByTestId('opportunity-view-offer-opp-1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('OpportunitiesPage — ignorer', () => {
  test('ignore, rafraîchit la liste et propose Annuler', async () => {
    const user = userEvent.setup();
    mockList([opp()]);
    api.post.mockResolvedValue({ data: opp({ status: 'ignored' }) });
    renderPage();

    await user.click(await screen.findByTestId('opportunity-ignore-opp-1'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/opportunities/opp-1/ignore'));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(1)); // invalidation -> refetch
    expect(toast.success).toHaveBeenCalledWith('Opportunité ignorée', expect.objectContaining({
      action: expect.objectContaining({ label: 'Annuler' }),
    }));
  });

  test("une opportunité ignorée peut être candidatée mais plus ignorée", async () => {
    mockList([opp({ status: 'ignored' })]);
    renderPage();
    await screen.findByTestId('opportunity-card-opp-1');
    expect(screen.queryByTestId('opportunity-ignore-opp-1')).toBeNull();
    expect(screen.getByTestId('opportunity-convert-opp-1')).toBeInTheDocument();
  });
});

describe('OpportunitiesPage — candidater', () => {
  test('convertit puis redirige vers la candidature', async () => {
    const user = userEvent.setup();
    mockList([opp()]);
    api.post.mockResolvedValue({ data: { success: true, opportunity_id: 'opp-1', application_id: 'app-42', created: true } });
    renderPage();

    await user.click(await screen.findByTestId('opportunity-convert-opp-1'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard/applications?id=app-42');
    expect(api.post).toHaveBeenCalledWith('/api/opportunities/opp-1/convert');
    expect(toast.success).toHaveBeenCalledWith('Candidature créée — statut « À postuler »');
  });

  test('created=false : même redirection', async () => {
    const user = userEvent.setup();
    mockList([opp()]);
    api.post.mockResolvedValue({ data: { success: true, opportunity_id: 'opp-1', application_id: 'app-7', created: false } });
    renderPage();

    await user.click(await screen.findByTestId('opportunity-convert-opp-1'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard/applications?id=app-7');
  });

  test('double clic : un seul appel, bouton désactivé pendant le chargement', async () => {
    const user = userEvent.setup();
    mockList([opp()]);
    let resolve;
    api.post.mockImplementation(() => new Promise(r => { resolve = r; }));
    renderPage();

    const button = await screen.findByTestId('opportunity-convert-opp-1');
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent('Création…');
    await user.click(button);
    expect(api.post).toHaveBeenCalledTimes(1);

    resolve({ data: { success: true, opportunity_id: 'opp-1', application_id: 'app-1', created: true } });
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard/applications?id=app-1');
  });

  test('409 : message compréhensible et possibilité de réessayer', async () => {
    const user = userEvent.setup();
    mockList([opp()]);
    api.post.mockRejectedValueOnce(axiosError(409, 'Conversion déjà en cours, réessayez dans quelques secondes'));
    renderPage();

    await user.click(await screen.findByTestId('opportunity-convert-opp-1'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe('Cette candidature est déjà en cours de création. Réessayez dans quelques secondes.');
    expect(options.action.label).toBe('Réessayer');
    expect(screen.queryByTestId('location')).toBeNull();
    expect(screen.getByTestId('opportunity-convert-opp-1')).not.toBeDisabled();

    api.post.mockResolvedValueOnce({ data: { success: true, opportunity_id: 'opp-1', application_id: 'app-9', created: false } });
    await act(async () => { options.action.onClick(); });
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard/applications?id=app-9');
  });

  test('convertie : « Voir candidature » remplace « Candidater »', async () => {
    const user = userEvent.setup();
    mockList([opp({ status: 'converted', converted_application_id: 'app-3' })]);
    renderPage();

    await screen.findByTestId('opportunity-card-opp-1');
    expect(screen.queryByTestId('opportunity-convert-opp-1')).toBeNull();
    expect(screen.queryByTestId('opportunity-ignore-opp-1')).toBeNull();
    await user.click(screen.getByTestId('opportunity-view-application-opp-1'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard/applications?id=app-3');
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('OpportunitiesPage — provenance de la veille', () => {
  const watch = (over = {}) => ({ run_id: 'veille-20261010-0800-prog', relevance_score: 90, relevance_reasons: [], ...over });

  test('affiche le client OAuth vérifié, et le libellé historique sans client', async () => {
    mockList([
      opp({ id: 'opp-claude', watch: watch({ client_id: 'jt_oc_claude', client_name: 'Claude' }) }),
      opp({ id: 'opp-gpt', watch: watch({ client_id: 'jt_oc_gpt', client_name: 'ChatGPT' }) }),
      opp({ id: 'opp-old', watch: watch() }),
      opp({ id: 'opp-gone', watch: watch({ client_id: 'jt_oc_gone', client_name: null }) }),
      opp({ id: 'opp-manual', source: 'manual' }),
    ]);
    renderPage();
    expect(await screen.findByTestId('opportunity-card-opp-claude')).toHaveTextContent('Source : Veille Claude');
    expect(screen.getByTestId('opportunity-card-opp-gpt')).toHaveTextContent('Source : Veille ChatGPT');
    expect(screen.getByTestId('opportunity-card-opp-old')).toHaveTextContent('Source : Veille ChatGPT');
    expect(screen.getByTestId('opportunity-card-opp-gone')).toHaveTextContent('Source : Veille (client inconnu)');
    expect(screen.getByTestId('opportunity-card-opp-manual')).toHaveTextContent('Source : Ajout manuel');
  });

  test('la fiche détaillée reprend le même libellé', async () => {
    const user = userEvent.setup();
    mockList([opp({ watch: watch({ client_id: 'jt_oc_claude', client_name: 'Claude' }) })]);
    renderPage();
    await user.click(await screen.findByTestId('opportunity-open-opp-1'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Veille Claude');
  });
});
