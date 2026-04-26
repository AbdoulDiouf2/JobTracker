import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export const useAdminDashboard = () => useQuery({
  queryKey: ['admin', 'dashboard'],
  queryFn: () => api.get('/api/admin/dashboard').then(r => r.data),
  staleTime: 2 * 60 * 1000,
});

export const useAdminUserGrowth = (days = 30) => useQuery({
  queryKey: ['admin', 'user-growth', days],
  queryFn: () => api.get(`/api/admin/stats/user-growth?days=${days}`).then(r => r.data),
});

export const useAdminActivityStats = (days = 30) => useQuery({
  queryKey: ['admin', 'activity', days],
  queryFn: () => api.get(`/api/admin/stats/activity?days=${days}`).then(r => r.data),
});

export const useAdminUsers = (params = {}) => useQuery({
  queryKey: ['admin', 'users', params],
  queryFn: () => api.get('/api/admin/users', { params }).then(r => r.data),
  placeholderData: (prev) => prev,
});

export const useAdminUserDetail = (userId) => useQuery({
  queryKey: ['admin', 'users', userId],
  queryFn: () => api.get(`/api/admin/users/${userId}`).then(r => r.data),
  enabled: !!userId,
});

export const useAdminOnboardingStats = () => useQuery({
  queryKey: ['admin', 'onboarding-stats'],
  queryFn: () => api.get('/api/admin/onboarding-stats').then(r => r.data),
});

export const useAdminMutations = () => {
  const queryClient = useQueryClient();
  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const updateUser = useMutation({
    mutationFn: ({ userId, data }) => api.put(`/api/admin/users/${userId}`, data).then(r => r.data),
    onSuccess: invalidateUsers,
  });

  const deleteUser = useMutation({
    mutationFn: (userId) => api.delete(`/api/admin/users/${userId}`).then(r => r.data),
    onSuccess: invalidateUsers,
  });

  const reactivateUser = useMutation({
    mutationFn: (userId) => api.post(`/api/admin/users/${userId}/reactivate`, {}).then(r => r.data),
    onSuccess: invalidateUsers,
  });

  const createUser = useMutation({
    mutationFn: (userData) => api.post('/api/admin/users', userData).then(r => r.data),
    onSuccess: invalidateUsers,
  });

  const exportStats = async () => {
    const response = await api.get('/api/admin/export/stats');
    return response.data;
  };

  return { updateUser, deleteUser, reactivateUser, createUser, exportStats };
};

export const useAdminSupportTickets = (params = {}) => useQuery({
  queryKey: ['admin', 'support-tickets', params],
  queryFn: () => api.get('/api/admin/support-tickets', { params }).then(r => r.data),
  placeholderData: (prev) => prev,
});

export const useAdminSupportStats = () => useQuery({
  queryKey: ['admin', 'support-tickets', 'stats'],
  queryFn: () => api.get('/api/admin/support-tickets/stats').then(r => r.data),
  staleTime: 60 * 1000,
});

export const useAdminSupportMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'support-tickets'] });
  };

  const updateTicket = useMutation({
    mutationFn: ({ ticketId, data }) =>
      api.put(`/api/admin/support-tickets/${ticketId}`, data).then(r => r.data),
    onSuccess: invalidate,
  });

  const deleteTicket = useMutation({
    mutationFn: (ticketId) =>
      api.delete(`/api/admin/support-tickets/${ticketId}`).then(r => r.data),
    onSuccess: invalidate,
  });

  return { updateTicket, deleteTicket };
};

export const useQuotaSettings = () => useQuery({
  queryKey: ['admin', 'settings', 'quota'],
  queryFn: () => api.get('/api/admin/settings/quota').then(r => r.data),
  staleTime: 60 * 1000,
});

export const useUpdateQuota = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (daily_quota) => api.put('/api/admin/settings/quota', { daily_quota }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'quota'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-quota-stats'] });
    },
  });
};

// Barrel hook pour la compatibilité avec les pages admin existantes
export const useAdmin = () => {
  const { data: dashboardStats, isLoading: loadingDashboard } = useAdminDashboard();
  const { data: userGrowth = [] } = useAdminUserGrowth();
  const { data: activityStats = [] } = useAdminActivityStats();
  const { data: onboardingStats } = useAdminOnboardingStats();
  const mutations = useAdminMutations();
  const queryClient = useQueryClient();

  const fetchUsers = (params) => queryClient.invalidateQueries({ queryKey: ['admin', 'users', params] });

  return {
    loading: loadingDashboard,
    error: null,
    dashboardStats,
    userGrowth,
    activityStats,
    onboardingStats,
    ...mutations,
    fetchDashboardStats: () => queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    fetchUserGrowth: (days) => queryClient.invalidateQueries({ queryKey: ['admin', 'user-growth', days] }),
    fetchActivityStats: (days) => queryClient.invalidateQueries({ queryKey: ['admin', 'activity', days] }),
    fetchUsers,
    fetchOnboardingStats: () => queryClient.invalidateQueries({ queryKey: ['admin', 'onboarding-stats'] }),
  };
};
