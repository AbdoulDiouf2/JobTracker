import { useState, useCallback } from 'react';
import { api } from '../contexts/AuthContext';

export const useApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    per_page: 20,
    total_pages: 0
  });

  const fetchApplications = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/applications', { params });
      setApplications(response.data.items);
      setPagination({
        total: response.data.total,
        page: response.data.page,
        per_page: response.data.per_page,
        total_pages: response.data.total_pages
      });
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de chargement');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createApplication = async (data) => {
    try {
      const response = await api.post('/api/applications', data);
      setApplications(prev => [response.data, ...prev]);
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  const updateApplication = async (id, data) => {
    try {
      const response = await api.put(`/api/applications/${id}`, data);
      setApplications(prev => prev.map(app => app.id === id ? response.data : app));
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  const deleteApplication = async (id) => {
    try {
      await api.delete(`/api/applications/${id}`);
      setApplications(prev => prev.filter(app => app.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  const toggleFavorite = async (id) => {
    try {
      const response = await api.post(`/api/applications/${id}/favorite`);
      setApplications(prev => prev.map(app => 
        app.id === id ? { ...app, is_favorite: response.data.is_favorite } : app
      ));
      return { success: true, is_favorite: response.data.is_favorite };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  const bulkUpdate = async (applicationIds, status) => {
    try {
      const response = await api.post('/api/applications/bulk-update', {
        application_ids: applicationIds,
        reponse: status
      });
      await fetchApplications({ page: pagination.page });
      return { success: true, modified: response.data.modified_count };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  return {
    applications,
    loading,
    error,
    pagination,
    fetchApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    toggleFavorite,
    bulkUpdate
  };
};
