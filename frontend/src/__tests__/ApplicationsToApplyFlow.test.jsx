/**
 * Parcours to_apply -> candidature envoyée dans la page Candidatures :
 * le menu rapide ne PUT jamais directement, il demande la date réelle d'envoi.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import ApplicationsPage from '../pages/ApplicationsPage';
import { api } from '../contexts/AuthContext';
import { useApplications } from '../hooks/useApplications';
import { renderWithProviders } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({
  api: { get: jest.fn() },
  useAuth: () => ({ user: { id: 'u1', extension_connected: true } }),
}));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('../hooks/useApplications', () => ({ useApplications: jest.fn() }));
jest.mock('../components/FollowupEmailModal', () => () => null);
jest.mock('../components/MatchingScoreModal', () => () => null);
jest.mock('../components/CoverLetterGeneratorModal', () => () => null);
jest.mock('../components/ApplicationTimeline', () => ({ ApplicationTimeline: () => null }));

const toApplyApp = {
  id: 'app-1',
  entreprise: 'Orange',
  poste: 'Data Engineer',
  type_poste: 'cdi',
  lieu: 'Paris, France',
  moyen: 'linkedin',
  reponse: 'to_apply',
  date_candidature: '2026-10-07T08:00:00+00:00',
  created_at: '2026-10-05T08:00:00+00:00',
  is_favorite: false,
  interviews_count: 0,
  history: [],
};

let updateMutateAsync;

beforeEach(() => {
  jest.clearAllMocks();
  // CRA active resetMocks : les implémentations sont redéfinies avant chaque test
  api.get.mockResolvedValue({ data: { type_postes: [], moyens: [] } });
  updateMutateAsync = jest.fn().mockResolvedValue({});
  useApplications.mockReturnValue({
    applications: [toApplyApp],
    loading: false,
    pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    createApplication: { mutateAsync: jest.fn() },
    updateApplication: { mutateAsync: updateMutateAsync },
    deleteApplication: { mutateAsync: jest.fn() },
    toggleFavorite: { mutate: jest.fn(), mutateAsync: jest.fn() },
  });
});

const openStatusMenu = async (user) => {
  const card = await screen.findByTestId('application-card-app-1');
  await user.click(within(card).getByRole('button', { name: /À postuler/ }));
  return screen.findByRole('menu');
};

test("la carte n'affiche pas la date technique comme date de candidature", async () => {
  renderWithProviders(<ApplicationsPage />);
  const card = await screen.findByTestId('application-card-app-1');
  expect(within(card).getByText('Pas encore envoyée')).toBeInTheDocument();
  expect(within(card).queryByText(/07 oct/i)).toBeNull();
});

test('le menu ne propose que « En attente » et demande la date avant tout envoi', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ApplicationsPage />);

  const menu = await openStatusMenu(user);
  const items = within(menu).getAllByRole('menuitem').map(i => i.textContent);
  expect(items).toEqual(['En attente', 'À postuler']);

  await user.click(within(menu).getByRole('menuitem', { name: 'En attente' }));
  const dialog = await screen.findByTestId('sent-date-dialog');
  expect(within(dialog).getByText('À quelle date avez-vous envoyé cette candidature ?')).toBeInTheDocument();
  expect(updateMutateAsync).not.toHaveBeenCalled();
});

test("annuler le dialog n'envoie rien", async () => {
  const user = userEvent.setup();
  renderWithProviders(<ApplicationsPage />);

  await user.click(within(await openStatusMenu(user)).getByRole('menuitem', { name: 'En attente' }));
  const dialog = await screen.findByTestId('sent-date-dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));

  await waitFor(() => expect(screen.queryByTestId('sent-date-dialog')).toBeNull());
  expect(updateMutateAsync).not.toHaveBeenCalled();
});

test('confirmer envoie reponse=pending ET la date choisie, en une seule requête', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ApplicationsPage />);

  await user.click(within(await openStatusMenu(user)).getByRole('menuitem', { name: 'En attente' }));
  const input = await screen.findByLabelText("Date d'envoi");
  await user.clear(input);
  await user.type(input, '2026-10-03');
  await user.click(screen.getByTestId('sent-date-confirm'));

  await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
  const { id, data } = updateMutateAsync.mock.calls[0][0];
  expect(id).toBe('app-1');
  expect(data.reponse).toBe('pending');
  expect(format(new Date(data.date_candidature), 'yyyy-MM-dd')).toBe('2026-10-03');
});

test('pas de relance proposée pour une candidature pas encore envoyée', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ApplicationsPage />);

  await user.click(await screen.findByTestId('view-details-btn-app-1'));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByTestId('to-apply-date-block')).toHaveTextContent('Pas encore envoyée');
  expect(within(dialog).queryByTestId('followup-quick-action')).toBeNull();
  expect(within(dialog).queryByText(/Relance recommandée/)).toBeNull();
});

test('la relance reste disponible pour une candidature envoyée', async () => {
  const user = userEvent.setup();
  useApplications.mockReturnValue({
    ...useApplications(),
    applications: [{ ...toApplyApp, reponse: 'pending', date_candidature: '2026-09-01T12:00:00+00:00' }],
  });
  renderWithProviders(<ApplicationsPage />);

  await user.click(await screen.findByTestId('view-details-btn-app-1'));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByTestId('followup-quick-action')).toBeInTheDocument();
});
