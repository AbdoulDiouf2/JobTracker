import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../contexts/AuthContext';
import { toast } from 'sonner';
import OpportunitiesPage from '../pages/OpportunitiesPage';
import { renderWithProviders, LocationDisplay } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const today = new Date().toISOString();
const CLAUDE = 'client:jt_oc_claude';
const GPT = 'client:jt_oc_gpt';

const opp = (overrides = {}) => ({
  id: 'opp-1', title: 'Data Engineer Junior', company: 'Nestlé', url: 'https://company.com/jobs/1',
  location: 'Genève', country: 'CH', contract_type: 'CDI', description: 'Spark.', source: 'chatgpt_watch',
  external_id: null, status: 'new', discovered_at: today, created_at: today, updated_at: today,
  converted_application_id: null, converted_at: null, metadata: {},
  watch: { run_id: 'veille-20261010-0800-prog', relevance_score: 92, relevance_reasons: [], client_id: 'jt_oc_claude', client_name: 'Claude' },
  origin: { kind: 'client', key: CLAUDE, client_id: 'jt_oc_claude', client_name: 'Claude' },
  ...overrides,
});

const FACETS = {
  scope: 'account', total: 21,
  origins: [
    { kind: 'client', key: CLAUDE, client_id: 'jt_oc_claude', client_name: 'Claude', count: 12 },
    { kind: 'client', key: GPT, client_id: 'jt_oc_gpt', client_name: 'ChatGPT', count: 7 },
    { kind: 'watch_legacy', key: 'watch_legacy', count: 1 },
    { kind: 'source', key: 'source:manual', source: 'manual', count: 1 },
  ],
  countries: [{ key: 'FR', count: 10 }, { key: 'CH', count: 8 }, { key: 'BE', count: 3 }],
  countries_unrecognized: 0,
  contracts: [{ key: 'permanent', count: 20 }, { key: 'fixed_term', count: 1 }],
  seniorities: [{ key: 'junior', count: 5 }],
  scores: { count: 19, min: 75, max: 98 },
};

let listResponse;

