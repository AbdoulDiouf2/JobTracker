# JobTracker — Lot 2 V2 · Protocole de faisabilité P0 à P3

> **Référence** : [CDC-LOT2-JOBTRACKER-V2.md](./CDC-LOT2-JOBTRACKER-V2.md) §4 et
> [LOT2-V2-ETAPE-0-FAISABILITE.md](./LOT2-V2-ETAPE-0-FAISABILITE.md).
> Ce protocole **remplace les §2 et §3** de ce rapport : les définitions de P0 à P3 sont celles
> que tu as validées le 8 octobre 2026.
> **Date** : 8 octobre 2026.
> **Exécutant** : le propriétaire, sur son compte ChatGPT réel. Je n'ai pas accès au compte.

## Principe

**On ne suppose pas que les tâches ChatGPT programmées savent appeler un MCP. On le démontre.**

- **Documenté** (voir le rapport d'étape 0) :
  - les tâches peuvent utiliser des plugins ;
  - les écritures MCP demandent une confirmation par défaut.
- **Non documenté** : qu'une tâche web appelle un MCP **personnalisé** en écriture, **sans
  confirmation**, en ton absence.

La réussite se mesure **uniquement** dans le **puits** du serveur de test, c'est-à-dire les
écritures réellement reçues. Ni la création d'une tâche, ni un message de ChatGPT ne valent
preuve.

| Test | Question | Verdict attendu |
|---|---|---|
| **P0** | Le MCP personnalisé se connecte-t-il à ChatGPT ? | GO / NO-GO |
| **P1** | Un appel **manuel** à l'outil d'écriture aboutit-il ? | GO / NO-GO |
| **P2** | Une **tâche programmée** peut-elle utiliser le MCP ? | GO / GO avec confirmation / NO-GO |
| **P3** | Une tâche écrit-elle **seule, sans confirmation, une seule fois par exécution** ? | GO / NO-GO |

**Règle d'arrêt** : un NO-GO à une étape arrête la suite sur le web. On passe alors
éventuellement à la variante desktop (§7), puis à l'arbitrage du CDC §4.4.

---

## 0. Prérequis communs (une seule fois)

| # | Action | Qui |
|---|---|---|
| Q1 | Noter le **nom exact de ton plan ChatGPT** (Paramètres → Compte) | Toi |
| Q2 | Lire la fiche [lot2-mcp-poc/README.md](../../../../lot2-mcp-poc/README.md) : hébergement, durée de vie, authentification, nettoyage. **À lire avant toute exposition publique** | Toi |
| Q3 | Installer `cloudflared` : `winget install --id Cloudflare.cloudflared` | Toi |
| Q4 | Lancer `smoke_test.py` : **13/13** attendu | Toi (ou moi, sur ta demande) |
| Q5 | Démarrer le serveur et le tunnel (README §5), puis noter l'**URL MCP** `https://<sous-domaine>.trycloudflare.com/<jeton>/mcp`. **Ne la publie nulle part** | Toi |
| Q6 | Prévoir une **feuille de résultats** (§8) et des captures **sans l'URL complète** (masquer le jeton) | Toi |

**Interdits pendant tout le protocole** :
- aucun token `jt_agent_` ;
- aucune donnée personnelle dans les notes ;
- aucun autre plugin d'écriture activé dans les conversations ou tâches de test.

---

## P0 — Connexion du MCP personnalisé à ChatGPT

**Prérequis** : Q1 à Q5 faits, serveur et tunnel actifs.

**Étapes** :
1. ChatGPT **web** → Paramètres → *Apps & Plugins* (ou *Connectors*) → *Avancé* : activer le
   **mode développeur**. 📸 Capture de l'écran, avec le plan visible si possible.
2. *Plugins* → **+** → **Add custom MCP server**. 📸
3. Remplir :
   - **Nom** : `JobTracker POC (test)` ;
   - **Description** : `Serveur de test sans donnée personnelle` ;
   - **Server URL** : l'URL MCP (Q5) ;
   - **Authentification** : **No authentication**.
4. *Create* (ou *Create as a plugin*). 📸 Capture de l'écran de résultat.
5. Ouvrir le détail du plugin : noter les **outils listés** et leur éventuel marquage
   lecture/écriture. 📸
6. Noter **mot pour mot** tout message du type « lecture seule », « écriture non disponible
   sur votre plan » ou « confirmation requise ».

**Résultat attendu** : le plugin est créé et les **3 outils** sont visibles : `record_ping`,
`list_pings`, `server_status`.

| Verdict | Critère |
|---|---|
| **GO** | Plugin créé, 3 outils listés, `record_ping` utilisable (pas d'interdiction d'écriture sur ton plan) |
| **NO-GO** | Option « Add custom MCP server » absente sur ton plan · écriture interdite sur ton plan · échec de connexion persistant après les vérifications du §6 |

---

## P1 — Appel manuel d'une opération d'écriture

**Prérequis** : P0 en GO.

**Étapes** :
1. Ouvrir une **nouvelle conversation** et activer **uniquement** le plugin
   `JobTracker POC (test)`.
2. Envoyer exactement :
   > Utilise l'outil `server_status` du plugin JobTracker POC et affiche le résultat.

   C'est un contrôle en lecture : le plugin répond-il ? 📸
3. Envoyer exactement, en remplaçant la date et l'heure :
   > Utilise l'outil `record_ping` du plugin JobTracker POC avec la note exacte
   > `P1-20261008-1530`. Appelle-le **une seule fois**, puis affiche la réponse de l'outil.
4. **Si une demande de confirmation apparaît : capture 📸, puis l'approuver.** Noter le texte
   exact et les options proposées (par exemple « Toujours autoriser » existe-t-il ?).
5. Dans PowerShell :
   `.\.venv\Scripts\python.exe check_sink.py P1-` 📸

**Résultat attendu** :
- `check_sink` indique **1 entrée** `P1-…` et « Aucun doublon » ;
- la réponse affichée dans ChatGPT contient `"recorded": true`.

| Verdict | Critère |
|---|---|
| **GO** | Exactement 1 écriture `P1-…` dans le puits. La présence ou non d'une confirmation est **notée** : c'est l'information clé pour P3 |
| **NO-GO** | Outil non appelable · erreur persistante · aucune écriture dans le puits |
| *À analyser* | 2 écritures ou plus pour la même note : ChatGPT a rappelé l'outil. Ce n'est pas bloquant en soi, puisque la déduplication serveur le compensera en vrai, mais il faut le signaler |

**Option à noter si elle existe** : une préférence « toujours autoriser » ou « ne plus
demander » pour cet outil. **Ne l'active pas encore** ; note seulement son existence. Elle
pourrait conditionner P3.

---

## P2 — Utilisation du MCP depuis une tâche programmée (en ta présence)

**But** : savoir si une tâche **peut seulement voir et appeler** le plugin, indépendamment de
la confirmation.

**Prérequis** :
- P1 en GO ;
- **ton accord explicite** pour créer une tâche de test ;
- serveur et tunnel actifs.

**Étapes** :
1. Page **Scheduled** (barre latérale) → nouvelle tâche **ponctuelle**, à **H+10 minutes**.
   Si la tâche se crée depuis une conversation, partir d'une conversation où **seul** le
   plugin de test est activé. 📸
2. Instruction de la tâche, exacte :
   > Appelle l'outil `record_ping` du plugin JobTracker POC avec la note exacte
   > `P2-20261008-1600`. Un seul appel. Ne fais rien d'autre et n'appelle aucun autre outil.
3. 📸 **Point clé** : lors de la création, le plugin est-il proposé ou sélectionnable pour la
   tâche ? Si l'interface ne permet pas de l'associer, **le noter**.
4. **Rester devant l'écran** au moment de l'exécution et observer :
   - une notification ou une demande de **confirmation** apparaît-elle ?
   - l'historique de la tâche indique-t-il succès, échec ou attente ? 📸
5. Si une confirmation est demandée : **capture 📸, puis l'approuver**, et noter le délai
   accepté avant expiration s'il est affiché.
6. `.\.venv\Scripts\python.exe check_sink.py P2-` 📸

**Résultat attendu** : 1 entrée `P2-…`, horodatée **à l'heure prévue** (à quelques minutes
près), aucun doublon.

