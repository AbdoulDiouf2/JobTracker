import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useLanguage } from '../i18n';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères')
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const { language } = useLanguage();
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data) => {
    setServerError('');
    const result = await login(data.email, data.password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setServerError(result.error);
    }
  };

  const t = {
    fr: {
      title: 'Connexion',
      subtitle: 'Accédez à votre espace de suivi de candidatures',
      email: 'Email',
      password: 'Mot de passe',
      submit: 'Se connecter',
      noAccount: 'Pas encore de compte ?',
      register: 'S\'inscrire',
      backToHome: 'Retour à l\'accueil'
    },
    en: {
      title: 'Login',
      subtitle: 'Access your job application tracking space',
      email: 'Email',
      password: 'Password',
      submit: 'Sign in',
      noAccount: 'Don\'t have an account?',
      register: 'Sign up',
      backToHome: 'Back to home'
    }
  }[language];

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link to="/" className="flex justify-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_careernav-3/artifacts/2hooa0lk_logo_maadec_copie.png" 
            alt="MAADEC" 
            className="h-16"
          />
        </Link>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8 border border-slate-800">
          <div className="text-center mb-8">
            <h1 className="font-heading text-2xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-slate-400 text-sm">{t.subtitle}</p>
          </div>

          {serverError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="vous@exemple.com"
                  className="pl-10 bg-slate-900/50 border-slate-700 focus:border-gold text-white"
                  data-testid="login-email"
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 bg-slate-900/50 border-slate-700 focus:border-gold text-white"
                  data-testid="login-password"
                />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold hover:bg-gold-light text-[#020817] font-semibold py-6 rounded-xl"
              data-testid="login-submit"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {t.submit}
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              {t.noAccount}{' '}
              <Link to="/register" className="text-gold hover:text-gold-light font-medium">
                {t.register}
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm">
            ← {t.backToHome}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
