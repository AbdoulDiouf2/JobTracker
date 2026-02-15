import { createContext, useContext, useState, useCallback } from 'react';

const RefreshContext = createContext();

export function RefreshProvider({ children }) {
  // Compteur qui change à chaque rafraîchissement
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    // Incrémenter le compteur pour déclencher les useEffect des composants
    setRefreshKey(prev => prev + 1);
    
    // Petit délai pour l'animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsRefreshing(false);
  }, []);

  return (
    <RefreshContext.Provider value={{ 
      refreshKey, 
      isRefreshing, 
      triggerRefresh 
    }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
}
