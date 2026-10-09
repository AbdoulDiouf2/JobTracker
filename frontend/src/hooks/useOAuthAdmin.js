import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export const OAUTH_ADMIN_KEY = ['admin-oauth'];
const STATUS_KEY = [...OAUTH_ADMIN_KEY, 'status'];
const CLIENTS_KEY = [...OAUTH_ADMIN_KEY, 'clients'];
const GRANTS_KEY = [...OAUTH_ADMIN_KEY, 'grants'];
const BASE = '/api/admin/oauth';

/**
 * Administration des connexions OAuth / MCP (A1.3). Routes réservées à l'admin,
 * indépendantes de l'interrupteur d'urgence.
 */
export const useOAuthAdmin = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: OAUTH_ADMIN_KEY });

  const status = useQuery({ queryKey: STATUS_KEY, queryFn: () => api.get(`${BASE}/status`).then(r => r.data) });
  const clients = useQuery({ queryKey: CLIENTS_KEY, queryFn: () => api.get(`${BASE}/clients`).then(r => r.data.items) });
  const grants = useQuery({ queryKey: GRANTS_KEY, queryFn: () => api.get(`${BASE}/grants`).then(r => r.data.items) });

  /**
   * Création et rotation : volontairement SANS useMutation. La réponse contient le
   * client_secret, qui ne doit jamais entrer dans le cache TanStack. Seul l'appelant le
   * reçoit, pour l'afficher une fois puis l'oublier.
   */
  const createClient = async ({ name, redirectUris }) => {
    const response = await api.post(`${BASE}/clients`, { name, redirect_uris: redirectUris });
    invalidate();
    return response.data;
  };

  const rotateSecret = async (clientId) => {
    const response = await api.post(`${BASE}/clients/${encodeURIComponent(clientId)}/rotate-secret`);
    invalidate();
    return response.data;
  };

  const addRedirectUri = useMutation({
    mutationFn: ({ clientId, redirectUri }) =>
      api.post(`${BASE}/clients/${encodeURIComponent(clientId)}/redirect-uris`, { redirect_uri: redirectUri })
        .then(r => r.data),
    onSuccess: invalidate,
  });

  const setClientActive = useMutation({
    mutationFn: ({ clientId, active }) =>
      api.put(`${BASE}/clients/${encodeURIComponent(clientId)}/active`, { active }).then(r => r.data),
    onSuccess: invalidate,
  });

  const revokeGrant = useMutation({
    mutationFn: (grantId) => api.delete(`${BASE}/grants/${encodeURIComponent(grantId)}`).then(r => r.data),
    onSuccess: invalidate,
  });

  const setKillSwitch = useMutation({
    mutationFn: (active) => api.put('/api/admin/settings/mcp-kill-switch', { active }).then(r => r.data),
    onSuccess: invalidate,
  });

  return {
    status, clients, grants,
    createClient, rotateSecret, addRedirectUri, setClientActive, revokeGrant, setKillSwitch,
  };
};
