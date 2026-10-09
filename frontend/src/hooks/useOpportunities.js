import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export const OPPORTUNITIES_KEY = ['opportunities'];
export const OPPORTUNITY_COUNT_KEY = ['opportunities', 'count'];

// Tableaux en paramètres répétés (origin=a&origin=b), format attendu par FastAPI
const REPEATED_PARAMS = { indexes: null };

export const useOpportunities = (params = {}) =>
  useQuery({
    queryKey: ['opportunities', 'list', params],
    queryFn: () => api.get('/api/opportunities', { params, paramsSerializer: REPEATED_PARAMS }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

/** Valeurs disponibles pour les filtres (effectifs GLOBAUX au compte, cf. backend). */
export const OPPORTUNITY_FACETS_KEY = ['opportunities', 'facets'];

export const useOpportunityFacets = () =>
  useQuery({
    queryKey: OPPORTUNITY_FACETS_KEY,
    queryFn: () => api.get('/api/opportunities/facets').then(r => r.data),
    staleTime: 60 * 1000,
  });

/** Nombre d'opportunités nouvelles (badge de navigation). */
export const useOpportunityCount = () =>
  useQuery({
    queryKey: OPPORTUNITY_COUNT_KEY,
    queryFn: () => api.get('/api/opportunities/count').then(r => r.data),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

export const useOpportunityActions = () => {
  const queryClient = useQueryClient();
  // Invalide liste ET badge (même préfixe de clé)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: OPPORTUNITIES_KEY });

  const ignore = useMutation({
    mutationFn: (id) => api.post(`/api/opportunities/${id}/ignore`).then(r => r.data),
    onSuccess: invalidate,
  });

  const restore = useMutation({
    mutationFn: (id) => api.patch(`/api/opportunities/${id}`, { status: 'new' }).then(r => r.data),
    onSuccess: invalidate,
  });

  const convert = useMutation({
    mutationFn: (id) => api.post(`/api/opportunities/${id}/convert`).then(r => r.data),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  return { ignore, restore, convert };
};
