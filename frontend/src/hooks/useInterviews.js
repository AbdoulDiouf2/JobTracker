import { useState, useCallback } from 'react';
import { api } from '../contexts/AuthContext';

export const useInterviews = () => {
  const [interviews, setInterviews] = useState([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInterviews = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/interviews', { params });
      setInterviews(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de chargement');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUpcoming = useCallback(async (limit = 5) => {
    try {
      const response = await api.get('/api/interviews/upcoming', { params: { limit } });
      setUpcomingInterviews(response.data);
      return response.data;
    } catch (err) {
      return [];
    }
  }, []);

  const createInterview = async (data) => {
    try {
      const response = await api.post('/api/interviews', data);
      setInterviews(prev => [...prev, response.data]);
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  const updateInterview = async (id, data) => {
    try {
      const response = await api.put(`/api/interviews/${id}`, data);
      setInterviews(prev => prev.map(i => i.id === id ? response.data : i));
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  const deleteInterview = async (id) => {
    try {
      await api.delete(`/api/interviews/${id}`);
      setInterviews(prev => prev.filter(i => i.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  return {
    interviews,
    upcomingInterviews,
    loading,
    error,
    fetchInterviews,
    fetchUpcoming,
    createInterview,
    updateInterview,
    deleteInterview
  };
};
