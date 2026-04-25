import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export const useStatisticsDashboardV2 = () => useQuery({
  queryKey: ['statistics', 'dashboard-v2'],
  queryFn: () => api.get('/api/statistics/dashboard-v2').then(r => r.data),
});

export const useStatisticsDashboard = () => useQuery({
  queryKey: ['statistics', 'dashboard'],
  queryFn: () => api.get('/api/statistics/dashboard').then(r => r.data),
});

export const useStatisticsOverview = () => useQuery({
  queryKey: ['statistics', 'overview'],
  queryFn: () => api.get('/api/statistics/overview').then(r => r.data),
});

export const useStatisticsTimeline = () => useQuery({
  queryKey: ['statistics', 'timeline'],
  queryFn: () => api.get('/api/statistics/timeline').then(r => r.data),
});

export const useStatisticsPreferences = () => useQuery({
  queryKey: ['statistics', 'preferences'],
  queryFn: () => api.get('/api/statistics/preferences').then(r => r.data),
  placeholderData: { monthly_goal: 40, weekly_goal: 10 },
});

export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newPrefs) => api.put('/api/statistics/preferences', newPrefs).then(r => r.data),
    onSuccess: (data) => queryClient.setQueryData(['statistics', 'preferences'], data),
  });
};

// Barrel hook pour la compatibilité avec les pages existantes (SettingsPage, ProfilePage)
export const useStatistics = () => {
  const { data: dashboardV2, isLoading: loadingV2 } = useStatisticsDashboardV2();
  const { data: overview, isLoading: loadingOverview } = useStatisticsOverview();
  const { data: preferences = { monthly_goal: 40, weekly_goal: 10 } } = useStatisticsPreferences();
  const updatePreferencesMutation = useUpdatePreferences();

  return {
    dashboardV2,
    stats: dashboardV2?.stats ?? null,
    dashboard: dashboardV2?.stats ?? overview?.dashboard ?? null,
    timeline: overview?.timeline ?? [],
    preferences,
    loading: loadingV2 || loadingOverview,
    error: null,
    updatePreferences: (newPrefs) => updatePreferencesMutation.mutateAsync(newPrefs),
  };
};
