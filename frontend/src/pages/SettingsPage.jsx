import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';
import { useStatistics } from '../hooks/useStatistics';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { useConfirmDialog } from '../components/ui/confirm-dialog';
import { User, Key, Globe, Save, Loader2, Bell, Trash2, AlertTriangle, Briefcase, Calendar, Smartphone, BellRing, Target, Chrome, Copy, Check, RefreshCw } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SettingsPage() {
  const { user, updateProfile, api } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { showConfirm, ConfirmDialog } = useConfirmDialog();
  const { preferences, fetchPreferences, updatePreferences } = useStatistics();
  const { 
    isSupported: pushSupported, 
    isSubscribed: pushSubscribed, 
    permission: pushPermission,
    loading: pushLoading, 
    subscribe: subscribePush, 
    unsubscribe: unsubscribePush,
    sendTestNotification 
  } = usePushNotifications();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [message, setMessage] = useState('');
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [extensionCode, setExtensionCode] = useState('');
  const [extensionCodeExpiry, setExtensionCodeExpiry] = useState('');
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    google_ai_key: '',
    openai_key: '',
    groq_key: ''
  });

  const [goalsData, setGoalsData] = useState({
    monthly_goal: 40,
    weekly_goal: 10
  });

  const [notifSettings, setNotifSettings] = useState({
    email_notifications: true,
    reminder_24h: true,
    reminder_1h: true,
    browser_notifications: true
  });

  const [calendarStatus, setCalendarStatus] = useState({
    configured: false,
    connected: false,
    email: null
  });
  const [calendarLoading, setCalendarLoading] = useState(false);

  const t = {
    fr: {
      title: 'Paramètres',
      subtitle: 'Gérez votre compte',
      profile: 'Profil',
      fullName: 'Nom complet',
      email: 'Email',
      apiKeys: 'Clés API',
      googleKey: 'Clé Google AI (Gemini)',
      openaiKey: 'Clé OpenAI',
      groqKey: 'Clé Groq',
      language: 'Langue',
      currentLang: 'Français',
      save: 'Enregistrer',
      saved: 'Enregistré !',
      switchTo: 'Passer en anglais',
      notifications: 'Notifications',
      emailNotif: 'Notifications par email',
      reminder24h: 'Rappel 24h avant l\'entretien',
      reminder1h: 'Rappel 1h avant l\'entretien',
      browserNotif: 'Notifications navigateur',
      calendar: 'Google Calendar',
      calendarDesc: 'Synchronisez vos entretiens avec Google Calendar',
      calendarConnected: 'Connecté',
      calendarDisconnected: 'Non connecté',
      connectCalendar: 'Connecter Google Calendar',
      disconnectCalendar: 'Déconnecter',
      calendarNotConfigured: 'Google Calendar n\'est pas configuré sur ce serveur',
      dangerZone: 'Zone de danger',
      dangerDesc: 'Actions irréversibles sur vos données',
      resetApplications: 'Réinitialiser les candidatures',
      resetApplicationsDesc: 'Supprimer toutes les candidatures et entretiens associés',
      resetInterviews: 'Réinitialiser les entretiens',
      resetInterviewsDesc: 'Supprimer uniquement les entretiens',
      confirmResetApps: 'Êtes-vous sûr de vouloir supprimer TOUTES vos candidatures et entretiens ? Cette action est irréversible !',
      confirmResetInterviews: 'Êtes-vous sûr de vouloir supprimer TOUS vos entretiens ? Cette action est irréversible !',
      resetSuccess: 'Données supprimées avec succès',
      resetting: 'Suppression...',
      // Push Notifications
      pushNotifications: 'Notifications Push',
      pushDesc: 'Recevez des alertes en temps réel sur votre appareil',
      pushEnabled: 'Notifications activées',
      pushDisabled: 'Notifications désactivées',
      pushEnable: 'Activer',
      pushDisable: 'Désactiver',
      pushTest: 'Tester',
      pushNotSupported: 'Votre navigateur ne supporte pas les notifications push',
      pushDenied: 'Vous avez bloqué les notifications. Activez-les dans les paramètres de votre navigateur.',
      // Goals
      goals: 'Objectifs',
      goalsDesc: 'Définissez vos objectifs de candidature',
      monthlyGoal: 'Objectif mensuel',
      weeklyGoal: 'Objectif hebdomadaire',
      goalsSaved: 'Objectifs enregistrés !',
      candidatures: 'candidatures',
      // Chrome Extension
      chromeExtension: 'Extension Chrome',
      chromeExtensionDesc: 'Connectez l\'extension pour ajouter des offres en un clic',
      generateCode: 'Générer un code',
      codeExpires: 'Expire dans 5 minutes',
      copyCode: 'Copier',
      copied: 'Copié !',
      extensionInstructions: 'Ouvrez l\'extension Chrome et entrez ce code dans l\'onglet "Code rapide"',
      newCode: 'Nouveau code'
    },
    en: {
      title: 'Settings',
      subtitle: 'Manage your account',
      profile: 'Profile',
      fullName: 'Full name',
      email: 'Email',
      apiKeys: 'API Keys',
      googleKey: 'Google AI Key (Gemini)',
      openaiKey: 'OpenAI Key',
      groqKey: 'Groq Key',
      language: 'Language',
      currentLang: 'English',
      save: 'Save',
      saved: 'Saved!',
      switchTo: 'Switch to French',
      notifications: 'Notifications',
      emailNotif: 'Email notifications',
      reminder24h: 'Reminder 24h before interview',
      reminder1h: 'Reminder 1h before interview',
      browserNotif: 'Browser notifications',
      calendar: 'Google Calendar',
      calendarDesc: 'Sync your interviews with Google Calendar',
      calendarConnected: 'Connected',
      calendarDisconnected: 'Not connected',
      connectCalendar: 'Connect Google Calendar',
      disconnectCalendar: 'Disconnect',
      calendarNotConfigured: 'Google Calendar is not configured on this server',
      dangerZone: 'Danger Zone',
      dangerDesc: 'Irreversible actions on your data',
      resetApplications: 'Reset applications',
      resetApplicationsDesc: 'Delete all applications and associated interviews',
      resetInterviews: 'Reset interviews',
      resetInterviewsDesc: 'Delete only interviews',
      confirmResetApps: 'Are you sure you want to delete ALL your applications and interviews? This action is irreversible!',
      confirmResetInterviews: 'Are you sure you want to delete ALL your interviews? This action is irreversible!',
      resetSuccess: 'Data deleted successfully',
      resetting: 'Deleting...',
      // Push Notifications
      pushNotifications: 'Push Notifications',
      pushDesc: 'Receive real-time alerts on your device',
      pushEnabled: 'Notifications enabled',
      pushDisabled: 'Notifications disabled',
      pushEnable: 'Enable',
      pushDisable: 'Disable',
      pushTest: 'Test',
      pushNotSupported: 'Your browser does not support push notifications',
      pushDenied: 'You have blocked notifications. Enable them in your browser settings.',
      // Goals
      goals: 'Goals',
      goalsDesc: 'Set your application goals',
      monthlyGoal: 'Monthly goal',
      weeklyGoal: 'Weekly goal',
      goalsSaved: 'Goals saved!',
      candidatures: 'applications',
      // Chrome Extension
      chromeExtension: 'Chrome Extension',
      chromeExtensionDesc: 'Connect the extension to add job offers in one click',
      generateCode: 'Generate code',
      codeExpires: 'Expires in 5 minutes',
      copyCode: 'Copy',
      copied: 'Copied!',
      extensionInstructions: 'Open the Chrome extension and enter this code in the "Quick code" tab',
      newCode: 'New code'
    }
  }[language];

  // Fetch notification settings
  useEffect(() => {
    const fetchNotifSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/notifications/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifSettings(response.data);
      } catch (error) {
        console.error('Error fetching notification settings:', error);
      }
    };
    fetchNotifSettings();
  }, []);

  // Fetch user goals/preferences
  useEffect(() => {
    const loadPreferences = async () => {
      const prefs = await fetchPreferences();
      if (prefs) {
        setGoalsData({
          monthly_goal: prefs.monthly_goal || 40,
          weekly_goal: prefs.weekly_goal || 10
        });
      }
    };
    loadPreferences();
  }, [fetchPreferences]);

  // Fetch Google Calendar status
  useEffect(() => {
    const fetchCalendarStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/calendar/auth/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCalendarStatus(response.data);
      } catch (error) {
        console.error('Error fetching calendar status:', error);
      }
    };
    fetchCalendarStatus();
    
    // Check URL params for calendar connection result
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('calendar_connected') === 'true') {
      fetchCalendarStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (urlParams.get('calendar_error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/calendar/auth/login`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Redirect to Google OAuth
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Error connecting calendar:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/calendar/disconnect`, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendarStatus({ configured: true, connected: false, email: null });
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      // Update profile name
      if (formData.full_name !== user?.full_name) {
        await updateProfile({ full_name: formData.full_name });
      }
      
      // Update API keys
      if (formData.google_ai_key || formData.openai_key || formData.groq_key) {
        await api.put('/api/auth/update-api-keys', null, {
          params: {
            google_ai_key: formData.google_ai_key || undefined,
            openai_key: formData.openai_key || undefined,
            groq_key: formData.groq_key || undefined
          }
        });
      }

      // Update notification settings
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/notifications/settings`, notifSettings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage(t.saved);
      setFormData(prev => ({ ...prev, google_ai_key: '', openai_key: '', groq_key: '' }));
    } catch (error) {
      setMessage('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleNotifChange = async (key, value) => {
    // Mise à jour locale immédiate pour UX réactive
    setNotifSettings(prev => ({ ...prev, [key]: value }));
    
    // Sauvegarder sur le serveur
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/notifications/settings`,
        { [key]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error saving notification settings:', error);
      // Rollback en cas d'erreur
      setNotifSettings(prev => ({ ...prev, [key]: !value }));
    }
  };

  const handleResetApplications = async () => {
    const confirmed = await showConfirm({
      title: t.resetApplications,
      message: t.confirmResetApps,
      type: 'danger',
      confirmText: language === 'fr' ? 'Supprimer tout' : 'Delete all',
      cancelText: language === 'fr' ? 'Annuler' : 'Cancel',
    });
    
    if (confirmed) {
      setResetting('applications');
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/applications/reset/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage(t.resetSuccess);
      } catch (error) {
        setMessage('Erreur lors de la suppression');
      } finally {
        setResetting(null);
      }
    }
  };

  const handleResetInterviews = async () => {
    const confirmed = await showConfirm({
      title: t.resetInterviews,
      message: t.confirmResetInterviews,
      type: 'danger',
      confirmText: language === 'fr' ? 'Supprimer' : 'Delete',
      cancelText: language === 'fr' ? 'Annuler' : 'Cancel',
    });
    
    if (confirmed) {
      setResetting('interviews');
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/interviews/reset/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage(t.resetSuccess);
      } catch (error) {
        setMessage('Erreur lors de la suppression');
      } finally {
        setResetting(null);
      }
    }
  };

  const handleSaveGoals = async () => {
    setGoalsLoading(true);
    try {
      await updatePreferences(goalsData);
      setMessage(t.goalsSaved);
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      setMessage('Erreur');
    } finally {
      setGoalsLoading(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-3xl font-bold text-white">{t.title}</h1>
        <p className="text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Main Grid Layout - 2 columns on large screens */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="glass-card rounded-xl p-6 border border-slate-800">
            <h2 className="font-heading text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User size={20} className="text-gold" />
              {t.profile}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.fullName}</label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t.email}</label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-slate-900/50 border-slate-700 text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="glass-card rounded-xl p-6 border border-slate-800">
            <h2 className="font-heading text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Bell size={20} className="text-gold" />
              {t.notifications}
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-slate-300">{t.reminder24h}</label>
                <Switch 
                  checked={notifSettings.reminder_24h}
                  onCheckedChange={(checked) => handleNotifChange('reminder_24h', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-slate-300">{t.reminder1h}</label>
                <Switch 
                  checked={notifSettings.reminder_1h}
                  onCheckedChange={(checked) => handleNotifChange('reminder_1h', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-slate-300">{t.browserNotif}</label>
                <Switch 
                  checked={notifSettings.browser_notifications}
                  onCheckedChange={(checked) => handleNotifChange('browser_notifications', checked)}
                />
              </div>
            </div>
          </div>

          {/* Push Notifications Section */}
          <div className="glass-card rounded-xl p-6 border border-slate-800">
            <h2 className="font-heading text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <BellRing size={20} className="text-gold" />
              {t.pushNotifications}
            </h2>
            <p className="text-slate-400 text-sm mb-4">{t.pushDesc}</p>
            
            {!pushSupported ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">{t.pushNotSupported}</p>
              </div>
            ) : pushPermission === 'denied' ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{t.pushDenied}</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    pushSubscribed ? 'bg-green-500/20' : 'bg-slate-700'
                  }`}>
                    <Smartphone size={20} className={pushSubscribed ? 'text-green-400' : 'text-slate-400'} />
                  </div>
                  <p className={pushSubscribed ? 'text-green-400 font-medium' : 'text-slate-400'}>
                    {pushSubscribed ? t.pushEnabled : t.pushDisabled}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {pushSubscribed && (
                    <Button
                      onClick={async () => {
                        try {
                          await sendTestNotification();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none border-slate-700 text-slate-300"
                    >
                      {t.pushTest}
                    </Button>
                  )}
                  <Button
                    onClick={pushSubscribed ? unsubscribePush : subscribePush}
                    disabled={pushLoading}
                    className={`flex-1 sm:flex-none ${pushSubscribed 
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30' 
                      : 'bg-gold hover:bg-gold-light text-[#020817]'
                    }`}
                  >
                    {pushLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : pushSubscribed ? t.pushDisable : t.pushEnable}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Goals Section */}
          <div className="glass-card rounded-xl p-6 border border-slate-800 border-gold/30 bg-gradient-to-br from-slate-900 to-slate-800">
            <h2 className="font-heading text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Target size={20} className="text-gold" />
              {t.goals}
            </h2>
            <p className="text-slate-400 text-sm mb-4">{t.goalsDesc}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t.monthlyGoal}
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    max="500"
                    value={goalsData.monthly_goal}
                    onChange={(e) => setGoalsData(prev => ({ ...prev, monthly_goal: parseInt(e.target.value) || 40 }))}
                    className="bg-slate-900/50 border-slate-700 text-white w-24"
                  />
                  <span className="text-slate-400 text-sm">{t.candidatures}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t.weeklyGoal}
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={goalsData.weekly_goal}
                    onChange={(e) => setGoalsData(prev => ({ ...prev, weekly_goal: parseInt(e.target.value) || 10 }))}
                    className="bg-slate-900/50 border-slate-700 text-white w-24"
                  />
                  <span className="text-slate-400 text-sm">{t.candidatures}</span>
                </div>
              </div>
              
              <Button
                onClick={handleSaveGoals}
                disabled={goalsLoading}
                className="w-full bg-gold hover:bg-gold-light text-[#020817]"
              >
                {goalsLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                {t.save}
              </Button>
            </div>
          </div>

          {/* Google Calendar Section */}
          <div className="glass-card rounded-xl p-6 border border-slate-800">
            <h2 className="font-heading text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-gold" />
              {t.calendar}
            </h2>
            <p className="text-slate-400 text-sm mb-4">{t.calendarDesc}</p>
            
            {!calendarStatus.configured ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">{t.calendarNotConfigured}</p>
              </div>
            ) : calendarStatus.connected ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Calendar size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-green-400 font-medium">{t.calendarConnected}</p>
                    {calendarStatus.email && (
                      <p className="text-slate-500 text-sm">{calendarStatus.email}</p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleDisconnectCalendar}
                  disabled={calendarLoading}
                  variant="outline"
                  className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  {calendarLoading ? <Loader2 className="animate-spin" size={16} /> : t.disconnectCalendar}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <Calendar size={20} className="text-slate-400" />
                  </div>
                  <p className="text-slate-400">{t.calendarDisconnected}</p>
                </div>
                <Button
                  onClick={handleConnectCalendar}
                  disabled={calendarLoading}
                  className="w-full sm:w-auto bg-gold hover:bg-gold-light text-[#020817]"
                >
                  {calendarLoading ? <Loader2 className="animate-spin" size={16} /> : t.connectCalendar}
                </Button>
              </div>
            )}
          </div>

          {/* Language Section */}
          <div className="glass-card rounded-xl p-6 border border-slate-800">
            <h2 className="font-heading text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe size={20} className="text-gold" />
              {t.language}
            </h2>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-300">{t.currentLang}</span>
              <Button 
                onClick={toggleLanguage}
                variant="outline"
                className="border-slate-700 text-slate-300"
              >
                {t.switchTo}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* API Keys Section */}
          <div className="glass-card rounded-xl p-6 border border-slate-800">
            <h2 className="font-heading text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Key size={20} className="text-gold" />
              {t.apiKeys}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t.googleKey}
                  {user?.has_google_ai_key && <span className="ml-2 text-green-400 text-xs">✓ Configurée</span>}
                </label>
                <Input
                  type="password"
                  value={formData.google_ai_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, google_ai_key: e.target.value }))}
                  placeholder="AIza..."
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t.openaiKey}
                  {user?.has_openai_key && <span className="ml-2 text-green-400 text-xs">✓ Configurée</span>}
                </label>
                <Input
                  type="password"
                  value={formData.openai_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, openai_key: e.target.value }))}
                  placeholder="sk-..."
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t.groqKey}
                  {user?.has_groq_key && <span className="ml-2 text-green-400 text-xs">✓ Configurée</span>}
                </label>
                <Input
                  type="password"
                  value={formData.groq_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, groq_key: e.target.value }))}
                  placeholder="gsk_..."
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Obtenez une clé gratuite sur <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">console.groq.com</a>
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone Section */}
          <div className="glass-card rounded-xl p-6 border border-red-900/50 bg-red-950/10">
            <h2 className="font-heading text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle size={20} />
              {t.dangerZone}
            </h2>
            <p className="text-slate-500 text-sm mb-6">{t.dangerDesc}</p>
            
            <div className="space-y-4">
              {/* Reset Interviews */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Calendar size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{t.resetInterviews}</p>
                    <p className="text-slate-500 text-sm">{t.resetInterviewsDesc}</p>
                  </div>
                </div>
                <Button
                  onClick={handleResetInterviews}
                  disabled={resetting !== null}
                  variant="outline"
                  size="sm"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 flex-shrink-0"
                >
                  {resetting === 'interviews' ? (
                    <><Loader2 className="animate-spin mr-2" size={14} />{t.resetting}</>
                  ) : (
                    <><Trash2 size={14} className="mr-2" />{t.resetInterviews}</>
                  )}
                </Button>
              </div>

              {/* Reset Applications */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/50 rounded-lg border border-red-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Briefcase size={20} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{t.resetApplications}</p>
                    <p className="text-slate-500 text-sm">{t.resetApplicationsDesc}</p>
                  </div>
                </div>
                <Button
                  onClick={handleResetApplications}
                  disabled={resetting !== null}
                  variant="outline"
                  size="sm"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 flex-shrink-0"
                >
                  {resetting === 'applications' ? (
                    <><Loader2 className="animate-spin mr-2" size={14} />{t.resetting}</>
                  ) : (
                    <><Trash2 size={14} className="mr-2" />{t.resetApplications}</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button - Full width at bottom */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={handleSave}
          disabled={loading}
          className="bg-gold hover:bg-gold-light text-[#020817]"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="mr-2" />}
          {t.save}
        </Button>
        {message && <span className="text-green-400 text-sm">{message}</span>}
      </div>

      {/* Confirm Dialog */}
      {ConfirmDialog}
    </div>
  );
}
