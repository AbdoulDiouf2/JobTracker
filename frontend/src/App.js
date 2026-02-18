import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LanguageProvider } from "./i18n";
import { AuthProvider } from "./contexts/AuthContext";
import { RefreshProvider } from "./contexts/RefreshContext";

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
  return (
    <LanguageProvider>
      <AuthProvider>
        <RefreshProvider>
          <div className="min-h-screen bg-[#020817]">
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </div>
        </RefreshProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
