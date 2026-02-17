import { useState, useCallback } from 'react';
import { api } from '../contexts/AuthContext';

export const useStatistics = () => {
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardV2, setDashboardV2] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [preferences, setPreferences] = useState({ monthly_goal: 40, weekly_goal: 10 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/statistics/dashboard');
      setDashboard(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Dashboard V2 avec insights intelligents
  const fetchDashboardV2 = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/statistics/dashboard-v2');
      setDashboardV2(response.data);
      setDashboard(response.data.stats);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Préférences utilisateur (objectifs)
  const fetchPreferences = useCallback(async () => {
    try {
      const response = await api.get('/api/statistics/preferences');
      setPreferences(response.data);
      return response.data;
    } catch (err) {
      return { monthly_goal: 40, weekly_goal: 10 };
    }
  }, []);

  const updatePreferences = useCallback(async (newPrefs) => {
    try {
      const response = await api.put('/api/statistics/preferences', newPrefs);
      setPreferences(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail);
      return null;
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/statistics/overview');
      setStats(response.data);
      setDashboard(response.data.dashboard);
      setTimeline(response.data.timeline);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTimeline = useCallback(async () => {
    try {
      const response = await api.get('/api/statistics/timeline');
      setTimeline(response.data);
      return response.data;
    } catch (err) {
      return [];
    }
  }, []);

  return {
    stats,
    dashboard,
    dashboardV2,
    timeline,
    preferences,
    loading,
    error,
    fetchDashboard,
    fetchDashboardV2,
    fetchOverview,
    fetchTimeline,
    fetchPreferences,
    updatePreferences
  };
};
