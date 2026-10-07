import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

/** Affiche l'URL courante : permet de vérifier les redirections. */
export const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

/**
 * Rend `ui` dans QueryClient + MemoryRouter.
 * `routes` : routes supplémentaires (ex: cible d'une redirection).
 */
export const renderWithProviders = (ui, { route = '/', path = '*', routes = [] } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          {routes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...result, queryClient };
};

/** Erreur axios minimale. */
export const axiosError = (status, detail) => {
  const error = new Error(`HTTP ${status}`);
  error.response = { status, data: { detail } };
  return error;
};
