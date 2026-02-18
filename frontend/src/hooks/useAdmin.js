import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useAdmin = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState(null);
  
  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/admin/dashboard`, { headers });
      setDashboardStats(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // User Growth
  const [userGrowth, setUserGrowth] = useState([]);
  
  const fetchUserGrowth = useCallback(async (days = 30) => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/stats/user-growth?days=${days}`, { headers });
      setUserGrowth(response.data);
    } catch (err) {
      console.error('Erreur user growth:', err);
    }
  }, [headers]);

  // Activity Stats
  const [activityStats, setActivityStats] = useState([]);
  
  const fetchActivityStats = useCallback(async (days = 30) => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/stats/activity?days=${days}`, { headers });
      setActivityStats(response.data);
    } catch (err) {
      console.error('Erreur activity stats:', err);
    }
  }, [headers]);

  // Users List
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, per_page: 20, total: 0, total_pages: 0 });
  
  const fetchUsers = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);
      if (params.search) queryParams.append('search', params.search);
      if (params.role) queryParams.append('role', params.role);
      if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
      
      const response = await axios.get(`${API_URL}/api/admin/users?${queryParams.toString()}`, { headers });
      setUsers(response.data.items);
      setUsersPagination({
        page: response.data.page,
        per_page: response.data.per_page,
        total: response.data.total,
        total_pages: response.data.total_pages
      });
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // User Detail
  const fetchUserDetail = useCallback(async (userId) => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/users/${userId}`, { headers });
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  // Update User
  const updateUser = useCallback(async (userId, data) => {
    try {
      const response = await axios.put(`${API_URL}/api/admin/users/${userId}`, data, { headers });
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  // Delete User (soft delete)
  const deleteUser = useCallback(async (userId) => {
    try {
      const response = await axios.delete(`${API_URL}/api/admin/users/${userId}`, { headers });
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  // Reactivate User
  const reactivateUser = useCallback(async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/api/admin/users/${userId}/reactivate`, {}, { headers });
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  // Create User (Admin)
  const createUser = useCallback(async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/api/admin/users`, userData, { headers });
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  // Export Stats
  const exportStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/export/stats`, { headers });
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  return {
    loading,
    error,
    dashboardStats,
    fetchDashboardStats,
    userGrowth,
    fetchUserGrowth,
    activityStats,
    fetchActivityStats,
    users,
    usersPagination,
    fetchUsers,
    fetchUserDetail,
    updateUser,
    deleteUser,
    reactivateUser,
    createUser,
    exportStats
  };
};
