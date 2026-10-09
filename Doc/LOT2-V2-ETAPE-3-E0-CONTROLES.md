# JobTracker — Lot 2 V2 · Étape 3 : contrôles préalables E0a et E0b

> **Référence** : [LOT2-V2-ETAPE-1-SPECIFICATION.md](./LOT2-V2-ETAPE-1-SPECIFICATION.md)
> (§2.2, §8.1, §8 bis.1, §10) · étape 2 validée
> ([LOT2-V2-ETAPE-2-RAPPORT.md](./LOT2-V2-ETAPE-2-RAPPORT.md)).
> **Date** : 8 octobre 2026 · **Statut** : **analyse et mesures locales terminées, à valider**.
> Protocole E0 : [LOT2-V2-ETAPE-3-PROTOCOLE-E0.md](./LOT2-V2-ETAPE-3-PROTOCOLE-E0.md).
> **Aucune modification** de `vercel.json`, du code ou de la production. Aucun commit, push ni
> déploiement. Les seules requêtes vers la production sont des `GET` anonymes en lecture
> seule.

## 1. Synthèse

| Porte | Verdict local | Ce qui reste pour clore la porte |
|---|---|---|
| **E0a** Routage `/.well-known/` | **Défaut confirmé ; correctif prêt et validé par simulation** | Déploiement réel (autorisation distincte) |
| **E0b** Dépendance `mcp` | **Compatible et taille OK. Montage standard incompatible avec Vercel : variante corrigée validée.** Démarrage à froid à mesurer sur Vercel | Mesure du démarrage sur un déploiement réel |

Deux constats importants hors du périmètre initial :
1. **Le venv local de développement est périmé** : FastAPI 0.110.1 / Starlette 0.37.2, alors
   qu'une installation neuve de `requirements.txt` (ce que fait Vercel) donne **FastAPI 0.143.0 /
   Starlette 1.7.0**. La suite complète (**618 tests**) passe **aussi** sur cette pile neuve
   (§3.2).
2. **Le montage standard du SDK `mcp` échoue sans `lifespan`**, or Vercel n'exécute pas le
   `lifespan`. Une variante compatible est validée (§3.4).

---

## 2. E0a — Routage des URL `/.well-known/`

### 2.1 Constat en production (lecture seule, `GET` anonymes)

| Chemin | Réponse actuelle | Attendu pour OAuth |
|---|---|---|
| `/.well-known/oauth-protected-resource` | **200 `text/html`** (page du frontend, 4 848 octets) | JSON du backend |
| `/.well-known/oauth-protected-resource/api/mcp` | **200 `text/html`** (frontend) | JSON du backend |
| `/.well-known/oauth-authorization-server` | **200 `text/html`** (frontend) | JSON du backend |
| `/.well-known/openid-configuration` | **200 `text/html`** (frontend) | JSON du backend (404 JSON acceptable) |
| `/api/mcp` | 404 `application/json` (FastAPI) | Routage déjà correct |
| `/api/health` | 200 `{"status":"healthy",…}` | — |

**Gravité** : un client OAuth recevrait du HTML **avec un statut 200**, au lieu d'un JSON ou
d'un 404 franc. La découverte échouerait sur une erreur d'analyse.

### 2.2 Cause

Les réécritures de `vercel.json` sont évaluées dans l'ordre. La règle
`/(.*)\.(.*)` (fichiers avec extension) capture `/.well-known/…`, à cause du point de
`.well-known`, et envoie la requête vers le frontend. La simulation confirme : règle n°3 →
`/frontend/.well-known/oauth-protected-resource`.

### 2.3 Correctif proposé (non appliqué)

Trois règles **explicites**, insérées juste après `/api/(.*)` et **avant** les règles du
frontend :

```diff
     {
       "source": "/api/(.*)",
       "destination": "/backend/api/index.py"
     },
+    {
+      "source": "/.well-known/oauth-protected-resource(.*)",
+      "destination": "/backend/api/index.py"
+    },
+    {
+      "source": "/.well-known/oauth-authorization-server(.*)",
+      "destination": "/backend/api/index.py"
+    },
+    {
+      "source": "/.well-known/openid-configuration(.*)",
+      "destination": "/backend/api/index.py"
+    },
     {
       "source": "/static/(.*)",
       "destination": "/frontend/static/$1"
     },
```

