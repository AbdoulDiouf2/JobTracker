import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient";
import { LanguageProvider } from "./i18n";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { RefreshProvider } from "./contexts/RefreshContext";
import { ThemeProvider } from "next-themes";
import { Toaster, toast } from "@/components/ui/sonner";
import { useEffect, lazy, Suspense } from "react";

// Pages chargées immédiatement (critiques pour le rendu initial)
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallback from "./pages/AuthCallback";
import NotFoundPage from "./pages/NotFoundPage";

// Pages chargées à la demande (code splitting)
const DashboardPage    = lazy(() => import("./pages/DashboardPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const InterviewsPage   = lazy(() => import("./pages/InterviewsPage"));
const StatisticsPage   = lazy(() => import("./pages/StatisticsPage"));
const SettingsPage     = lazy(() => import("./pages/SettingsPage"));
const AIAdvisorPage    = lazy(() => import("./pages/AIAdvisorPage"));
const ImportExportPage = lazy(() => import("./pages/ImportExportPage"));
const DocumentsPage    = lazy(() => import("./pages/DocumentsPage"));
const SupportPage      = lazy(() => import("./pages/SupportPage"));
const OnboardingPage   = lazy(() => import("./pages/OnboardingPage"));
const ProfilePage      = lazy(() => import("./pages/ProfilePage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage  = lazy(() => import("./pages/ResetPasswordPage"));
const LegalNoticePage    = lazy(() => import("./pages/LegalNoticePage"));
const PrivacyPolicyPage  = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));

// Admin Pages
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage     = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminSupportPage   = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminTemplatesPage = lazy(() => import("./pages/admin/AdminTemplatesPage"));

// Layout
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

function OnboardingGuard({ children }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.onboarding_completed) return <Navigate to="/dashboard" />;
  return children;
}

// Router component that handles session_id detection
function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment for session_id SYNCHRONOUSLY during render (prevents race conditions)
  // This must happen BEFORE ProtectedRoute runs
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/legal" element={<LegalNoticePage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/onboarding" element={
        <OnboardingGuard>
          <OnboardingPage />
        </OnboardingGuard>
      } />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="interviews" element={<InterviewsPage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="ai-advisor" element={<AIAdvisorPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="import-export" element={<ImportExportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="support" element={<AdminSupportPage />} />
        <Route path="templates" element={<AdminTemplatesPage />} />
      </Route>

      {/* Catch-all Route for 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    const handlePWAUpdate = (event) => {
      const registration = event.detail;
      toast("Mise à jour disponible", {
        description: "Une nouvelle version de l'application est disponible.",
        action: {
          label: "Mettre à jour",
          onClick: () => {
            if (registration && registration.waiting) {
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
              });
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          },
        },
        duration: Infinity,
      });
    };

    window.addEventListener('pwa-update-available', handlePWAUpdate);
    return () => window.removeEventListener('pwa-update-available', handlePWAUpdate);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <RefreshProvider>
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <div className="min-h-screen bg-[#020817]">
                  <BrowserRouter>
                    <Suspense fallback={
                      <div className="min-h-screen bg-[#020817] flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-[#c4a052] border-t-transparent rounded-full animate-spin" />
                      </div>
                    }>
                      <AppRouter />
                    </Suspense>
                    <Toaster />
                  </BrowserRouter>
                </div>
              </ThemeProvider>
            </RefreshProvider>
          </AuthProvider>
        </LanguageProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
