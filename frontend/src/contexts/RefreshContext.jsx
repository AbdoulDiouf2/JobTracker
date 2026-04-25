import { createContext, useContext, useState, useCallback } from 'react';
import { queryClient } from '../lib/queryClient';

const RefreshContext = createContext();

export function RefreshProvider({ children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsRefreshing(false);
  }, []);

  return (
    <RefreshContext.Provider value={{ isRefreshing, triggerRefresh }}>
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
