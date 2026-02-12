import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useTracking = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Récupérer la timeline d'une candidature
  const getTimeline = useCallback(async (applicationId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_URL}/api/applications/${applicationId}/timeline`,
        { headers }
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement de la timeline');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Ajouter un événement à la timeline
  const addTimelineEvent = useCallback(async (applicationId, event) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/applications/${applicationId}/timeline/event`,
        event,
        { headers }
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  // Récupérer les rappels en attente
  const getPendingReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_URL}/api/applications/reminders/pending`,
        { headers }
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement des rappels');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Marquer un rappel comme envoyé
  const markReminderSent = useCallback(async (applicationId) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/applications/${applicationId}/reminder/mark-sent`,
        {},
        { headers }
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  // Générer un email de relance
  const generateFollowupEmail = useCallback(async (applicationId, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_URL}/api/applications/${applicationId}/followup/generate`,
        {
          application_id: applicationId,
          tone: options.tone || 'professional',
          language: options.language || 'fr'
        },
        { headers }
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la génération de l\'email');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Calculer le score de matching
  const calculateMatchingScore = useCallback(async (applicationId, cvText = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = cvText ? `?cv_text=${encodeURIComponent(cvText)}` : '';
      const response = await axios.post(
        `${API_URL}/api/applications/${applicationId}/matching/calculate${params}`,
        {},
        { headers }
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du calcul du matching');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Récupérer le score de matching existant
  const getMatchingScore = useCallback(async (applicationId) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/applications/${applicationId}/matching`,
        { headers }
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [headers]);

  return {
    loading,
    error,
    getTimeline,
    addTimelineEvent,
    getPendingReminders,
    markReminderSent,
    generateFollowupEmail,
    calculateMatchingScore,
    getMatchingScore
  };
};
