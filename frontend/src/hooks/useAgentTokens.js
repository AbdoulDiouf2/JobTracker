import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export const AGENT_TOKENS_KEY = ['agent-tokens'];

export const useAgentTokens = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: AGENT_TOKENS_KEY,
    queryFn: () => api.get('/api/agent-tokens').then(r => r.data),
  });

  /**
   * Création d'un token. Volontairement SANS useMutation : la réponse contient
   * le token brut, qui ne doit jamais entrer dans le cache TanStack (queries ni
   * mutations). Seul l'appelant le reçoit, à afficher une fois puis oublier.
   */
  const createToken = async (name) => {
    const response = await api.post('/api/agent-tokens', { name, scopes: ['opportunities:create'] });
    queryClient.invalidateQueries({ queryKey: AGENT_TOKENS_KEY });
    return response.data;
  };

  const revokeToken = useMutation({
    mutationFn: (id) => api.delete(`/api/agent-tokens/${id}`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_TOKENS_KEY }),
  });

  return {
    tokens: data ?? [],
    isLoading,
    isError,
    refetch,
    createToken,
    revokeToken,
  };
};
