import { useState, useCallback } from 'react';
import { api } from '../contexts/AuthContext';

export const useStatistics = () => {
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [timeline, setTimeline] = useState([]);
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
    timeline,
    loading,
    error,
    fetchDashboard,
    fetchOverview,
    fetchTimeline
  };
};
