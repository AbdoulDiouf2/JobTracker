# JobTracker — Lot 2 V2 · Étape 2 : rapport final de validation (fondations backend)

> **Référence** : [LOT2-V2-ETAPE-2-PLAN.md](./LOT2-V2-ETAPE-2-PLAN.md) (approuvé avec P1 à P6) ·
> [LOT2-V2-ETAPE-1-SPECIFICATION.md](./LOT2-V2-ETAPE-1-SPECIFICATION.md), **révision 1.3**.
> **Date** : 8 octobre 2026 · **Statut** : **validé** (R0 retenue, R1 reportée, R2 écartée). Il intègre
> les 4 vérifications demandées à l'acceptation (§2).
> Implémentation **locale** uniquement : aucun commit, push, déploiement ni changement de
> production. Aucun MCP, OAuth, frontend ni `vercel.json`. Aucune route HTTP d'ingestion.
> L'étape 3 n'a pas commencé.

## 1. Résultat (décompte exact de la dernière exécution)

Source : sortie de `bash tests/run_mongo_tests.sh` (MongoDB 7 éphémère). Les comptes sont ceux
des lignes `PASSED` par fichier, et leur total est égal à la ligne de synthèse de pytest :
**`618 passed`, 0 échec, 0 ignoré** (110 s).

