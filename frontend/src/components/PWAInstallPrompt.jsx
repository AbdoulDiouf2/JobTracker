import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from './ui/button';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Vérifier si l'utilisateur a déjà refusé
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      // Réafficher après 7 jours
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Écouter l'événement beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Attendre un peu avant d'afficher le prompt
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Écouter si l'app est installée
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('[PWA] Installation acceptée');
    } else {
      console.log('[PWA] Installation refusée');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fade-in-up">
      <div className="bg-slate-900 border border-gold/30 rounded-xl p-4 shadow-lg shadow-gold/10">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
            <Smartphone size={24} className="text-gold" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold mb-1">Installer l'application</h3>
            <p className="text-slate-400 text-sm mb-3">
              Accédez rapidement à JobTracker depuis votre écran d'accueil, même hors ligne !
            </p>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleInstall}
                size="sm"
                className="bg-gold hover:bg-gold-light text-slate-900 font-medium"
              >
                <Download size={16} className="mr-1" />
                Installer
              </Button>
              <Button 
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white"
              >
                Plus tard
              </Button>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
