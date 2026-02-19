import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LanguageProvider } from "./i18n";
import { AuthProvider } from "./contexts/AuthContext";
import { RefreshProvider } from "./contexts/RefreshContext";
import { ThemeProvider } from "next-themes";
import { Toaster, toast } from "@/components/ui/sonner";
import { useEffect } from "react";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallback from "./pages/AuthCallback";
import DashboardPage from "./pages/DashboardPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import InterviewsPage from "./pages/InterviewsPage";
import StatisticsPage from "./pages/StatisticsPage";
import SettingsPage from "./pages/SettingsPage";
import AIAdvisorPage from "./pages/AIAdvisorPage";
import ImportExportPage from "./pages/ImportExportPage";
import DocumentsPage from "./pages/DocumentsPage";
import LegalNoticePage from "./pages/LegalNoticePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import NotFoundPage from "./pages/NotFoundPage";


import SupportPage from "./pages/SupportPage";

// Admin Pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

// Layout
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";

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
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
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
    <LanguageProvider>
      <AuthProvider>
        <RefreshProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <div className="min-h-screen bg-[#020817]">
              <BrowserRouter>
                <AppRouter />
                <Toaster />
              </BrowserRouter>
            </div>
          </ThemeProvider>
        </RefreshProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
