import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export const useApplications = (params = {}) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['applications', params],
    queryFn: () => api.get('/api/applications', { params }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const createApplication = useMutation({
    mutationFn: (data) => api.post('/api/applications', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const updateApplication = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/applications/${id}`, data).then(r => r.data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      const snapshot = queryClient.getQueriesData({ queryKey: ['applications'] });
      queryClient.setQueriesData({ queryKey: ['applications'] }, (old) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.map(app => app.id === id ? { ...app, ...data } : app) };
      });
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot?.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const deleteApplication = useMutation({
    mutationFn: (id) => api.delete(`/api/applications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: (id) => api.post(`/api/applications/${id}/favorite`).then(r => r.data),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      const snapshot = queryClient.getQueriesData({ queryKey: ['applications'] });
      queryClient.setQueriesData({ queryKey: ['applications'] }, (old) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.map(app => app.id === id ? { ...app, is_favorite: !app.is_favorite } : app) };
      });
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot?.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const bulkUpdate = useMutation({
    mutationFn: ({ applicationIds, status }) =>
      api.post('/api/applications/bulk-update', { application_ids: applicationIds, reponse: status }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  return {
    applications: data?.items ?? [],
    pagination: {
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      per_page: data?.per_page ?? 20,
      total_pages: data?.total_pages ?? 0,
    },
    loading: isLoading,
    isError,
    error: error?.response?.data?.detail ?? null,
    createApplication,
    updateApplication,
    deleteApplication,
    toggleFavorite,
    bulkUpdate,
  };
};
