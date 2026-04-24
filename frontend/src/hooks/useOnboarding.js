import { useAuth } from '../contexts/AuthContext';

export function useOnboarding() {
  const { token, updateUser, api } = useAuth();

  const completeStep = async (step, data = {}, skipped = false) => {
    await api.post('/api/onboarding/step', { step, data, skipped });
  };

  const completeWizard = async () => {
    const res = await api.post('/api/onboarding/complete');
    updateUser(res.data);
  };

  const markWelcomeShown = async () => {
    await api.post('/api/onboarding/welcome');
    updateUser({ welcome_shown: true });
  };

  return { completeStep, completeWizard, markWelcomeShown };
}