beforeEach(() => {
  jest.clearAllMocks();
  listResponse = { items: [opp()], total: 1, page: 1, per_page: 20, total_pages: 1 };
  api.get.mockImplementation((url) => {
    if (url === '/api/opportunities') return Promise.resolve({ data: listResponse });
    if (url === '/api/opportunities/facets') return Promise.resolve({ data: FACETS });
    if (url === '/api/opportunities/count') return Promise.resolve({ data: { new: 0 } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
});

const Page = () => (<><OpportunitiesPage /><LocationDisplay /></>);
const renderAt = (search = '') => renderWithProviders(<Page />, {
  route: `/dashboard/opportunities${search}`, path: '/dashboard/opportunities',
  routes: [{ path: '/dashboard/applications', element: <LocationDisplay /> }],
});
const lastListParams = () => {
  const calls = api.get.mock.calls.filter(([url]) => url === '/api/opportunities');
  return calls[calls.length - 1][1].params;
};
const location = () => decodeURIComponent(screen.getByTestId('location').textContent);

describe('Opportunités — filtres et URL', () => {
  test('l’URL restaure les filtres (retour arrière) et les envoie au serveur', async () => {
    renderAt('?status=new&q=spark&origin=client%3Ajt_oc_claude&country=CH&score=85-94&sort=relevance&page=2');
    await waitFor(() => expect(screen.getByTestId('opportunity-count')).toHaveTextContent('1 offre'));
    expect(lastListParams()).toEqual({
      page: 2, per_page: 20, status: 'new', search: 'spark', origin: [CLAUDE], country: ['CH'],
      min_score: 85, max_score: 94, sort: 'relevance',
    });
    expect(api.get.mock.calls.find(([url]) => url === '/api/opportunities')[1].paramsSerializer).toEqual({ indexes: null });
    expect(screen.getByTestId('opportunity-filter-new')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('opportunity-search')).toHaveValue('spark');
    const chips = screen.getByTestId('filter-chips');
    expect(chips).toHaveTextContent('Veille Claude');
    expect(chips).toHaveTextContent('Suisse');
    expect(chips).toHaveTextContent('Pertinence 85–94');
    expect(screen.getByTestId('filter-origin-trigger')).toHaveTextContent('Veille Claude');
  });

  test('filtre rapide Origine (sélection multiple) : URL mise à jour, retour en page 1', async () => {
    const user = userEvent.setup();
    renderAt('?page=3');
    await user.click(await screen.findByTestId('filter-origin-trigger'));
    const menu = await screen.findByTestId('filter-origin-menu');
    expect(within(menu).getByText('Veille ChatGPT')).toBeInTheDocument();
    expect(within(menu).getByText('Veille (antérieure)')).toBeInTheDocument();
    await user.click(within(menu).getByTestId(`filter-origin-option-${CLAUDE}`));
    await waitFor(() => expect(location()).toContain(`origin=${CLAUDE}`));
    expect(location()).not.toContain('page=');
    await user.click(within(menu).getByTestId(`filter-origin-option-${GPT}`));
    await waitFor(() => expect(lastListParams().origin).toEqual([CLAUDE, GPT]));
    expect(screen.getByTestId('filter-origin-trigger')).toHaveTextContent('2');
  });

  test('filtre rapide Pays : noms localisés depuis les facettes', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(await screen.findByTestId('filter-country-trigger'));
    const menu = await screen.findByTestId('filter-country-menu');
    expect(within(menu).getByText('Belgique')).toBeInTheDocument();
    await user.click(within(menu).getByTestId('filter-country-option-BE'));
    await waitFor(() => expect(lastListParams().country).toEqual(['BE']));
  });

  test('panneau « Plus de filtres » : pertinence, période, contrat, séniorité, lieu et tri', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(await screen.findByTestId('filter-more'));
    const sheet = await screen.findByTestId('filter-sheet');
    expect(sheet.className).toContain('w-full'); // plein écran sur mobile
    await user.click(within(sheet).getByTestId('filter-score-95-100'));
    await user.click(within(sheet).getByTestId('filter-period-7d'));
    await user.click(within(sheet).getByTestId('filter-contract-permanent'));
    await user.click(within(sheet).getByTestId('filter-seniority-junior'));
    await user.click(within(sheet).getByTestId('filter-sort-company'));
    await user.type(within(sheet).getByTestId('filter-location'), 'Lyon');
    await waitFor(() => expect(lastListParams()).toMatchObject({
      min_score: 95, max_score: 100, contract: ['permanent'], seniority: ['junior'], sort: 'company', location: 'Lyon',
    }));
    expect(lastListParams().discovered_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(within(sheet).getByTestId('filter-score-95-100')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('filter-more')).toHaveTextContent('6');
    await user.click(within(sheet).getByTestId('filter-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('filter-sheet')).toBeNull());
  });

  test('période personnalisée : bornes envoyées telles quelles', async () => {
    renderAt('?period=custom&from=2026-10-01&to=2026-10-09');
    await screen.findByTestId('opportunity-count');
    expect(lastListParams()).toMatchObject({ discovered_from: '2026-10-01', discovered_to: '2026-10-09' });
    expect(screen.getByTestId('filter-chips')).toHaveTextContent('Du 2026-10-01 au 2026-10-09');
  });

  test('pastilles supprimables et réinitialisation (le statut est conservé)', async () => {
    const user = userEvent.setup();
    renderAt('?status=new&origin=client%3Ajt_oc_claude&country=CH&location=Gen%C3%A8ve');
    await user.click(await screen.findByRole('button', { name: 'Retirer le filtre Suisse' }));
    await waitFor(() => expect(location()).not.toContain('country='));
    expect(location()).toContain(`origin=${CLAUDE}`);
    await user.click(screen.getByTestId('filter-reset'));
    await waitFor(() => expect(location()).toBe('/dashboard/opportunities?status=new'));
    expect(screen.queryByTestId('filter-chips')).toBeNull();
  });

  test('résultat vide filtré : message et réinitialisation', async () => {
    const user = userEvent.setup();
    listResponse = { items: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    renderAt('?country=BE');
    expect(await screen.findByTestId('opportunities-empty')).toHaveTextContent('Aucun résultat');
    expect(screen.getByTestId('opportunity-count')).toHaveTextContent('0 offre');
    await user.click(screen.getByTestId('opportunities-empty-reset'));
    await waitFor(() => expect(location()).toBe('/dashboard/opportunities'));
  });

  test('facettes indisponibles : la liste reste utilisable', async () => {
    api.get.mockImplementation((url) => (url === '/api/opportunities'
      ? Promise.resolve({ data: listResponse }) : Promise.reject(new Error('down'))));
    const user = userEvent.setup();
    renderAt();
    expect(await screen.findByTestId('opportunity-card-opp-1')).toBeInTheDocument();
    await user.click(screen.getByTestId('filter-origin-trigger'));
    expect(await screen.findByText('Aucune valeur disponible')).toBeInTheDocument();
  });
});

describe('Opportunités — cartes et actions avec filtres actifs', () => {
  test('score affiché seulement s’il existe', async () => {
    listResponse = { items: [opp(), opp({ id: 'opp-2', source: 'manual', watch: null,
      origin: { kind: 'source', key: 'source:manual', source: 'manual' } })], total: 2, page: 1, per_page: 20, total_pages: 1 };
    renderAt();
    expect(await screen.findByTestId('opportunity-score-opp-1')).toHaveTextContent('92/100');
    expect(screen.getByTestId('opportunity-score-opp-1')).toHaveAttribute('aria-label', 'Pertinence 92 / 100');
    expect(screen.queryByTestId('opportunity-score-opp-2')).toBeNull();
    expect(screen.getByTestId('opportunity-card-opp-2')).toHaveTextContent('Source : Ajout manuel');
  });

  test('Ignorer conserve les filtres ; Candidater navigue vers la candidature', async () => {
    const user = userEvent.setup();
    api.post.mockImplementation((url) => (url.endsWith('/ignore')
      ? Promise.resolve({ data: opp({ status: 'ignored' }) })
      : Promise.resolve({ data: { created: true, application_id: 'app-9', opportunity_id: 'opp-1' } })));
    renderAt('?country=CH&sort=relevance');
    await user.click(await screen.findByTestId('opportunity-ignore-opp-1'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/opportunities/opp-1/ignore'));
    expect(location()).toBe('/dashboard/opportunities?country=CH&sort=relevance');
    await user.click(screen.getByTestId('opportunity-convert-opp-1'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/applications?id=app-9'));
    expect(toast.success).toHaveBeenCalled();
  });

  test('Voir l’offre : lien externe sécurisé', async () => {
    renderAt('?country=CH');
    const link = await screen.findByTestId('opportunity-view-offer-opp-1');
    expect(link).toHaveAttribute('href', 'https://company.com/jobs/1');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
