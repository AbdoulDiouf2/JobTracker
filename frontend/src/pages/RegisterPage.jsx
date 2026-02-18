import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useLanguage } from '../i18n';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Minimum 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
});

// Google Icon Component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, loginWithGoogle, loading } = useAuth();
  const { language } = useLanguage();
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data) => {
    setServerError('');
    const result = await registerUser(data.email, data.password, data.fullName);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setServerError(result.error);
    }
  };

  const handleGoogleSignup = () => {
    loginWithGoogle();
  };

  const t = {
    fr: {
      title: 'Créer un compte',
      subtitle: 'Commencez à suivre vos candidatures dès maintenant',
      fullName: 'Nom complet',
      email: 'Email',
      password: 'Mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      submit: 'S\'inscrire',
      googleSignup: 'S\'inscrire avec Google',
      or: 'ou',
      hasAccount: 'Déjà un compte ?',
      login: 'Se connecter',
      backToHome: 'Retour à l\'accueil'
    },
    en: {
      title: 'Create an account',
      subtitle: 'Start tracking your job applications now',
      fullName: 'Full name',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm password',
      submit: 'Sign up',
      googleSignup: 'Sign up with Google',
      or: 'or',
      hasAccount: 'Already have an account?',
      login: 'Sign in',
      backToHome: 'Back to home'
    }
  }[language];

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link to="/" className="flex justify-center mb-8">
          <img 
            src="/Tech-driven_job_tracking_logo_design-removebg-preview.png" 
            alt="MAADEC" 
            className="h-64"
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

          {/* Google Signup Button */}
          <Button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-6 rounded-xl mb-6 flex items-center justify-center gap-3"
            data-testid="google-signup-button"
          >
            <GoogleIcon />
            {t.googleSignup}
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0a0f1a] text-slate-500">{t.or}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.fullName}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  {...register('fullName')}
                  type="text"
                  placeholder="John Doe"
                  className="pl-10 bg-slate-900/50 border-slate-700 focus:border-gold text-white"
                  data-testid="register-name"
                />
              </div>
              {errors.fullName && (
                <p className="text-red-400 text-xs mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="vous@exemple.com"
                  className="pl-10 bg-slate-900/50 border-slate-700 focus:border-gold text-white"
                  data-testid="register-email"
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
                  data-testid="register-password"
                />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.confirmPassword}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input
                  {...register('confirmPassword')}
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 bg-slate-900/50 border-slate-700 focus:border-gold text-white"
                  data-testid="register-confirm-password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold hover:bg-gold-light text-[#020817] font-semibold py-6 rounded-xl mt-6"
              data-testid="register-submit"
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
              {t.hasAccount}{' '}
              <Link to="/login" className="text-gold hover:text-gold-light font-medium">
                {t.login}
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
