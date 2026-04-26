import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020817] flex items-center justify-center p-6">
          <div className="glass-card rounded-2xl p-8 border border-slate-800 max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Quelque chose s'est mal passé</h2>
            <p className="text-slate-400 text-sm mb-6">
              Une erreur inattendue s'est produite. Rechargez la page pour continuer.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-[#c4a052] hover:bg-[#b8944a] text-[#020817] font-semibold"
            >
              <RefreshCw size={16} className="mr-2" />
              Recharger
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
