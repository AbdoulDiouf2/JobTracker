import { screen, waitFor } from '@testing-library/react';
import { api } from '../contexts/AuthContext';
import { OpportunitiesNavBadge } from '../components/opportunities/OpportunitiesNavBadge';
import { renderWithProviders } from '../testUtils/renderWithProviders';

jest.mock('../contexts/AuthContext', () => ({ api: { get: jest.fn() } }));
jest.mock('../i18n', () => ({ useLanguage: () => ({ language: 'fr' }) }));

beforeEach(() => jest.clearAllMocks());

test('affiche le nombre de nouvelles opportunités', async () => {
  api.get.mockResolvedValue({ data: { new: 4 } });
  renderWithProviders(<OpportunitiesNavBadge />);
  const badge = await screen.findByTestId('opportunities-nav-badge');
  expect(badge).toHaveTextContent('4');
  // Nom accessible exposé aux lecteurs d'écran (texte sr-only)
  expect(screen.getByText('4 nouvelles opportunités')).toHaveClass('sr-only');
  expect(api.get).toHaveBeenCalledWith('/api/opportunities/count');
});

test("n'affiche rien si 0", async () => {
  api.get.mockResolvedValue({ data: { new: 0 } });
  renderWithProviders(<OpportunitiesNavBadge />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.queryByTestId('opportunities-nav-badge')).toBeNull();
});

test('plafonne à 99+', async () => {
  api.get.mockResolvedValue({ data: { new: 250 } });
  renderWithProviders(<OpportunitiesNavBadge />);
  expect(await screen.findByTestId('opportunities-nav-badge')).toHaveTextContent('99+');
});