| Fichier | Tests | Groupe |
|---|---|---|
| `test_agent_api.py` | 39 | Lot 1 |
| `test_agent_token_service.py` | 22 | Lot 1 |
| `test_job_urls.py` | 26 | Lot 1 |
| `test_lot1_e2e.py` | 4 | Lot 1 |
| `test_opportunity_api.py` | 36 | Lot 1 |
| `test_opportunity_conversion.py` | 36 | Lot 1 |
| `test_opportunity_service.py` | 30 | Lot 1 |
| `test_to_apply_status.py` | 22 | Lot 1 |
| `test_security_settings.py` | 45 | S3 (JWT forgés, expirés, `alg=none`…) |
| **Sous-total Lot 1 et S3** | **260** | Inchangé par cette étape |
| `test_watch_validation.py` | 208 | Veille (dont 27 nouveaux pour la Public Suffix List) |
| `test_watch_ingest.py` | 113 | Veille (dont 2 nouveaux sur l'arrêt brutal) |
| `test_watch_api.py` | 30 | Veille |
| `test_watch_preferences.py` | 7 | Veille |
| **Sous-total veille** | **358** | |
| **Total** | **618** | 260 + 358 |

**Frontend** : 42 réussis sur 5 suites (`yarn test`). Aucun fichier frontend n'a été modifié
depuis.

**Concurrence** : 4 scénarios répétés 20 fois chacun (80 tests), verts à chaque passage complet
(trois au total) et lors d'un passage isolé supplémentaire.

## 2. Vérifications demandées à l'acceptation

### 2.1 Domaines : Public Suffix List

**Avant** : le domaine enregistrable était approché par les deux derniers labels. `a.co.uk` et
`b.co.uk` étaient donc vus comme un même site, et une redirection de l'un vers l'autre
n'était pas détectée.

**Après** : utilisation de la bibliothèque **`publicsuffixlist==1.0.2.20261007`**.
- Pur Python, sans dépendance, avec la liste PSL **embarquée** (datée du 7 octobre 2026) : aucun
  accès réseau à l'exécution. Version épinglée dans `requirements.txt`.
- **Nouvelle dépendance** : seule ajoutée en plus de `tzdata`. Pas de `mcp`.

| Règle | Comportement |
|---|---|
| Domaine enregistrable (eTLD+1) | `careers.acme.co.uk` → `acme.co.uk` ; `team.github.io` → `team.github.io` (sections ICANN **et** privées de la liste) |
| Hôte **égal** à un suffixe public (`co.uk`, `github.io`, `com`) | Refusé, `url_host_forbidden` |
| Suffixe **inconnu** de la liste (`jobs.company.notatld`) | Refusé, `url_host_forbidden` (remplace l'ancien contrôle syntaxique) |
| Redirection vers un **autre** domaine enregistrable (`a.co.uk` → `b.co.uk`, `x.github.io` → `y.github.io`) | Refusée, `url_redirector_forbidden` |
| Redirection vers une cible **indéterminable** | Refusée (prudence) |
| Sous-domaine d'un raccourcisseur (`go.bit.ly`) | Refusé |
| Redirection vers le **même** site (`jobs.a.co.uk` → `careers.a.co.uk`) | Acceptée |
| Preuve (`source_evidence`) sur un autre domaine enregistrable | Offre acceptée, `url` marquée incertaine |

Toutes les protections précédentes sont conservées : HTTPS, identifiants, IP littérales,
`localhost`, suffixes locaux, port, longueur, caractères de contrôle, IDN. Le §5.7 de la
spécification est mis à jour.

**Maintenance** : la liste évolue. Il faudra mettre à jour la version épinglée périodiquement,
par exemple à chaque lot. Un suffixe créé après le 7 octobre 2026 serait refusé
(`url_host_forbidden`) jusqu'à la mise à jour : c'est un refus prudent, sans faille de sécurité.

### 2.2 Usages de `source="chatgpt_watch"` (sans accès à la production)

**Vérifié dans le dépôt**, sur tous les fichiers suivis et non suivis, hors `node_modules` et
`venv` :

| Chemin | Usage | Effet de P3 |
|---|---|---|
| `chrome-extension/` | **Aucun.** L'extension crée des **candidatures** (`/api/applications`), pas des opportunités | Aucun |
| `frontend/src` | Libellé d'affichage « Veille ChatGPT » uniquement. Le frontend ne crée aucune opportunité | Aucun : les opportunités existantes restent affichées |
| `landing-page/` | Aucun | Aucun |
| Backend : routes manuelle et agent | Refus `422 source_reserved` (P3) | Voulu |
| Backend : service `ingest_opportunity` | Accepte toujours `chatgpt_watch` : c'est le chemin interne de la veille | Voulu |
| Tests de service du Lot 1 | Utilisent `chatgpt_watch` au niveau service | Aucun |
| Documentation du Lot 1 (`LOT1-OPPORTUNITES-CHECKPOINT.md`) | **L'exemple officiel de l'API agent utilisait `"source": "chatgpt_watch"`** | **Corrigé** : exemple passé à `external_agent`, avec une note sur la réservation |

**Non vérifiable sans accès à la production** :
1. si des **AgentTokens** existent et sont utilisés par un client **hors dépôt** (script, GPT
   personnalisé, automatisation) qui suivrait l'ancien exemple ;
2. si des opportunités `chatgpt_watch` ont déjà été créées par l'API agent.

**Risque résiduel** : après déploiement, un tel client recevrait `422 source_reserved`. Aucune
donnée ne serait perdue, et les opportunités existantes restent intactes. Impact : ses nouveaux
envois seraient refusés jusqu'à ce qu'il change de source. Probabilité jugée faible : le seul
client prévu, la veille ChatGPT, passera par le MCP.

**Vérification proposée, à faire par toi avant le déploiement** (lecture seule) :
- dans JobTracker, page des jetons agent : jetons actifs et leur « dernière utilisation » ;
- dans Opportunités : présence d'offres de source « Veille ChatGPT » ;
- ou, en lecture seule sur la base : `db.opportunities.countDocuments({source: "chatgpt_watch"})`
  et `db.agent_tokens.find({revoked_at: null}, {name: 1, last_used_at: 1})`.

Si un jeton actif est utilisé récemment, il faudra décider avant le déploiement : changer la
source du client, ou accepter son refus.

### 2.3 Réservations de quotas abandonnées après un arrêt brutal

#### Correction apportée pendant cette vérification

En documentant les cas, j'ai trouvé un ordre d'opérations **dangereux** dans la libération :
la place était rendue **avant** d'effacer l'indicateur « réservé » de l'élément. Un arrêt entre
les deux aurait laissé un élément marqué réservé **sans place réelle**. La reprise aurait alors
créé sans réservation, avec un dépassement possible d'**une unité** d'un plafond (20 ou 40).

**Correction minimale** : l'indicateur est effacé **d'abord**, puis la place est rendue. Un arrêt
entre les deux laisse désormais une place bloquée, ce qui est prudent. Deux tests ont été
ajoutés :
- `test_crash_during_release_leaves_a_blocked_place_never_an_excess` ;
- `test_blocked_places_reduce_capacity_without_exceeding`.

**Règle d'ordre, désormais respectée partout** : réserver la place **puis** poser l'indicateur ;
effacer l'indicateur **puis** rendre la place. Tout arrêt brutal se traduit par une place en
trop bloquée, **jamais** par une place manquante.

#### Inventaire des cas

| Moment de l'arrêt | État laissé | Conséquence | Récupération actuelle |
|---|---|---|---|
| Après la réservation, **avant** l'indicateur | Place prise, non rattachée à l'élément | **1 place bloquée** | Aucune : la reprise réserve à nouveau |
| Après l'indicateur, avant la création | Élément `pending`, réservations rattachées | Places tenues | **Oui** : une reprise du même élément après 60 s réutilise ses réservations (testé) |
| Après la création, avant la finalisation | Offre créée, élément `pending` | Aucune | **Oui** : la reprise reconnaît l'offre de cette exécution et la compte comme créée (testé) |
| Pendant une libération, entre indicateur effacé et place rendue | Place prise, non rattachée | **1 place bloquée** | Aucune (testé) |
| Élément interrompu **jamais repris** | Réservations rattachées, tenues | Places bloquées | Aucune |

**Portée réelle** : une place bloquée réduit seulement la capacité **de cette exécution**
(plafond de 20) et **de ce jour de Paris** (plafond de 40). Elle disparaît d'elle-même avec
l'exécution et le jour suivants. Elle ne fait jamais dépasser un plafond. Chaque arrêt brutal
bloque **au plus une place par compteur**.

#### Proposition de récupération (non implémentée, à valider)

| Option | Principe | Sûreté | Recommandation |
|---|---|---|---|
| **R0** Statu quo et visibilité | Afficher dans le statut et l'historique les places bloquées (`reserved − created` par exécution) | Lecture seule | **Recommandée maintenant** : simple, sans risque |
| **R1** Libération des places **rattachées** | Lors d'un appel suivant sur la même exécution (sans cron), un élément `pending` depuis plus de **35 min** (corrigé le 8 octobre 2026 : la durée maximale d'une fonction Vercel peut atteindre 300 s en Hobby, 800 s en Pro et **1 800 s** avec l'option étendue en bêta ; le seuil doit toujours dépasser la `maxDuration` configurée) est pris par une mise à jour conditionnée à son `claim_id`. Si l'offre existe pour cette exécution, il est finalisé « créé » ; sinon ses indicateurs sont effacés, puis ses places rendues | Sûre si la durée maximale d'une fonction est inférieure au seuil : l'exécution d'origine est alors certainement terminée, et sa finalisation est conditionnée au `claim_id` | À valider ; utile seulement si les interruptions s'avèrent fréquentes |
| **R2** Recalcul des compteurs | Recalculer `reserved` à partir des éléments | **Non sûre** pendant une exécution active : un recalcul concurrent peut sous-compter et laisser dépasser un plafond. Sûre seulement une fois l'exécution close, quand c'est devenu inutile | **Déconseillée** |

Les places **non rattachées** (premier et quatrième cas de l'inventaire) ne sont pas
récupérables de façon sûre élément par élément. Leur effet est borné et temporaire : je
recommande de l'accepter.

### 2.4 Réconciliation des chiffres

**Cause de l'écart** : le décompte par fichier du premier rapport comptait aussi **5 lignes du
résumé des avertissements** de pytest qui citent `test_opportunity_api.py`. Il annonçait 41 tests
pour ce fichier au lieu de 36, d'où « 265 » au lieu de **260**.

| Rapport | Lot 1 et S3 | Veille | Total pytest |
|---|---|---|---|
| Premier rapport (erroné) | 265 (faux) | 329 | 589 |
| Premier rapport (corrigé) | **260** | **329** | **589** ✔ |
| Rapport final | **260** | **358** (+27 PSL, +2 arrêt brutal) | **618** ✔ |

La méthode est corrigée : seules les lignes `PASSED` sont comptées, et leur somme est vérifiée
contre la ligne de synthèse de pytest.

## 3. Précisions de l'approbation précédente (spécification 1.3, §7.1)

- **`run_id` manuel** : `veille-AAAAMMJJ-HHMM-manuel-xxxxxx`, avec un suffixe aléatoire de 6
  caractères tiré une fois. Deux « Run now » dans la même minute ont des identifiants distincts.
  Une reprise garde l'identifiant d'origine.
- **Fenêtre** : nouvelle exécution entre −6 h et +15 min ; reprise jusqu'à 24 h ; heure
  inexistante au passage à l'heure d'été refusée ; heure ambiguë au passage à l'heure d'hiver
  acceptée ; quota imputé à la date du `run_id`. Tout est couvert par des tests.

## 4. Ce qui a été implémenté

| Lot | Fichiers | Contenu |
|---|---|---|
| Configuration | `config.py`, `.env.example` | 6 réglages `WATCH_*` bornés : une valeur hors bornes bloque le démarrage |
| Dépendances | `requirements.txt` | `tzdata==2025.3`, `publicsuffixlist==1.0.2.20261007` |
| Modèles | `models/watch.py` (nouveau), `models/__init__.py` | Préférences, envoi groupé, résultats, rapport, statut ; sous-document `watch` ; `watch_enabled` ; source réservée |
| Validation | `utils/watch_validation.py` (nouveau) | `run_id` en heure de Paris, URL sûres avec Public Suffix List, normalisations, `check_item` sans écho des valeurs |
| Préférences | `services/watch_preferences_service.py` (nouveau) | Valeurs D12, version contrôlée (`409`) |
| Ingestion | `services/watch_ingest_service.py` (nouveau) | Algorithme du §7.3, ordre sûr des réservations et libérations, rapport, statut |
| Lot 1 (minimal) | `services/opportunity_service.py` | Paramètre optionnel `watch`, document identique sans lui |
| P3 | `routes/opportunities.py`, `routes/agent.py` | `422 source_reserved` |
| API | `routes/watch.py` (nouveau), `server.py` | `/api/watch/preferences`, `/status`, `/runs` ; `403 watch_not_enabled` |
| Admin | `routes/admin.py` | `PUT /api/admin/users/{id}/watch` |
| Tests | 4 nouveaux fichiers ; `run_mongo_tests.sh` ; 2 tests Lot 1 adaptés (source) | §1 |
| Documentation | Spécification §5.7 (PSL) ; exemple de l'API agent du Lot 1 | §2.1, §2.2 |

## 5. Limites restantes

1. **P3** : risque résiduel décrit au §2.2, à lever par ta vérification en lecture seule avant
   le déploiement.
2. **Places bloquées** après un arrêt brutal : bornées, temporaires, jamais au-delà des plafonds
   (§2.3). Récupération R0 ou R1 à décider.
3. **Plafond journalier** sans attente : dans une course rare sur une même offre au bord de la
   limite, un élément peut être refusé alors que le total final reste inférieur à 40 (jamais
   au-dessus).
4. **Public Suffix List** figée à la version épinglée (§2.1).
5. **Limite de débit** de 30 requêtes par minute à poser sur `/api/mcp` à l'étape 3.
6. Concurrence testée sur un MongoDB local à un seul nœud. Les garanties reposent sur des mises
   à jour atomiques conditionnelles, valables sur Atlas.
7. **Absence présumée** : calculée seulement à la consultation et pour les exécutions `prog`.

**STOP** : rapport final remis. En attente de ton feu vert ; l'étape 3 n'est pas commencée.
