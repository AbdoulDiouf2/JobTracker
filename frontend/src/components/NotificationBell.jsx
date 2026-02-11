import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2, X, Calendar, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useLanguage } from '../i18n';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function NotificationBell() {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const t = {
    fr: {
      title: 'Notifications',
      noNotifications: 'Aucune notification',
      markAllRead: 'Tout marquer comme lu',
      interview24h: 'Entretien dans 24h',
      interview1h: 'Entretien dans 1h',
      ago: 'il y a'
    },
    en: {
      title: 'Notifications',
      noNotifications: 'No notifications',
      markAllRead: 'Mark all as read',
      interview24h: 'Interview in 24h',
      interview1h: 'Interview in 1h',
      ago: 'ago'
    }
  }[language];

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  // Generate reminders on load
  const generateReminders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(`${API_URL}/api/notifications/generate-reminders`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refetch notifications after generating
      fetchNotifications();
    } catch (error) {
      console.error('Error generating reminders:', error);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    generateReminders();

    // Poll for new notifications every 60 seconds
    const interval = setInterval(() => {
      fetchNotifications();
      generateReminders();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications, generateReminders]);

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const notif = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notif && !notif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    if (type.includes('interview')) {
      return <Calendar className="text-gold" size={18} />;
    }
    return <AlertCircle className="text-blue-400" size={18} />;
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/50"
        data-testid="notification-bell"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#0a0f1a] border border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Bell size={18} className="text-gold" />
                  {t.title}
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="p-1.5 text-slate-400 hover:text-gold transition-colors"
                      title={t.markAllRead}
                    >
                      <CheckCheck size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 border-b border-slate-800 hover:bg-slate-800/30 transition-colors ${
                        !notif.read ? 'bg-gold/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${!notif.read ? 'text-white' : 'text-slate-300'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { 
                              addSuffix: true,
                              locale: language === 'fr' ? fr : enUS 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="p-1.5 text-slate-500 hover:text-green-400 transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notif.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <Bell size={32} className="mx-auto text-slate-700 mb-2" />
                    <p className="text-slate-500 text-sm">{t.noNotifications}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
