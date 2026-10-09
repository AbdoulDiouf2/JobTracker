# Documentation JobTracker

Documentation de référence, alignée sur le code de `main` (octobre 2026). En cas d'écart, le
code et les tests font foi : signaler l'écart et corriger le document.

| Je veux… | Document |
|---|---|
| Comprendre l'architecture et l'organisation du code | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Installer, configurer, lancer les tests | [INSTALLATION-ET-CONFIGURATION.md](./INSTALLATION-ET-CONFIGURATION.md) |
| Connaître les fonctionnalités | [FONCTIONNALITES.md](./FONCTIONNALITES.md) |
| Utiliser ou intégrer le serveur MCP | [MCP-REFERENCE.md](./MCP-REFERENCE.md) |
| Comprendre l'OAuth (P1, P2, P3, CIMD) | [OAUTH.md](./OAUTH.md) |
| Connecter ChatGPT, Claude, Claude Code, Codex, VS Code | [GUIDES-CONNEXION.md](./GUIDES-CONNEXION.md) |
| Comprendre et diagnostiquer la veille programmée | [VEILLE-PROGRAMMEE.md](./VEILLE-PROGRAMMEE.md) |
| Sécurité : frontières, révocation, interrupteur, secrets | [SECURITE.md](./SECURITE.md) |
| Dette de sécurité connue | [DETTE-SECURITE.md](./DETTE-SECURITE.md) |
| Déployer, exploiter, dépanner, checklist post-déploiement | [DEPLOIEMENT-ET-EXPLOITATION.md](./DEPLOIEMENT-ET-EXPLOITATION.md) |
| Historique, décisions, état réel des fonctions | [HISTORIQUE-ET-DECISIONS.md](./HISTORIQUE-ET-DECISIONS.md) |
| Rapports d'étapes, spécifications et documents anciens | [archives/](./archives/README.md) |

Autres documents du dépôt :

- [README principal](../README.md)
- [Backend](../backend/README.md) · [Création d'un administrateur](../backend/ADMIN_SETUP.md)
- [Frontend](../frontend/README.md)
- [Extension Chrome](../chrome-extension/README.md) · [Publication de l'extension](../chrome-extension/DEPLOYMENT.md)
- Consignes pour les agents de développement : [`.claude/CLAUDE.md`](../.claude/CLAUDE.md), [`AGENTS.md`](../AGENTS.md)

## Identité visuelle

Logo officiel : [`public/JobTracker-Logo.png`](../public/JobTracker-Logo.png) (horizontal 3:1,
fond transparent, texte « JobTracker » inclus). L'application sert sa copie
[`frontend/public/JobTracker-Logo.png`](../frontend/public/JobTracker-Logo.png) (`/JobTracker-Logo.png`) :
barre latérale, en-tête mobile, page d'accueil, connexion, inscription, support. Les favicons et
icônes PWA (`frontend/public/icons/`) ne sont pas encore dérivés du nouveau logo.

## Règles de rédaction

- Aucun secret, jeton, code d'autorisation, identifiant de client réel ni mot de passe.
- Distinguer : implémenté, testé automatiquement, validé en production, envisagé.
- Documenter les limites réelles ; ne pas annoncer une compatibilité sans essai.
