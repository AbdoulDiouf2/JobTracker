import { useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Hook pour traiter automatiquement les rappels d'entretiens.
 * Appelé au chargement du dashboard pour vérifier et envoyer les rappels.
 */
export function useReminders() {
  const processReminders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const { data } = await axios.post(
        `${API_URL}/api/reminders/process`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.reminders_24h_sent > 0 || data.reminders_1h_sent > 0) {
        console.log(`[Reminders] Envoyés: ${data.reminders_24h_sent} rappels 24h, ${data.reminders_1h_sent} rappels 1h`);
      }

      return data;
    } catch (error) {
      // Silently fail - reminders are not critical
      console.error('[Reminders] Erreur:', error.message);
      return null;
    }
  }, []);

  // Process reminders on mount
  useEffect(() => {
    processReminders();
    
    // Also process every 15 minutes while the app is open
    const interval = setInterval(processReminders, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [processReminders]);

  return { processReminders };
}
