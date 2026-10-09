# Historique et décisions

## État réel

Légende : **I** implémenté sur `main` · **T** couvert par des tests automatisés · **P** validé en
production par un usage réel · **E** envisagé, non implémenté.

| Fonction | I | T | P | Remarque |
|---|:-:|:-:|:-:|---|
| Opportunités (boîte de réception, ignorer, candidater) | ✓ | ✓ | ✓ | Lot 1 |
| Jetons d'API agents (`/api/agent/opportunities`) | ✓ | ✓ | — | Lot 1 ; pas d'usage réel documenté |
| Veille : préférences, ingestion, quotas, idempotence | ✓ | ✓ | ✓ | Opportunités créées par ChatGPT et Claude |
| Six outils MCP | ✓ | ✓ | ✓ | Appels réels depuis ChatGPT, Claude, Claude Code (lecture) |
| OAuth P1 : clients confidentiels multi-client | ✓ | ✓ | ✓ | ChatGPT et Claude web |
| Provenance « Veille {client} » | ✓ | ✓ | ✓ | |
| Filtres, tri, facettes des opportunités | ✓ | ✓ | — | Déployés ; recette fonctionnelle à confirmer |
| OAuth P2 : clients publics, retours locaux, scopes par client | ✓ | ✓ | — | Aucun client public manuel connecté |
| Isolation des exécutions par client | ✓ | ✓ | — | Effective dès que deux agents partagent un créneau |
| OAuth P3 : CIMD | ✓ | ✓ | ✓ | **Claude Code validé le 9 octobre 2026** (connexion, lecture) |
| Codex via CIMD | ✓ | ✓ | — | Non validé en connexion réelle |
| VS Code via CIMD | ✓ | ✓ | — | Non validé en connexion réelle |
| DCR (enregistrement dynamique) | — | — | — | Non implémenté (décision D-P3-2) |
| Écran des critères et de l'historique de veille | — | — | — | **E** (API seulement) |
| Filtres Métier / Date de publication / Compétences | — | — | — | **E** : données non enregistrées |
| Planificateur (rappels) sur Vercel | — | — | — | Ne tourne pas (`lifespan` absent) ; déclenchement manuel |

## Journal des évolutions

| Date | Commit | Évolution |
|---|---|---|
| 2026-02 → 2026-06 | — | Socle SaaS : candidatures, entretiens, statistiques, IA, documents, extension Chrome, administration, rappels |
| 2026-10-08 | `1286fba` | Lot 1 : boîte de réception des opportunités et dépôt sécurisé par jeton d'API |
| 2026-10-08 | `ef07ab6` | S3 : refus des secrets de signature faibles ou publiés |
| 2026-10-09 | `c11571a` | Veille : préférences, ingestion, quotas, source réservée |
| 2026-10-09 | `ebc57e9`, `08e668f`, `4c72632` | Transport MCP dormant, serveur OAuth 2.1, page de consentement |
| 2026-10-09 | `7f2934a` | A0 : double clé de production, interrupteur fermé par défaut |
| 2026-10-09 | `5ffd16a` | Gestion du client OAuth depuis les paramètres |
| 2026-10-09 | `c170c57` | Cinq outils MCP métier ; premier test métier ChatGPT → JobTracker validé |
| 2026-10-09 | `1e14176` | **P1** : OAuth multi-client, consentement générique, traçabilité du client |
| 2026-10-09 | `24d991a`, `9d8d837` | Provenance par client ; filtres, tri et facettes des opportunités |
| 2026-10-09 | `ca9942c` | **P2** : clients publics, retours locaux, scopes par client, isolation des exécutions |
| 2026-10-09 | `4ee381b` | Cartes repliables des applications clientes |
| 2026-10-09 | `f3327b1` | **P3** : CIMD avec politique de confiance |
| 2026-10-09 | — | Connexion réelle de Claude Code via CIMD et appels MCP en lecture réussis |

Les rapports détaillés de chaque étape sont archivés dans [archives/lot2/](./archives/lot2/).

## Décisions d'architecture

| # | Décision | Raison |
|---|---|---|
| D-L2-1 | Les agents externes cherchent ; JobTracker ne fait aucune recherche ni appel sortant vers les offres | Pas de moteur de recherche à maintenir, pas de SSRF sur les URL d'offres |
| D-L2-2 | JobTracker est son propre serveur OAuth 2.1, jetons opaques hachés | Révocation immédiate, état en base compatible serverless |
| D-L2-3 | Consentement par ticket de continuation | Le code d'autorisation ne transite jamais par le frontend |
| D-L2-4 | Double clé de production + interrupteur fermé par défaut | Une variable posée par erreur n'ouvre rien ; coupure sans redéploiement |
| D-L2-5 | `run_id` déterministe en heure de Paris, trois niveaux d'idempotence | Reprises et doublons sans écriture superflue |
| D-L2-6 | Quotas 20 par exécution, 40 par jour et par compte | Plafond cumulatif quel que soit le nombre d'agents |
| D-P1-1 | `source=chatgpt_watch` conservé ; provenance réelle dans `watch.client_id` | Compatibilité des données et du Lot 2 |
| D-P1-2 | Unicité des noms de clients, adresses de retour partagées signalées | Lisibilité sans bloquer les configurations légitimes |
| D-P2-1 | Clients publics sans secret, sécurité par PKCE et retour exact | Applications natives |
| D-P2-2 | Retours locaux `127.0.0.1` / `[::1]` port libre, `localhost` refusé aux clients manuels | RFC 8252 |
| D-P2-3 | Clé d'exécution `run_id#client_id`, quota journalier commun | Pas de collision entre agents ; plafond global inchangé |
| D-P2-4 | Scopes effectifs = autorisation ∩ client, recalculés à chaque appel | Réduction immédiate, jamais d'élargissement implicite |
| D-P3-1 | CIMD sous politique de confiance désactivée par défaut, lecture seule par défaut | Pas d'accès ouvert à un client inconnu |
| D-P3-2 | **DCR non implémenté** | Aucun client ciblé n'en a besoin ; surface d'attaque ; MCP le rend facultatif |
| D-P3-3 | `localhost` admis seulement pour CIMD | Requis par Claude Code et Codex |
| D-P3-4 | Client CIMD créé après consentement approuvé ; politique revérifiée à l'émission et à l'échange du code | Pas d'enregistrement anonyme ; aucune autorisation après retrait d'un domaine |
| D-P3-5 | Changement de politique sans effet sur les jetons existants | Pas de coupure surprise ; coupure explicite par désactivation du client |
| D-P3-6 | IPv4 transportée par les formes IPv6 de transition contrôlée | Python classe NAT64/6to4 comme « globales » |

## Questions ouvertes

- Codex et VS Code : premier essai réel à mener.
- `schedule.times` ne couvre pas les créneaux de Claude (09:00, 19:00) : voir
  [VEILLE-PROGRAMMEE.md](./VEILLE-PROGRAMMEE.md#interpréter-get_watch_status).
- Dette S1 et S2 ([DETTE-SECURITE.md](./DETTE-SECURITE.md)).
- Correctif des modèles Gemini préparé mais non appliqué ([archives/gemini/](./archives/gemini/)).
