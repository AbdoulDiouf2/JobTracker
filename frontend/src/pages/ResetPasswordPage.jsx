import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../contexts/AuthContext';

const schema = z.object({
  new_password: z.string().min(8, 'Minimum 8 caractères'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm_password'],
});

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 border border-slate-800 text-center max-w-md w-full">
          <p className="text-red-400 mb-4">Lien invalide ou manquant.</p>
          <Link to="/forgot-password" className="text-[#c4a052] hover:underline text-sm">
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data) => {
    setServerError('');
    try {
      await api.post('/api/auth/reset-password', {
        token,
        new_password: data.new_password,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Une erreur est survenue');
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-2xl p-8 border border-slate-800">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Mot de passe réinitialisé</h1>
              <p className="text-slate-400 text-sm">Redirection vers la connexion...</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Nouveau mot de passe</h1>
                <p className="text-slate-400 text-sm">Choisissez un mot de passe sécurisé (min. 8 caractères).</p>
              </div>

              {serverError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                      {...register('new_password')}
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-slate-900/50 border-slate-700 focus:border-[#c4a052] text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.new_password && <p className="text-red-400 text-xs mt-1">{errors.new_password.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Confirmer le mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                      {...register('confirm_password')}
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-slate-900/50 border-slate-700 focus:border-[#c4a052] text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirm_password && <p className="text-red-400 text-xs mt-1">{errors.confirm_password.message}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#c4a052] hover:bg-[#b8944a] text-[#020817] font-semibold py-6 rounded-xl"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Réinitialiser le mot de passe'}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
