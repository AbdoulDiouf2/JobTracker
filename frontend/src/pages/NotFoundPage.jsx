import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MoveLeft, Home } from "lucide-react";

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#020817] text-white px-4 text-center">
      <div className="space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
        <h1 className="text-9xl font-extrabold text-[#3b82f6]">404</h1>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Oups ! Page non trouvée</h2>
          <p className="text-gray-400">
            Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button
            asChild
            variant="outline"
            className="border-gray-700 hover:bg-gray-800 text-white"
          >
            <Link to={-1} className="flex items-center gap-2">
              <MoveLeft className="w-4 h-4" />
              Retour
            </Link>
          </Button>
          <Button
            asChild
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            <Link to="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Accueil
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
