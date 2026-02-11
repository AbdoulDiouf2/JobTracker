import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./i18n";
import LandingPage from "./pages/LandingPage";

function App() {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-[#020817]">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </LanguageProvider>
  );
}

export default App;
