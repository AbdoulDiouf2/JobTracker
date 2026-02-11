import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext(null);

// Axios instance avec intercepteur
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = !!token && !!user;

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { access_token } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      
      // Récupérer le profil utilisateur
      const userResponse = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      
      localStorage.setItem('user', JSON.stringify(userResponse.data));
      setUser(userResponse.data);
      
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur de connexion';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, fullName) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/register', {
        email,
        password,
        full_name: fullName
      });
      
      // Auto login after register
      return await login(email, password);
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur d\'inscription';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = async (data) => {
    try {
      const response = await api.put('/api/auth/update-profile', data);
      localStorage.setItem('user', JSON.stringify(response.data));
      setUser(response.data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail };
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
    api
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { api };