**Pourquoi des règles explicites plutôt que `/.well-known/(.*)`** : les autres fichiers
`/.well-known/` éventuels (`security.txt`, `assetlinks.json`…) continuent d'être servis par le
frontend. Le backend ne reçoit que la découverte OAuth.

`openid-configuration` est inclus parce que certains clients le tentent en repli. Le backend
répondra par un **404 JSON** franc, plutôt que par du HTML.

### 2.4 Validation locale du correctif

**Simulation exacte du routage Vercel** avec le paquet officiel `@vercel/routing-utils` 6.6.0
(`convertRewrites`), installé dans un dossier jetable, sur 16 chemins :

| Chemin | Actuel | Proposé |
|---|---|---|
| `/.well-known/oauth-protected-resource` | frontend | **backend** (règle 2) |
| `/.well-known/oauth-protected-resource/api/mcp` | frontend | **backend** (règle 2) |
| `/.well-known/oauth-authorization-server` | frontend | **backend** (règle 3) |
| `/.well-known/openid-configuration` | frontend | **backend** (règle 4) |
| `/.well-known/assetlinks.json`, `/.well-known/security.txt` | frontend | frontend (inchangé) |
| `/api/mcp`, `/api/health`, `/api/oauth/token` | backend | backend (inchangé) |
| `/static/js/…`, `/manifest.json`, `/favicon.ico` | frontend | frontend (inchangé) |
| `/`, `/dashboard`, `/oauth/consent`, `/opportunities` | `index.html` | `index.html` (inchangé) |

**Expressions générées** : `^\/\.well-known\/oauth-protected-resource(.*)$` (point littéral
échappé). `/Xwell-known/…`, `/well-known/…` et `/.WELL-KNOWN/…` **ne correspondent pas**.

