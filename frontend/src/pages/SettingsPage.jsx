import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { useConfirmDialog } from '../components/ui/confirm-dialog';
import { User, Key, Globe, Save, Loader2, Bell, Trash2, AlertTriangle, Briefcase, Calendar } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SettingsPage() {
  const { user, updateProfile, api } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { showConfirm, ConfirmDialog } = useConfirmDialog();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [message, setMessage] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    google_ai_key: '',
    openai_key: '',
    groq_key: ''
  });

  const [notifSettings, setNotifSettings] = useState({
    email_notifications: true,
    reminder_24h: true,
    reminder_1h: true,
    browser_notifications: true
  });

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
      dangerZone: 'Zone de danger',
      dangerDesc: 'Actions irréversibles sur vos données',
      resetApplications: 'Réinitialiser les candidatures',
      resetApplicationsDesc: 'Supprimer toutes les candidatures et entretiens associés',
      resetInterviews: 'Réinitialiser les entretiens',
      resetInterviewsDesc: 'Supprimer uniquement les entretiens',
      confirmResetApps: 'Êtes-vous sûr de vouloir supprimer TOUTES vos candidatures et entretiens ? Cette action est irréversible !',
      confirmResetInterviews: 'Êtes-vous sûr de vouloir supprimer TOUS vos entretiens ? Cette action est irréversible !',
      resetSuccess: 'Données supprimées avec succès',
      resetting: 'Suppression...'
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
      dangerZone: 'Danger Zone',
      dangerDesc: 'Irreversible actions on your data',
      resetApplications: 'Reset applications',
      resetApplicationsDesc: 'Delete all applications and associated interviews',
      resetInterviews: 'Reset interviews',
      resetInterviewsDesc: 'Delete only interviews',
      confirmResetApps: 'Are you sure you want to delete ALL your applications and interviews? This action is irreversible!',
      confirmResetInterviews: 'Are you sure you want to delete ALL your interviews? This action is irreversible!',
      resetSuccess: 'Data deleted successfully',
      resetting: 'Deleting...'
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

  const handleNotifChange = (key, value) => {
    setNotifSettings(prev => ({ ...prev, [key]: value }));
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

  return (
    <div className="max-w-2xl space-y-8" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-3xl font-bold text-white">{t.title}</h1>
        <p className="text-slate-400 mt-1">{t.subtitle}</p>
      </div>

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
        </div>
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

      {/* Save Button */}
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

      {/* Danger Zone Section */}
      <div className="glass-card rounded-xl p-6 border border-red-900/50 bg-red-950/10">
        <h2 className="font-heading text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
          <AlertTriangle size={20} />
          {t.dangerZone}
        </h2>
        <p className="text-slate-500 text-sm mb-6">{t.dangerDesc}</p>
        
        <div className="space-y-4">
          {/* Reset Interviews */}
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
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
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
            >
              {resetting === 'interviews' ? (
                <><Loader2 className="animate-spin mr-2" size={16} />{t.resetting}</>
              ) : (
                <><Trash2 size={16} className="mr-2" />{t.resetInterviews}</>
              )}
            </Button>
          </div>

          {/* Reset Applications */}
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-red-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
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
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              {resetting === 'applications' ? (
                <><Loader2 className="animate-spin mr-2" size={16} />{t.resetting}</>
              ) : (
                <><Trash2 size={16} className="mr-2" />{t.resetApplications}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      {ConfirmDialog}
    </div>
  );
}