| Verdict | Critère |
|---|---|
| **GO** | 1 écriture reçue, **sans** confirmation |
| **GO avec confirmation** | 1 écriture reçue, **uniquement après** ton approbation. P3 sera vraisemblablement NO-GO, mais il faut le tester |
| **NO-GO** | Plugin non disponible ou non sélectionnable dans la tâche · exécution en échec · aucune écriture dans le puits |

---

## P3 — Écriture autonome et unique, sans confirmation humaine

**But** : prouver le critère cardinal du CDC, à savoir des exécutions programmées qui écrivent
**sans aucune intervention**, **une seule fois** chacune.

**Prérequis** :
- P2 en GO, ou en GO avec confirmation (pour mesurer l'effet de ton absence) ;
- **ton accord explicite** ;
- PC, serveur et tunnel **allumés et éveillés** pendant toute la fenêtre (mise en veille
  désactivée) ;
- expiration du serveur au-delà de la fin du test.

**Étapes** :
1. Créer une tâche **récurrente quotidienne à 2 horaires** dans la même journée. Par exemple
   **12:00 et 18:00**, ou les deux prochains créneaux possibles sur ton plan. 📸
2. Instruction de la tâche, exacte :
   > Appelle l'outil `record_ping` du plugin JobTracker POC **une seule fois**, avec la note
   > `P3-` suivie de la date et de l'heure **actuelles** au format `AAAAMMJJ-HHMM`
   > (exemple : `P3-20261009-1200`). N'appelle aucun autre outil.
3. **Te rendre absent** :
   - fermer **tous** les onglets et l'application ChatGPT ;
   - ne répondre à **aucune** notification ChatGPT jusqu'au contrôle ;
   - ne pas rouvrir ChatGPT entre les deux horaires.
4. **Après le second horaire**, et **avant** de rouvrir ChatGPT :
   `.\.venv\Scripts\python.exe check_sink.py P3-` 📸
5. **Ensuite seulement**, ouvrir ChatGPT, puis l'historique des deux exécutions : succès,
   échec, confirmation en attente ? 📸 Noter les éventuelles notifications reçues.
6. Optionnel (fiabilité) : laisser tourner **un jour de plus** et refaire les étapes 4 et 5.

**Résultat attendu** :
- `check_sink P3-` montre **2 entrées**, une par horaire, chacune **à l'heure prévue**, et
  « Aucun doublon » ;
- l'historique des deux exécutions est en succès, **sans** confirmation en attente.

| Verdict | Critère |
|---|---|
| **GO** | **2 exécutions sur 2** ont écrit **exactement une fois** chacune, **sans aucune intervention**, à l'heure prévue |
| **NO-GO** | Une exécution au moins attend une confirmation · échoue · n'écrit rien · a eu besoin que ChatGPT soit ouvert ou que tu interviennes |
| *GO conditionnel* | 2 écritures sans intervention, **mais** avec doublons ou un écart horaire important. Uniquement sur ta décision explicite (CDC §4.4), limites consignées |

> **Idempotence** : le serveur de test n'empêche **pas** volontairement les doublons, pour que
> P3 mesure le comportement réel de ChatGPT. Dans l'intégration finale, la déduplication de
> JobTracker (URL et `external_id`) neutralisera les répétitions. Un doublon en P3 est donc
> **signalé**, sans être bloquant à lui seul.

---

## 6. Dépannage (sans modifier le code)

| Symptôme | Vérification |
|---|---|
| Échec de connexion en P0 | Serveur et tunnel actifs ? URL complète, avec `/mcp` à la fin ? Le jeton correspond-il à `.poc_token` ? |
| Erreur 421 ou 403 | Le tunnel est-il lancé avec `--http-host-header 127.0.0.1:8765` ? |
| `expired` | `POC_EXPIRES_AT` dépassé : relancer le serveur avec une nouvelle expiration |
| `rate_limited` / `quota_exhausted` | 10 écritures par minute ou 100 au total atteints. Normal en cas d'abus ; sinon, me signaler les chiffres |
| URL `trycloudflare.com` changée | Elle change à **chaque** relance du tunnel : mettre à jour l'URL du plugin dans ChatGPT |

Tout autre blocage : me transmettre le **message d'erreur exact** affiché par ChatGPT,
**sans l'URL**. Toute modification du prototype demandera ton autorisation.

## 7. Variante desktop (repli, D4) — seulement si P2 ou P3 échouent sur le web

La documentation mentionne que les tâches de l'**application desktop** liées à un **projet
local** peuvent utiliser des serveurs MCP, avec une politique d'approbation qui peut valoir
« never » si l'organisation le permet.

Protocole :
1. Rejouer **P2 puis P3** depuis l'application desktop, en déclarant le même MCP.
2. Noter s'il est ajouté comme plugin ou dans la configuration MCP du projet, et s'il existe un
   réglage d'approbation « jamais ».
3. Mêmes critères GO / NO-GO.

**Limite à consigner** : « sans présence » voudra dire « PC allumé et application desktop
ouverte ».

## 8 bis. Résultats obtenus (8 octobre 2026)

Voir [LOT2-V2-ETAPE-0-FAISABILITE.md §0 bis](./LOT2-V2-ETAPE-0-FAISABILITE.md) :
- **P0, P1 et P2 en GO** ;
- **P3 en PASS par décision du propriétaire (non exécuté)** ;
- **verdict : GO conditionnel**, limites consignées.

## 8. Feuille de résultats (à me renvoyer, sans URL ni secret)

| Test | Date et heure | Plan | Verdict | Confirmation demandée ? (texte exact) | `check_sink` (nombre d'entrées / doublons) | Observations |
|---|---|---|---|---|---|---|
| P0 | | | | | — | Outils listés : |
| P1 | | | | | | Option « toujours autoriser » ? |
| P2 | | | | | | Plugin sélectionnable dans la tâche ? |
| P3 run 1 | | | | | | |
| P3 run 2 | | | | | | |
| (Desktop) | | | | | | |

## 9. Décision (CDC §4.4)

- **GO** : P0 à P3 en GO, et S3 maîtrisée (fait : `ef07ab6` en Production). On passe à
  l'étape 1 du CDC.
- **NO-GO** : on arrête le CDC. Tu choisis entre :
  - (a) un MCP interactif avec envoi manuel ;
  - (b) attendre une prise en charge native ;
  - (c) un nouveau cadrage.

  **Jamais de veille côté serveur** (CDC §1).
- **GO conditionnel** : uniquement sur ta décision explicite, avec les limites consignées.

## 10. Après les tests

Le **nettoyage complet** (README du prototype, §6) est obligatoire, quelle que soit l'issue :
tâches, plugin, mode développeur, tunnel, serveur, puits, dossier.
