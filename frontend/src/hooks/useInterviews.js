import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export const useInterviews = (params = {}) => {
  const queryClient = useQueryClient();

  const { data: interviews = [], isLoading: loading, error } = useQuery({
    queryKey: ['interviews', params],
    queryFn: () => api.get('/api/interviews', { params }).then(r => r.data),
  });

  const createInterview = useMutation({
    mutationFn: (data) => api.post('/api/interviews', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const updateInterview = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/interviews/${id}`, data).then(r => r.data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['interviews'] });
      const snapshot = queryClient.getQueriesData({ queryKey: ['interviews'] });
      queryClient.setQueriesData({ queryKey: ['interviews'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map(i => i.id === id ? { ...i, ...data } : i);
      });
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot?.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const deleteInterview = useMutation({
    mutationFn: (id) => api.delete(`/api/interviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  return {
    interviews,
    loading,
    error: error?.response?.data?.detail ?? null,
    createInterview,
    updateInterview,
    deleteInterview,
  };
};

export const useUpcomingInterviews = (limit = 5) => {
  const { data: upcomingInterviews = [], isLoading: loading } = useQuery({
    queryKey: ['interviews', 'upcoming', limit],
    queryFn: () => api.get('/api/interviews/upcoming', { params: { limit } }).then(r => r.data),
  });
  return { upcomingInterviews, loading };
};
