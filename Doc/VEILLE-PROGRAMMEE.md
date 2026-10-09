# Veille programmée

## Qui fait quoi

| Rôle | Responsable |
|---|---|
| Programmer les exécutions (heures, fréquence) | **L'agent externe** (tâche programmée dans ChatGPT, dans Claude…) |
| Chercher les offres, les noter | L'agent externe |
| Fournir les critères | JobTracker (`get_watch_preferences`) |
| Valider, dédupliquer, appliquer les quotas, enregistrer | JobTracker (`create_opportunities`) |
| Constater la fin d'une exécution | JobTracker, via `report_watch_run` envoyé par l'agent |

**JobTracker ne déclenche aucune exécution** : aucune tâche planifiée côté serveur, aucun appel
sortant vers les agents. Les horaires ci-dessous sont ceux configurés **dans les agents** ; le
backend ne les garantit pas et ne les connaît que par le champ informatif `schedule` des
préférences.

## Configuration connue (octobre 2026)

| Agent | Horaires (Europe/Paris) | Où c'est défini |
|---|---|---|
| ChatGPT | 08:00 et 18:00 | Tâche programmée ChatGPT |
| Claude | 09:00 et 19:00 | Tâche programmée Claude |

Critères par défaut (`watch_preferences`, modifiables par `PUT /api/watch/preferences`, avec
contrôle de version) :

- pays : FR, CH, BE, LU ; contrat : CDI / permanent ; séniorité : junior, débutant, jeune diplômé ;
- métiers : data engineering, data science, big data, IA/ML, data analytics ;
- mots-clés : Data Engineer, Data Scientist, ML Engineer, Ingénieur Data ;
- exclusions : stage, alternance, senior, lead, freelance ; langues : fr, en ;
- score minimal 75 ; 20 offres au plus par exécution ;
- `schedule` : Europe/Paris, **08:00 et 18:00** (1 à 4 heures, informatif).

Il n'existe **pas d'interface** pour ces réglages : API `/api/watch/preferences`,
`/api/watch/status`, `/api/watch/runs` (session web, compte avec veille activée).

## Quotas

- **20 créations par exécution** (`min(max_per_run, WATCH_MAX_PER_RUN)`) ;
- **40 créations par jour et par compte**, tous agents confondus (`WATCH_DAILY_CREATE_QUOTA`) ;
- le « jour » est la date du `run_id` (heure de Paris), même si l'exécution déborde après minuit ;
- doublons et rejets ne consomment rien.

Avec deux agents à deux créneaux chacun, le plafond quotidien commun (40) peut être atteint
avant la dernière exécution : ses offres sont alors `rejected` (`daily_quota_reached`).

## Exécution programmée ou manuelle

| | Programmée | Manuelle |
|---|---|---|
| `run_id` | `veille-AAAAMMJJ-HHMM-prog`, `HHMM` = heure **prévue** | `veille-AAAAMMJJ-HHMM-manuel-xxxxxx`, minute réelle + suffixe aléatoire |
| Stabilité | Identique quel que soit le retard de l'agent | Unique par lancement |
| Contrôle | Heure absente de `schedule.times` → avertissement `slot_not_in_schedule` (accepté) | — |
| Créneaux manqués | Pris en compte | Ignorée |

Deux agents utilisant le même créneau ont des exécutions **séparées** (isolation par client).

## Interpréter `get_watch_status`

- **`last_run`** : dernière exécution reçue du compte, **tous agents confondus** (la plus récemment
  vue). `observed` = ce que JobTracker a constaté ; `report` = ce que l'agent a déclaré
  (`null` si aucun `report_watch_run`).
- **`remaining_today`** : créations encore possibles aujourd'hui (jour de Paris).
- **`presumed_missing_slots`** : créneaux de `schedule.times` des dernières 24 h, passés depuis plus
  de 30 min, pour lesquels **aucune** exécution programmée n'a été reçue. Indicatif, calculé
  seulement à la consultation ; aucune notification.

Conséquence de la configuration actuelle : `schedule.times` vaut 08:00/18:00. Les exécutions de
Claude à 09:00/19:00 portent donc l'avertissement `slot_not_in_schedule` si elles utilisent la forme
`prog`, et **une exécution Claude manquée n'est pas détectée**. Pour suivre aussi Claude, ajouter
09:00 et 19:00 à `schedule.times` (4 heures au plus) ; un créneau est alors considéré comme couvert
par une exécution programmée de **n'importe quel** agent.

## Diagnostic

| Constat | Vérification |
|---|---|
| Aucune nouvelle offre | `get_watch_status` : `last_run` récent ? `remaining_today` à 0 ? `active` à `false` ? |
| `last_run.report` à `null` | L'agent n'a pas appelé `report_watch_run` (exécution interrompue ou instruction incomplète) |
| Beaucoup de `rejected` | Raisons dans la réponse de `create_opportunities` (pays, contrat, score, URL…) |
| Beaucoup de `duplicate` | Offres déjà connues ; l'agent peut appeler `list_recent_opportunities` d'abord |
| `run_id_out_of_window` | `run_id` calculé en UTC au lieu de l'heure de Paris, ou reprise au-delà de 24 h |
| Créneau signalé manquant | La tâche n'a pas tourné, ou a utilisé un `run_id` `manuel` / une autre heure |
| 401 / 403 / 503 | Voir [GUIDES-CONNEXION.md](./GUIDES-CONNEXION.md#en-cas-déchec) |

Historique détaillé : `GET /api/watch/runs` (20 dernières exécutions par défaut, 50 au plus avec `limit`, `run_id` d'origine,
compteurs observés, rapport). Journaux Vercel : messages `watch_ingest` et `watch_report`
(compteurs, jamais le contenu des offres).
