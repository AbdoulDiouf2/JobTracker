# JobTracker — Lot 2 V2 · Étape 0 (Gate 0) : faisabilité réelle et sécurité S3

> **Référence** : [CDC-LOT2-JOBTRACKER-V2.md](./CDC-LOT2-JOBTRACKER-V2.md), §4 et §6, étape 0.
> **Date** : 8 octobre 2026.
> **Nature** : audit uniquement. Aucun code produit, aucune configuration, aucun token, aucune
> tâche programmée, aucune rotation de secret, aucun commit, push ni déploiement.
> **Le CDC V1 (veille côté serveur) est obsolète** ; la recommandation C de
> [LOT2-AUDIT-FAISABILITE.md](./LOT2-AUDIT-FAISABILITE.md) est remplacée par la décision du
> porteur de projet (CDC V2 §1).

---

## 0 bis. Résultats du Gate 0 (8 octobre 2026) — VERDICT : GO CONDITIONNEL

> Les tests ont été exécutés le 8 octobre 2026, entre 01:38 et 02:12 UTC, sur le **compte
> réel** du propriétaire (ChatGPT **Plus**), avec le prototype MCP jetable (hors dépôt) exposé
> par un tunnel Cloudflare temporaire. La preuve est le **puits** du serveur, et non les
> messages de ChatGPT.

| Test | Verdict | Preuve (puits du serveur, UTC) | Observations |
|---|---|---|---|
| **P0** Connexion | **GO** | Plugin « JobTracker POC (test) » créé ; 3 outils visibles ; contrôle MCP en lecture via le tunnel OK | Mode développeur et ajout de MCP personnalisé disponibles sur **Plus** |
| **P1** Écriture manuelle | **GO** | `01:44:56` `P1_TEST_MANUEL_001` : 1 écriture | **Aucune confirmation** demandée, contrairement au défaut documenté (« Write actions by default require confirmation ») |
| **P2** Tâche programmée | **GO** | `02:09:54` `P2_TEST_AUTO_003` : 1 écriture, sans doublon (vérifié 90 s après) | Tâche ponctuelle programmée à 04:06 (Paris), **sans aucune interaction** : pas de « Run now », tâche et conversation non ouvertes. Écriture **sans confirmation**, **3 min 54 s** après l'heure prévue. Création de la tâche : 0 écriture |
| **P3** Écriture autonome répétée, en absence | **PASS par décision du propriétaire, NON EXÉCUTÉ** | — | Le propriétaire a jugé P2 suffisant. **Aucune exécution récurrente ni absence prolongée n'a été testée** |

**Écritures écartées de la preuve** (contexte) :
- `01:46:51` `P2_TEST_AUTO_001` : appel direct dans une conversation, aucune tâche créée ;
- `01:53:38` et `01:54:24` `P2_TEST_AUTO_002` (même tâche exécutée deux fois) : l'une
  programmée, l'autre un « Run now » manuel. **Non attribuables avec certitude**, d'où le test
  de contrôle `P2_TEST_AUTO_003`.

**Constat clé** : sur ce compte (Plus), **une tâche ChatGPT programmée a appelé seule un outil
MCP personnalisé d'écriture, sans confirmation humaine, une seule fois**. L'ordonnanceur
présente un **retard de 2 à 4 minutes** (deux mesures : 2 min 38 s et 3 min 54 s).

### Décision (CDC §4.4)

**GO CONDITIONNEL**, sur décision explicite du propriétaire, le 8 octobre 2026. S3 est
maîtrisée (`ef07ab6` en production).

**Limites consignées, NON démontrées**, à vérifier impérativement à l'étape 5 du CDC
(connexion ChatGPT et tests de bout en bout) :
1. **Absence réelle prolongée** : navigateur et ChatGPT fermés pendant des heures. Seule une
   absence de quelques minutes, onglet ouvert mais non utilisé, a été observée.
2. **Récurrence 2 fois par jour** et **fiabilité sur plusieurs jours** : aucune tâche
   récurrente n'a été testée.
3. **Authentification** : les tests ont utilisé **« No authentication »**. Le vrai MCP
   utilisera **OAuth 2.1**. Le comportement d'une tâche programmée face à un jeton expiré ou à
   un consentement à renouveler, en ton absence, **n'est pas connu**.
