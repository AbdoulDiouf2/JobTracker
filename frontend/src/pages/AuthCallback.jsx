import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthCallback - Gère le retour de l'authentification Google
 * Récupère le session_id du fragment URL et l'échange contre un JWT
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleGoogleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      // Extract session_id from URL fragment
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        console.error('No session_id found in URL');
        navigate('/login', { replace: true });
        return;
      }

      const sessionId = sessionIdMatch[1];
      
      try {
        const result = await handleGoogleCallback(sessionId);
        
        if (result.success) {
          // Clear the hash and redirect to dashboard
          navigate('/dashboard', { replace: true });
        } else {
          console.error('Google auth failed:', result.error);
          navigate('/login', { 
            replace: true, 
            state: { error: result.error } 
          });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, [location.hash, handleGoogleCallback, navigate]);

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin text-gold mx-auto mb-4" size={48} />
        <p className="text-white text-lg">Connexion en cours...</p>
        <p className="text-slate-400 text-sm mt-2">Veuillez patienter</p>
      </div>
    </div>
  );
}
