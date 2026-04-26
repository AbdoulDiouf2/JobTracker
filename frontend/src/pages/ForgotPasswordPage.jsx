import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Email invalide'),
});

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      await api.post('/api/auth/forgot-password', { email: data.email });
      setSent(true);
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
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Email envoyé</h1>
              <p className="text-slate-400 text-sm mb-6">
                Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans les prochaines minutes.
              </p>
              <Link to="/login" className="text-[#c4a052] hover:underline text-sm font-medium">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Mot de passe oublié</h1>
                <p className="text-slate-400 text-sm">
                  Entrez votre email et nous vous enverrons un lien de réinitialisation.
                </p>
              </div>

              {serverError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                      {...register('email')}
                      type="email"
                      placeholder="vous@exemple.com"
                      className="pl-10 bg-slate-900/50 border-slate-700 focus:border-[#c4a052] text-white"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#c4a052] hover:bg-[#b8944a] text-[#020817] font-semibold py-6 rounded-xl"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Envoyer le lien'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm"
                >
                  <ArrowLeft size={16} />
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
