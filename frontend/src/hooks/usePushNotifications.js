import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Convertir la clé VAPID base64 en Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Vérifier le support et l'état actuel
  useEffect(() => {
    const checkSupport = async () => {
      // Vérifier le support
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      setIsSupported(supported);
      
      if (!supported) return;
      
      // Vérifier la permission
      setPermission(Notification.permission);
      
      // Vérifier si déjà abonné
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('[Push] Erreur vérification subscription:', err);
      }
    };
    
    checkSupport();
  }, []);

  // S'abonner aux notifications push
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications non supportées');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Demander la permission
      const permResult = await Notification.requestPermission();
      setPermission(permResult);
      
      if (permResult !== 'granted') {
        setError('Permission refusée');
        setLoading(false);
        return false;
      }
      
      // Récupérer la clé VAPID du serveur
      const token = localStorage.getItem('token');
      const { data: vapidData } = await axios.get(
        `${API_URL}/api/notifications/push/vapid-key`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!vapidData.publicKey) {
        throw new Error('Clé VAPID non disponible');
      }
      
      // S'abonner via le Service Worker
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
      });
      
      // Envoyer la subscription au serveur
      const subscriptionJSON = subscription.toJSON();
      await axios.post(
        `${API_URL}/api/notifications/push/subscribe`,
        {
          subscription: {
            endpoint: subscriptionJSON.endpoint,
            keys: subscriptionJSON.keys
          },
          device_name: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setIsSubscribed(true);
      setLoading(false);
      return true;
      
    } catch (err) {
      console.error('[Push] Erreur subscription:', err);
      setError(err.message || 'Erreur lors de l\'activation');
      setLoading(false);
      return false;
    }
  }, [isSupported]);

  // Se désabonner
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Supprimer côté serveur
        const token = localStorage.getItem('token');
        await axios.delete(
          `${API_URL}/api/notifications/push/unsubscribe`,
          { 
            params: { endpoint: subscription.endpoint },
            headers: { Authorization: `Bearer ${token}` } 
          }
        );
        
        // Supprimer côté client
        await subscription.unsubscribe();
      }
      
      setIsSubscribed(false);
      setLoading(false);
      return true;
      
    } catch (err) {
      console.error('[Push] Erreur unsubscribe:', err);
      setError(err.message || 'Erreur lors de la désactivation');
      setLoading(false);
      return false;
    }
  }, []);

  // Envoyer une notification de test
  const sendTestNotification = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_URL}/api/notifications/push/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    } catch (err) {
      console.error('[Push] Erreur test:', err);
      throw err;
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}
