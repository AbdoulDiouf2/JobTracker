import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export const useAIUsage = () => {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['ai', 'usage'],
    queryFn: () => api.get('/api/ai/usage-stats').then(r => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};

export const useInvalidateAIUsage = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['ai', 'usage'] });
};
