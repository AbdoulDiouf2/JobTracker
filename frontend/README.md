# Frontend JobTracker (React)

```bash
cd frontend
yarn install
cp .env.example .env        # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start                  # http://localhost:3000
yarn build                  # production (build/)
CI=true yarn test --watchAll=false
```

- React 19 via Create React App et `craco` (alias `@` → `src/`, règles ESLint `react-hooks` au build).
- Tailwind CSS, composants Shadcn (`src/components/ui`), TanStack Query, React Router 7,
  Framer Motion, Recharts, `sonner` (notifications), `lucide-react` (icônes).
- Organisation : [Doc/ARCHITECTURE.md](../Doc/ARCHITECTURE.md#frontend-frontend) ;
  fonctionnalités : [Doc/FONCTIONNALITES.md](../Doc/FONCTIONNALITES.md).

## Repères

| Chemin | Rôle |
|---|---|
| `src/App.js` | Routes (`/dashboard/*`, `/admin/*`, `/oauth/consent`…) |
| `src/pages/OpportunitiesPage.jsx`, `src/components/opportunities/` | Opportunités, filtres, provenance |
| `src/components/settings/` | Paramètres → API / Agents (jetons, connexions OAuth / MCP) |
| `src/pages/OAuthConsentPage.jsx` | Page de consentement OAuth |
| `src/lib/` | Logique pure (filtres ↔ URL, retour OAuth) |
| `src/i18n/` | Traductions FR / EN |
| `src/__tests__/` | Tests |

Conventions : composants en exports nommés, pages en export par défaut, `data-testid` sur les
éléments interactifs, aucune émoticône comme icône (voir [`.claude/CLAUDE.md`](../.claude/CLAUDE.md)).