4. **Écriture groupée** (`create_opportunities`, jusqu'à 20 offres) : seul un appel unitaire
   simple a été testé.
5. **Stabilité dans le temps** : les fonctions de ChatGPT (bêta, plugins, tâches) peuvent
   évoluer. Le comportement « sans confirmation » observé contredit la documentation et
   pourrait changer.
6. **Doublons** : ChatGPT n'a pas répété l'appel au sein d'une même exécution. En revanche, une
   même tâche peut s'exécuter deux fois (« Run now » plus l'horaire), d'où la nécessité de
   l'**idempotence côté JobTracker**, déjà en place au Lot 1.

## 0 ter. Nettoyage du prototype (8 octobre 2026)

| Action | Résultat |
|---|---|
| Archivage des preuves | [LOT2-V2-ETAPE-0-PREUVES.md](./LOT2-V2-ETAPE-0-PREUVES.md) : 5 écritures avec horodatages et identifiants, attribution, empreintes des sources, sans aucun jeton |
| Arrêt du tunnel Cloudflare | Processus `cloudflared` arrêté. L'URL publique renvoie **530** (tunnel inexistant) |
| Arrêt du serveur MCP | Processus Python arrêtés. `127.0.0.1:8765` : connexion refusée, port non en écoute |
| Suppression | Dossier `lot2-mcp-poc/` supprimé (puits, jeton `.poc_token`, URL du tunnel, journaux, environnement Python, sources) |
| `cloudflared` | **Conservé** (version 2026.10.0), à la demande du propriétaire |
| Côté ChatGPT (propriétaire) | À faire : supprimer les tâches de test (« JobTracker P2 Test » et celle de `P2_TEST_AUTO_003`) et le plugin « JobTracker POC (test) », puis désactiver le mode développeur si inutile. **Ne pas toucher** à « Veille CDI Data junior ». Le plugin pointe désormais vers une URL morte |

## 0. Verdict initial (avant les tests, conservé pour historique)

**NO-GO provisoire : non démontré.** Ce n'est pas un NO-GO définitif.

| Condition du GO (CDC §4.4) | État |
|---|---|
| P0 à P3 prouvés sur le compte réel | **Non réalisés.** Je n'ai pas accès au compte ChatGPT ; le protocole est au §3 |
| Risque S3 maîtrisé | **Non levé.** Risque confirmé dans le code et démontré en local ; **valeur de production non vérifiée** (§4) |

**Ce que dit la documentation** :
- Côté ChatGPT, les écritures MCP **demandent une confirmation par défaut**.
- **Rien ne documente** qu'une tâche programmée puisse invoquer un MCP personnalisé en écriture
  **sans confirmation** pendant l'absence de l'utilisateur.
- Une seule piste documentée permet une politique « sans approbation » : les tâches de
  l'**application desktop** liées à un projet local, avec `approval_policy = "never"`. Elle
  suppose probablement l'ordinateur allumé et ne couvre pas forcément les plugins ChatGPT.

**Le verdict ne peut basculer en GO qu'après** :
1. l'exécution du protocole P0 à P3 par le propriétaire, avec des résultats positifs ;
2. la vérification de `JWT_SECRET` en production (§4.4).

Tant que ces deux points ne sont pas réglés, aucune étape suivante ne démarre.

---

## 1. Recherche documentaire datée (CDC §4.1)

**Méthode.**
- `developers.openai.com` et `learn.chatgpt.com` (documentation OpenAI) ont été **lus directement**.
- `help.openai.com` et `help-lb.openai.com` **refusent toute lecture automatisée** (HTTP 403,
  y compris via `curl`). Seuls les **extraits indexés par le moteur de recherche** sont
  disponibles, marqués « extrait ».
- Les sources tierces sont signalées comme telles et **ne servent pas de preuve**.

**Légende** : **D** documenté · **T** testé sur le compte · **NC** non confirmé · **NS** non
pris en charge.