**Côté FastAPI** : sans autre changement, ces chemins renvoient aujourd'hui
`404 {"detail":"Not Found"}` en JSON (vérifié avec l'application réelle). Vercel conserve le
chemin d'origine lors d'une réécriture vers la fonction : c'est déjà le cas pour `/api/*`, que
FastAPI sert avec son préfixe `/api`. Les routes de métadonnées devront donc être déclarées
**à la racine** (`/.well-known/…`) dans FastAPI, hors du routeur `/api`.

### 2.5 Clôture de E0a sur un déploiement réel (proposition)

| Phase | Contenu | Critère | Risque |
|---|---|---|---|
| **E0a-1** Routage seul | Déployer **uniquement** les 3 règles | Les 4 chemins renvoient `404 application/json` (FastAPI) au lieu du HTML | Quasi nul : ces chemins ne sont utilisés par personne aujourd'hui ; aucun autre chemin ne change (§2.4) |
| **E0a-2** Métadonnées | Avec les premières routes OAuth (étape 3) | JSON RFC 9728 et RFC 8414 exacts (`issuer`, `resource`) | Derrière `MCP_ENABLED` |

**Option de vérification sans toucher à la production** : pousser une branche pour obtenir un
déploiement **Preview**. Les Preview sont protégées par la connexion Vercel : toi seul peux
ouvrir `<url-preview>/.well-known/oauth-protected-resource` dans ton navigateur, connecté à
Vercel. Le résultat attendu est le JSON `{"detail":"Not Found"}`. Cela demande une autorisation
de **push** d'une branche dédiée, sans fusion ni déploiement en production.

**Retour arrière** : retirer les 3 règles et redéployer. Les chemins reviennent à leur
comportement actuel.

---

## 3. E0b — Dépendance `mcp` (D13)

### 3.1 Méthode

- Deux environnements **neufs et jetables** (scratchpad), créés comme Vercel le fait, à partir
  de `requirements.txt` :
  - **base** : `requirements.txt` seul ;
  - **mcp** : `requirements.txt` + `mcp==2.3.0` (dernière version publiée).
- Le venv du projet n'a pas été modifié : la seule commande lancée dessus est une
  simulation `pip install --dry-run`.
- Python 3.11.9 (poste local), Windows 11.

### 3.2 Compatibilité

| Contrôle | Résultat |
|---|---|
| Résolution `requirements.txt` + `mcp==2.3.0` | **OK**, `pip check` : aucun conflit |
| Versions résolues (base = mcp) | FastAPI **0.143.0**, Starlette **1.7.0**, Pydantic 2.13.5, Uvicorn 0.54.0, httpx 0.28.1, anyio 4.15.1 |
| Paquets ajoutés par `mcp` | `mcp` 2.3.0, `mcp-types` 2.3.0, `jsonschema` 4.26.0 (+ `jsonschema-specifications`, `referencing`, `rpds-py`), `pyjwt` 2.15.1, `sse-starlette` 3.5.0 ; `pywin32` (**Windows seulement**, absent sous Linux) |
| **Suite complète, environnement base** | **618 réussis**, 0 échec |
| **Suite complète, environnement mcp** | **618 réussis**, 0 échec |
| Venv local du projet (dry-run) | `mcp` y forcerait Starlette 0.37.2 → 1.7.0, **incompatible** avec son FastAPI 0.110.1 (`starlette<0.38`) |

**Conséquence** : le venv local est **en retard** sur ce que Vercel installe. Les tests des
étapes précédentes passent aussi sur la pile neuve, donc aucune régression n'est masquée. Je
recommande de **reconstruire le venv local** à partir de `requirements.txt` avant l'étape 3,
avec ton accord, et d'envisager d'**épingler** FastAPI et Starlette pour que local et
production restent identiques.

### 3.3 Taille

| Mesure (environnement installé, hors outils de test et `pywin32`) | Valeur |
|---|---|
| Dépendances, base | **168,3 Mo** |
| Dépendances, avec `mcp` | **174,2 Mo** |
| **Ajout dû à `mcp`** | **+5,9 Mo** (+3,5 %) |
| Limite Vercel, fonction Python (décompressée) | **500 Mo** ([documentation Vercel](https://vercel.com/docs/functions/limitations)) |
| **Marge** | **65 %** (exigence ≥ 20 % : **respectée**). Même face à l'ancienne limite générique de 250 Mo : 30 % |

**Limite de la mesure** : taille mesurée sur Windows. Les paquets binaires (`pydantic-core`,
`cryptography`, `lxml`…) ont une taille un peu différente sous Linux. L'ajout de `mcp` est
quasi entièrement en Python pur, donc le delta est fiable. Le téléchargement direct des roues
Linux a échoué sur des paquets distribués seulement en sources (`svglib==1.5.1`, `http-ece`).
La taille réelle du bundle sera lue dans les journaux de build Vercel.

### 3.4 Fonctionnement sans `lifespan` (point bloquant découvert)

| Variante | Résultat sans `lifespan` (comme sur Vercel) |
|---|---|
| **Montage standard** (`app.mount("/api/mcp", mcp.streamable_http_app(...))`) | **Échec** : `RuntimeError: Task group is not initialized. Make sure to use run().` sur `initialize`, `tools/list` et `tools/call` |
| **Gestionnaire par requête** : serveur MCP global ; à chaque requête, un `StreamableHTTPSessionManager` (`stateless=True`, `json_response=True`) est créé, puis `run()` et `handle_request()` | **Succès** : `initialize`, `tools/list` et `tools/call` → **200** et JSON-RPC correct |
| Protection contre le *DNS rebinding* du SDK | Active : hôte `evil.example` → **421**. À configurer avec `allowed_hosts=["jobtracker.maadec.com"]` : l'alias `*.vercel.app` sera refusé, ce qui est cohérent avec la ressource canonique unique (§2.2 de la spécification) |
| Surcoût de la variante par requête | `tools/list` × 50 : **médiane 3,9 ms**, max 12,8 ms |

**Pourquoi** : le SDK démarre ses tâches dans le `lifespan` de l'application Starlette. Vercel
n'exécute pas le `lifespan` (déjà constaté au Lot 1 pour les index). `run()` ne peut être appelé
qu'**une fois par instance** de gestionnaire, d'où un gestionnaire neuf par requête. C'est
compatible avec le mode sans état retenu.

**Point d'attention pour l'étape 3** : la variante utilise l'attribut **privé**
`MCPServer._lowlevel_server`. Deux options pour l'implémentation :
1. construire directement le serveur avec l'API publique de bas niveau (`mcp.server.Server`),
   recommandée ;
2. garder `MCPServer` et épingler `mcp==2.3.0`, avec un test qui casse si l'attribut disparaît.

### 3.5 Démarrage à froid

| Mesure (poste local, 12 itérations après préchauffage) | Médiane | Min | Max |
|---|---|---|---|
| Import de l'application complète (base) | 16,2 s | 8,9 s | 20,9 s |
| Application + MCP (import et construction) | 17,4 s | 10,5 s | 34,6 s |
| **Part propre au MCP** | **2,26 s** | 1,33 s | 6,47 s |
| Profil `-X importtime` de `mcp` après l'application | **1,38 s**, surtout la construction des modèles Pydantic de `mcp_types` | | |

**Interprétation** : sur ce poste, l'application seule met déjà 9 à 21 s à s'importer. C'est
très au-dessus d'un démarrage Vercel réaliste, à cause d'un disque et d'un antivirus lents. Les
valeurs absolues **ne sont pas transposables**. La part MCP représente environ **14 %** de
l'import de l'application.

**Le seuil D13 (+1,5 s au plus) ne peut pas être tranché localement.** Deux mesures sont
proposées pour l'étape 3 :
1. **Import paresseux** : importer `mcp` **seulement au premier appel de `/api/mcp`**. Les
   autres routes de JobTracker (interface, extension) n'ont alors **aucun** surcoût. Seule la
   veille paie le chargement, une fois par instance.
2. **Mesure réelle** au premier déploiement derrière `MCP_ENABLED` : durée du premier appel
   `/api/mcp` après inactivité, comparée à `/api/health`, lue dans les journaux Vercel.

### 3.6 Verdict E0b

| Critère D13 (§8.1) | Statut |
|---|---|
| Compatibilité | **PASS** (local, pile identique à Vercel) |
| Taille, marge ≥ 20 % | **PASS** (65 %) |
| Fonctionnement (`initialize`, `tools/list`, appel) | **PASS** avec la variante par requête ; **FAIL** avec le montage standard |
| Démarrage à froid ≤ +1,5 s | **À mesurer sur Vercel**, avec import paresseux recommandé |

**Repli prévu** (§8.1) si la mesure Vercel échoue : sous-ensemble JSON-RPC minimal sans SDK
(`initialize`, `tools/list`, `tools/call`).

---

## 4. Décisions demandées

> **Mise à jour du 8 octobre 2026** : V1, V3, V4 et V5 validées. **V2 (Preview) abandonnée** :
> validation par [déploiement contrôlé](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md).

| # | Question | Recommandation |
|---|---|---|
| **V1** | Appliquer le correctif `vercel.json` (§2.3) au début de l'implémentation de l'étape 3 ? | **Oui** |
| **V2** | Valider E0a-1 avant le reste : sur une **Preview** (push d'une branche dédiée) ou directement en production ? | **Preview**, si tu acceptes le push d'une branche ; sinon avec le premier déploiement derrière `MCP_ENABLED` |
| **V3** | Reconstruire le venv local à partir de `requirements.txt` et épingler FastAPI et Starlette ? | **Oui** (aligner local et production) |
| **V4** | Montage MCP : gestionnaire par requête avec l'API publique de bas niveau | **Oui** |
| **V5** | Import paresseux de `mcp` | **Oui** |

## 5. Traces

Fichiers de travail, tous dans le scratchpad, hors dépôt : simulation de routage
(`e0a/simulate.js`, `e0a/vercel.proposed.json`, `e0a/vercel.json.patch`), environnements
`e0b/venv-base` et `e0b/venv-mcp`, mesures (`sizes-*.json`, `coldstart*.jsonl`,
`importtime*.txt`), sorties des suites (`suite-base.txt`, `suite-mcp.txt`), essais MCP
(`nolifespan.py`, `perrequest.py`).

Aucun conteneur de test ne reste actif.
