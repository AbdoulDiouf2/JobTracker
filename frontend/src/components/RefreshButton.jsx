import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n';

export default function RefreshButton({ onRefresh }) {
  const { language } = useLanguage();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const t = {
    fr: { tooltip: 'Rafraîchir les données' },
    en: { tooltip: 'Refresh data' }
  }[language];

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      // Appeler la fonction de rafraîchissement passée en prop
      if (onRefresh) {
        await onRefresh();
      }
      
      // Recharger la page actuelle pour rafraîchir toutes les données
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      // Le setIsRefreshing ne sera pas atteint si on recharge la page
      // mais c'est là au cas où on change l'implémentation
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200 disabled:opacity-50"
      title={t.tooltip}
      data-testid="refresh-button"
    >
      <RefreshCw 
        size={22} 
        className={`transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`}
      />
    </button>
  );
}
