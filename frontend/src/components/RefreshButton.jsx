import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n';
import { useRefresh } from '../contexts/RefreshContext';

export default function RefreshButton() {
  const { language } = useLanguage();
  const { triggerRefresh, isRefreshing } = useRefresh();

  const t = {
    fr: { tooltip: 'Rafraîchir les données' },
    en: { tooltip: 'Refresh data' }
  }[language];

  const handleRefresh = async () => {
    if (isRefreshing) return;
    await triggerRefresh();
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
