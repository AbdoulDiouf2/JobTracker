import { Bot, KeyRound, PlugZap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../i18n';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { AgentTokensSection } from './AgentTokensSection';
import { OAuthConnectionsPanel } from './OAuthConnectionsPanel';

const T = {
  fr: { title: 'API / Agents', tokens: 'Tokens API', oauth: 'Connexions OAuth / MCP' },
  en: { title: 'API / Agents', tokens: 'API tokens', oauth: 'OAuth / MCP connections' },
};

const TRIGGER = 'flex-1 sm:flex-none gap-1.5 whitespace-normal text-center text-slate-400 transition-colors hover:text-white ' +
  'data-[state=active]:bg-gold data-[state=active]:text-[#020817]';

/**
 * Paramètres → API / Agents. Utilisateur standard : section des tokens inchangée.
 * Administrateur : deux espaces distincts, « Tokens API » et « Connexions OAuth / MCP ».
 */
export const ApiAgentsSection = () => {
  const { isAdmin } = useAuth();
  const { language } = useLanguage();
  const t = T[language];

  if (!isAdmin) return <AgentTokensSection />;

  return (
    <section data-testid="api-agents-section">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
        <Bot size={20} className="text-gold" aria-hidden="true" />
        {t.title}
      </h2>
      <Tabs defaultValue="tokens" className="flex flex-col gap-3">
        <TabsList className="w-full sm:w-auto self-start h-auto bg-slate-900/60 border border-slate-800">
          <TabsTrigger value="tokens" className={TRIGGER} data-testid="api-agents-tab-tokens">
            <KeyRound size={14} aria-hidden="true" />
            {t.tokens}
          </TabsTrigger>
          <TabsTrigger value="oauth" className={TRIGGER} data-testid="api-agents-tab-oauth">
            <PlugZap size={14} aria-hidden="true" />
            {t.oauth}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tokens" className="mt-0">
          <AgentTokensSection embedded />
        </TabsContent>
        <TabsContent value="oauth" className="mt-0">
          <div className="glass-card rounded-xl p-4 sm:p-6 border border-slate-800">
            <OAuthConnectionsPanel />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
};