| # | Question (CDC §4.1) | Statut | Preuve |
|---|---|---|---|
| 1 | Créer et utiliser un MCP personnalisé **sur le compte et le plan du propriétaire** | **D** (fonction) · **NC** (ton plan) | *« Go to ChatGPT Plugins. Select the plus button, then Add custom MCP server »* ; *« Use ChatGPT on the web. Workspace permissions and security restrictions, including Lockdown, apply »* ([Create custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server), lu). Aucun plan n'est cité sur cette page. Les extraits « Developer mode » parlent d'une bêta Plus, Pro, Business, Enterprise et Edu, avec des connecteurs complets (écriture) réservés à Business, Enterprise et Edu ([Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt), extrait) → **à constater en P0** |
| 2 | Exposer un outil MCP **d'écriture**, et permissions effectives | **D** | *« ChatGPT supports both read and write tools from your server »* ; *« We respect the readOnlyHint tool annotation. Tools without this hint are treated as write actions »* ([Create custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server), lu). En espace de travail géré, les écritures sont désactivées par défaut et activées par un admin ([Admin controls…](https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-for-plugins-and-apps), extrait) |
| 3 | Plugin disponible **dans une tâche programmée** | **D** (général) · **NC** (MCP personnalisé) | Les tâches peuvent utiliser *« uploaded files, connected tools, skills, and plugins available to that chat »*, et des serveurs MCP dans l'app desktop avec projets locaux ([Scheduled tasks — ChatGPT Learn](https://learn.chatgpt.com/docs/automations), lu). Les tâches créées avec ChatGPT Work peuvent utiliser des plugins ([ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex), extrait). **Rien n'affirme qu'un MCP personnalisé ajouté par l'utilisateur est disponible dans une tâche web planifiée** |
| 4 | Écriture **sans confirmation** pendant l'absence | **NC**, avec indice défavorable côté web | *« Write actions by default require confirmation »* ([Create custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server), lu). Un extrait de source non identifiable indique que les apps avec écriture *« must prompt before every action, and may not be set to always allow »* : **non confirmé**. Côté desktop et projets locaux : `approval_policy = "never"` possible *« when organization policy permits »*, avec l'avertissement que les tâches de fond en accès complet peuvent agir *« without asking »* ([ChatGPT Learn](https://learn.chatgpt.com/docs/automations), lu). Le comportement face à une confirmation requise en votre absence (attente, échec, notification) **n'est pas documenté** pour le web |
| 5 | Authentification supportée et durée de validité | **D** (méthodes) · **NC** (durée) | Options : *« OAuth, No authentication, and OAuth or no authentication »*. *« If static credentials are provided, then they will be used. Otherwise, ChatGPT can use Client ID Metadata Documents »* ([Create custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server), lu). **NS** : *« ChatGPT does not support machine-to-machine OAuth grants such as client credentials… nor can it present custom API keys »* ([Authentication](https://developers.openai.com/plugins/build/auth), lu). Durée de validité : fixée par **notre** serveur OAuth (jetons et rafraîchissement) ; le comportement de ChatGPT à l'expiration n'est pas documenté |
| 6 | Comportement : tâche suspendue, consentement requis, erreurs, quotas, outil indisponible | **NC** pour l'essentiel | Plafonds de tâches par plan (3, 5, 10, 15) et de tâches événementielles (30 par heure, 720 par jour) ([Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt), extrait). Desktop : *« tool calls fail if they require modifying files, accessing network… »* si le bac à sable est insuffisant ([ChatGPT Learn](https://learn.chatgpt.com/docs/automations), lu). Aucun comportement documenté pour un plugin MCP indisponible ou un consentement expiré dans une tâche web |

**Conclusion documentaire.** « Les tâches utilisent des plugins » est **documenté**. « Une tâche
invoque automatiquement *ce* MCP personnalisé en écriture, sans approbation » ne l'est **pas**.
Le défaut documenté (confirmation des écritures) va même **dans le sens contraire**. Seuls les
tests P2 et P3 peuvent trancher (CDC §4.1, §9).

---

## 2. Matrice P0 à P3 (CDC §4.2)

> **Mise à jour du 8 octobre 2026** : les §2 et §3 sont **remplacés** par
> [LOT2-V2-PROTOCOLE-P0-P3.md](./LOT2-V2-PROTOCOLE-P0-P3.md), qui reprend les définitions
> validées : P0 connexion, P1 appel manuel, P2 tâche programmée, P3 écriture autonome.
> **S3 est corrigée et déployée** (`ef07ab6`).

| Preuve | Objectif | Qui | Statut | Critère de réussite | Observation |
|---|---|---|---|---|---|
| **P0** Accès | Menus et permissions : mode développeur, « Add custom MCP server », écriture autorisée sur ton plan | Propriétaire | ⏳ Non réalisé | Les menus existent ; création de MCP et écriture permises sur ton plan | — |
| **P1** Interaction | Un outil MCP d'écriture **de test**, sans donnée personnelle, écrit **une fois** dans un puits jetable lors d'une conversation | Propriétaire, plus un serveur de test jetable (décision D2) | ⏳ Non réalisé | 1 écriture reçue ; confirmation demandée ou non (capture) | — |
| **P2** Programmation | Une **tâche programmée** de test tente cette écriture ; examen de la trace et des confirmations | Propriétaire (consentement explicite requis) | ⏳ Non réalisé | Trace de la tâche indiquant l'appel, **et** écriture reçue dans le puits | — |
| **P3** Sans présence | Exécution effective **sans intervention humaine**, écriture reçue **exactement une fois** | Propriétaire | ⏳ Non réalisé | 1 et 1 seule écriture horodatée à l'heure prévue, pendant ton absence, sans confirmation en attente ; idéalement 2 exécutions dans la même journée | — |

**Une réussite ne se déduit jamais de la simple création d'une tâche** (CDC §4.2). Seule
compte l'écriture effectivement reçue dans le puits.

---

## 3. Protocole pas à pas pour le propriétaire

> **Règles** :
> - n'utiliser **aucun token JobTracker** ni aucune donnée personnelle ;
> - ne partager **aucun secret** dans les captures ;
> - prendre une capture à chaque étape marquée 📸 ;
> - tu es seul à manipuler ton compte.

### P0 — Accès (environ 10 min, aucune création)

1. ChatGPT **web**, connecté à ton compte. Noter le **nom exact du plan** (Paramètres → Compte). 📸
2. Paramètres → *Apps & Plugins* (ou *Connectors*) → *Avancé* : un interrupteur **Mode
   développeur** existe-t-il ? Ne rien activer à ce stade, seulement constater. 📸
3. *Plugins* → bouton **+** : l'option **Add custom MCP server** apparaît-elle ? Si oui, ouvrir
   le formulaire, observer les choix d'authentification, puis **annuler**. 📸
4. Si un message mentionne « lecture seule » ou « écriture réservée à certains plans », le
   noter mot pour mot. 📸
5. Ouvrir la page **Scheduled** (barre latérale) : noter le nombre de tâches autorisées et
   les options proposées (heure exacte, récurrence). 📸

➡️ **Si l'option 3 est absente ou limitée à la lecture**, P1 à P3 sont impossibles sur ce
plan : le résultat est directement un **NO-GO** pour cette architecture.

### P1 — Interaction (après la décision D2)

Prérequis : un **serveur MCP de test jetable**, hors du dépôt JobTracker et sans donnée
personnelle. Il expose :
- `record_ping(note: str)`, outil d'écriture sans `readOnlyHint`, qui ajoute
  `{horodatage, note}` dans un fichier ou une liste jetable ;
- `list_pings()`, outil de lecture.

Étapes :
1. Activer le **mode développeur** (avec ton accord explicite).
2. *Add custom MCP server* : URL du serveur de test, authentification **No authentication**
   (acceptable uniquement pour ce test, sans aucune donnée personnelle).
3. Dans une conversation : « Appelle `record_ping` avec la note `P1-test` ». Noter si une
   **confirmation** est demandée. 📸
4. Vérifier côté serveur de test : **1 entrée** `P1-test`. 📸

### P2 — Programmation

1. Créer une tâche **ponctuelle** dans 15 min (avec ton consentement explicite) : « Appelle
   l'outil `record_ping` du plugin de test avec la note `P2-<date>-<heure>`. Ne fais rien
   d'autre. » 📸
2. **Rester devant l'écran** et observer : une demande de confirmation apparaît-elle ? La
   tâche indique-t-elle un succès, un échec ou une attente ? 📸
3. Vérifier le puits : entrée `P2-…` présente, **une seule fois** ? 📸

### P3 — Sans présence

1. Créer une tâche **récurrente 2 fois par jour** (par exemple 09:00 et 17:00 dans ton fuseau)
   avec la note `P3-<horodatage du run>`. 📸
2. **Fermer** ChatGPT (onglets et application), ne pas y toucher et ne répondre à aucune
   notification avant le contrôle.
3. Après chaque horaire prévu, consulter **uniquement le puits** : une entrée par exécution,
   horodatée à l'heure prévue, sans doublon. 📸
4. Puis ouvrir l'historique de la tâche : confirmation en attente ? échec ? 📸
5. **GO P3** seulement si les **deux** exécutions ont écrit **une fois chacune** sans aucune
   intervention. Sinon, noter précisément l'état observé.

**Variante desktop (optionnelle, décision D4)** : refaire P2 et P3 depuis l'**application
desktop**, avec une tâche liée à un projet local, le serveur MCP de test configuré et une
politique d'approbation « jamais » si elle est proposée. Ordinateur allumé, sans interaction.
À documenter séparément : cela suppose que l'ordinateur reste allumé.

### Résultats à me transmettre

Pour chaque étape :
- le plan ;
- les captures (sans secret) ;
- le texte exact des messages ;
- le contenu du puits (horodatages) ;
- l'état final de la tâche.

---

## 4. Sécurité S3 (CDC §4.3)

### 4.1 Chemins de configuration JWT (code réel)

| Élément | Emplacement | Constat |
|---|---|---|
| `JWT_SECRET` | [config.py:20](../../../backend/config.py) | `os.environ.get('JWT_SECRET', 'super-secret-key-change-in-production')` : **valeur par défaut publique** dans le dépôt |
| Algorithme | [config.py:21](../../../backend/config.py) | HS256 (symétrique) ; un seul secret sert à signer et à vérifier |
| Durée | [config.py:22](../../../backend/config.py) | 7 jours ; JWT de l'extension Chrome : 30 jours ([auth.py](../../../backend/routes/auth.py)) |
| Signature | [utils/auth.py:40](../../../backend/utils/auth.py) | `jwt.encode(…, settings.JWT_SECRET, "HS256")` |
| Vérification | [utils/auth.py:47](../../../backend/utils/auth.py) | `jwt.decode(…, algorithms=["HS256"])`, sans `iss` ni `aud` ; `sub` donne l'utilisateur |
| Révocation | — | **Aucune** (pas de liste noire ni de `jti`) : seule une rotation invalide les jetons |
| Chargement | [config.py](../../../backend/config.py) | `load_dotenv()` et `pydantic-settings` (`env_file=".env"`, **relatif au dossier courant**). `.env` est ignoré par git ; en production, seules les variables Vercel comptent |
| `SECRET_KEY` | [config.py:39](../../../backend/config.py) | Défaut public `super-secret-session-key` ; signe **uniquement** le `state` anti-CSRF du login Google ([auth.py:528, 555](../../../backend/routes/auth.py)) |
| Réinitialisation de mot de passe et vérification d'e-mail | [auth.py](../../../backend/routes/auth.py) | Jetons aléatoires `secrets.token_urlsafe(32)` stockés en base : **ne dépendent pas** de ces secrets |
| Tokens agent du Lot 1 | `services/agent_token_service.py` | Hash SHA-256 de 256 bits aléatoires : **ne dépendent pas** de `JWT_SECRET` |

### 4.2 Tests réalisés (en local uniquement, aucun appel à la production, aucune valeur affichée)

| Test | Résultat |
|---|---|
| JWT forgé avec la valeur par défaut publique, `JWT_SECRET` **absent** de l'environnement | **Accepté** par `decode_token` (risque démontré) |
| Même JWT forgé, `JWT_SECRET` robuste (48 octets aléatoires) | **Rejeté** |
| `.env` local : `JWT_SECRET` | Défini, **différent** de la valeur par défaut, 32 caractères ou plus |
| `.env` local : `SECRET_KEY` | Défini, **différent** de la valeur par défaut |

> Le script de test est resté dans le dossier temporaire de session, hors du dépôt. Il n'a lu
> le `.env` local que pour produire des booléens.

### 4.3 Impact si la production utilise la valeur par défaut

- **Usurpation de n'importe quel compte dont l'identifiant est connu.** `get_current_user` ne
  vérifie que la signature et l'existence du compte.
  - **Facteur atténuant, qui n'est pas une correction** : les identifiants sont des UUID v4,
    impossibles à énumérer. Ils peuvent toutefois fuiter (réponses d'API, exports, logs,
    captures).
- **Administration** : `get_admin_user` lit le rôle **en base** à partir du `sub`. Forger le
  `sub` d'un administrateur donne les droits admin.
- **Lot 1** : création de tokens agent au nom de la victime, lecture et modification de ses
  opportunités et candidatures.
- **Lot 2** : un MCP qui s'appuierait sur ces sessions hériterait de la faille.
  **Aucun token réel tant que S3 n'est pas levé** (CDC §4.3).
- **`SECRET_KEY` par défaut** : seulement un risque de CSRF sur le login Google (attaque par
  `state` forgé). La gravité est moindre, à corriger en même temps.

### 4.4 Vérification de la production, sans divulguer le secret

Je n'ai pas d'accès Vercel. Deux méthodes possibles, à ton choix (décision D1) :

**Méthode A (toi, sans aucune requête vers la production)** :
1. Vercel → projet → *Settings → Environment Variables* → filtrer **Production**.
2. Vérifier que `JWT_SECRET` **existe** pour Production (pas seulement pour Preview ou
   Development) et qu'il est marqué *Sensitive* si l'option existe.
3. Si la valeur est visible, vérifier **toi-même** qu'elle n'est **pas**
   `super-secret-key-change-in-production`, qu'elle fait au moins 32 caractères et qu'elle est
   aléatoire. **Ne me communique pas la valeur.**
4. Faire de même pour `SECRET_KEY`.
5. Répondre par oui ou non : présent ? différent du défaut ? 32 caractères ou plus ?

**Méthode B (sonde de production, lecture seule, avec ton autorisation explicite)** :
- Envoyer **une** requête `GET /api/auth/me` avec un JWT signé par la valeur par défaut et un
  `sub` **aléatoire, inexistant**. D'après le code, deux réponses sont possibles :
  - `401 "Could not validate credentials"` : signature **rejetée**, donc secret non par défaut ;
  - `401 "Compte désactivé"` : signature **acceptée**, donc **S3 actif en production**.
- **Avantages** : n'accède à aucun compte, ne modifie rien, ne révèle pas le secret.
- **Mais c'est un test de sécurité actif sur la production** : il nécessite ton accord.

### 4.5 Correction proposée (non appliquée ; CDC étape 2)

1. **Refuser de démarrer** si `JWT_SECRET` ou `SECRET_KEY` est **absent**, **égal à sa valeur
   par défaut** ou **trop court** (moins de 32 caractères), sauf si `DEBUG=true`.
2. Supprimer les valeurs par défaut publiques du code. En développement, imposer une valeur
   dans `.env` (déjà le cas en local).
3. **Tests à ajouter** :
   - le JWT forgé avec l'ancien défaut est rejeté ;
   - le démarrage échoue en production si un secret est par défaut, absent ou court ;
   - mauvaise signature, jeton expiré, `alg` différent de HS256 et `alg=none` sont rejetés ;
   - non-régression du login, de l'extension, de l'OAuth Google et du Lot 1.

### 4.6 Plan de rotation (si la méthode A ou B révèle le défaut ; autorisation séparée)

1. Générer hors ligne un secret de 48 octets aléatoires ou plus. Ne jamais le committer ni le
   transmettre par chat.
2. Le définir dans Vercel (Production, *Sensitive*), puis redéployer.
3. **Effets** : toutes les sessions web (7 jours) et les **connexions de l'extension
   (30 jours)** sont invalidées, donc les utilisateurs doivent se reconnecter. Les tokens
   agent **ne sont pas** affectés.
4. **Par précaution, si le défaut a été actif** : révoquer les tokens agent de production
   créés depuis le déploiement du Lot 1, puis examiner les journaux disponibles.
5. **Retour arrière** : revenir à la valeur précédente seulement si elle n'était **pas** la
   valeur par défaut.

---

## 5. Vérification de l'environnement de production (CDC §3)

**Accès Vercel : indisponible** (ni CLI, ni compte). Le statut GitHub de « déploiement
réussi » **ne prouve pas** la disponibilité. J'ai donc fait des requêtes publiques en
**lecture seule**, sans authentification, le 8 octobre 2026 :

| Hôte | `GET /api/` | `GET /api/health` | `GET /api/opportunities/count` | `GET /api/agent-tokens` |
|---|---|---|---|---|
| `job-tracker-steel-eight.vercel.app` | 200 · API 2.0.0 « running » | 200 · `healthy`, base `connected` | **401** (route présente) | **401** (route présente) |
| `jobtracker.maadec.com` | 200 | 200 · `healthy`, `connected` | **401** | **401** |

**Interprétation** :
- La production répond et sa base est joignable.
- Les routes du **Lot 1 sont servies** : elles renvoient 401 et non 404.
- **Non vérifiable** sans Vercel : le SHA exact servi (l'API n'expose pas de version de build),
  les variables d'environnement, les journaux d'exécution, le plan Vercel.

**À vérifier de ton côté** : Vercel → *Deployments* → le déploiement « Current » de Production
correspond-il à `7a5415e` ? Ses *Function Logs* contiennent-ils des erreurs ?

---

## 6. Écarts et incohérences relevés

1. **CDC §3** : « 215 tests backend et 42 frontend ont été rapportés réussis » est exact
   (Lot 1, étape 6, puis après `7a5415e`).
2. **CDC §5.2** : `relevance_score`, `relevance_reasons` et `source_evidence` **n'existent pas**
   dans le modèle `Opportunity`. Ils pourraient aller dans `metadata` (10 Ko maximum, clés
   contrôlées) ou dans de nouveaux champs. **À trancher à l'étape 1.**
3. **CDC §5.3** : `get_watch_preferences` et `list_opportunities` côté MCP impliquent des
   lectures, alors que le scope `opportunities:read` n'existe pas. Avec OAuth, les scopes MCP
   seront à définir à l'étape 1.
4. **CDC §4.2 P1** : un MCP de test jetable est nécessaire. Ce n'est pas du code de
   production, mais c'est du code, d'où la **décision D2**.
5. **Planificateur existant probablement inactif en production** (APScheduler dans le
   `lifespan`, qui ne tourne pas sur Vercel ; voir l'audit précédent §3.3). Sans lien avec le
   Lot 2 V2, qui n'a pas de cron serveur, mais à garder en tête.

---

## 7. Décisions à prendre

| # | Décision | Options |
|---|---|---|
| **D1** | Vérifier S3 en production | (A) tu contrôles les variables Vercel, recommandé · (B) tu m'autorises **une** sonde en lecture seule (§4.4) |
| **D2** | Serveur MCP **de test jetable** pour P1 à P3 | (a) tu m'autorises à écrire un serveur minimal **hors du dépôt** (environnement Python séparé, fichier puits local, tunnel temporaire), sans donnée personnelle ni token JobTracker · (b) tu fournis ton propre serveur de test |
| **D3** | Consentement pour P1 à P3 sur ton compte | Activer le mode développeur, ajouter le MCP de test, créer **des tâches programmées de test**, puis les supprimer après |
| **D4** | Tester aussi la **variante desktop** (`approval_policy = "never"`, ordinateur allumé) ? | Oui ou non. Si c'est la seule voie qui marche, cela change la nature du « sans présence » : l'ordinateur doit rester allumé |
| **D5** | Après la vérification S3 | Si défaut actif : autoriser la rotation (§4.6), en urgence, **indépendamment du Lot 2**. Dans tous les cas : correction du code à l'étape 2 (§4.5) |

---

## 8. Sources (consultées le 8 octobre 2026)

**Lues directement**
- [Create custom MCP server — OpenAI API docs](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Authentication — Plugins](https://developers.openai.com/plugins/build/auth)
- [Scheduled tasks — ChatGPT Learn](https://learn.chatgpt.com/docs/automations)
- [ChatGPT Work admin FAQ — ChatGPT Learn](https://learn.chatgpt.com/docs/enterprise/work-admin-faq)

**Extraits indexés (pages en 403)**
- [Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)
- [Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt)
- [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)
- [Admin controls, security, and compliance for plugins and apps](https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-for-plugins-and-apps)
- [Managing app permissions in ChatGPT](https://help-lb.openai.com/fr-fr/articles/20001495-managing-app-permissions-in-chatgpt) : non lu, aucun extrait spécifique obtenu

**Tiers (contexte uniquement)**
- [harmonic.security — Securing ChatGPT Work](https://www.harmonic.security/resources/securing-chatgpt-work-a-practitioners-guide)
- [knightli.com — approvals guide](https://knightli.com/en/2026/07/12/chatgpt-work-scheduled-tasks-plugins-approvals-guide/)

**STOP : fin de l'étape 0.**
