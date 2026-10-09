# JobTracker — Lot 2 V2 · Étape 0 : archive des preuves P0 à P3

> **Archivé le** : 8 octobre 2026, avant la suppression du prototype.
> **Rapport associé** : [LOT2-V2-ETAPE-0-FAISABILITE.md §0 bis](./LOT2-V2-ETAPE-0-FAISABILITE.md).
> **Aucun secret** : le jeton d'URL du serveur de test n'est pas archivé, et l'adresse du
> tunnel est périmée.

## 1. Verdict

| Test | Verdict | Base |
|---|---|---|
| **P0** Connexion du MCP personnalisé | **GO** | Plugin créé sur le compte réel (ChatGPT **Plus**) ; contrôle MCP en lecture via le tunnel : `initialize` OK, 3 outils (`record_ping` en écriture, `list_pings` et `server_status` en lecture) |
| **P1** Écriture manuelle | **GO** | 1 écriture `P1_TEST_MANUEL_001`, sans confirmation |
| **P2** Tâche programmée | **GO** | 1 écriture `P2_TEST_AUTO_003`, sans confirmation ni interaction, 3 min 54 s après l'heure prévue |
| **P3** Écriture autonome répétée, en absence | **NON EXÉCUTÉ**. **PASS par décision du propriétaire** | Aucune preuve expérimentale. Voir les limites au §5 |

**Décision : GO CONDITIONNEL** (CDC §4.4), décidée explicitement par le propriétaire le
8 octobre 2026 pour poursuivre le projet.

## 2. Puits du serveur : écritures réellement reçues (5 au total)

Contenu intégral de `data/pings.jsonl` au moment de l'archivage (heures UTC ; Paris = UTC+2) :

| # | `received_at` (UTC) | Heure de Paris | `note` | `id` | Origine | Retenu comme preuve |
|---|---|---|---|---|---|---|
| 1 | 2026-10-08T01:44:56.377935Z | 03:44:56 | `P1_TEST_MANUEL_001` | `4ee10c3b-b8e8-452b-810f-b38c2e01435c` | Appel manuel en conversation | **Oui (P1)** |
| 2 | 2026-10-08T01:46:51.405953Z | 03:46:51 | `P2_TEST_AUTO_001` | `152ff8f9-3807-4d61-abfc-dc21a956485f` | Appel direct en conversation : **aucune tâche créée** (page *Scheduled* vérifiée) | Non |
| 3 | 2026-10-08T01:53:38.968396Z | 03:53:38 | `P2_TEST_AUTO_002` | `5d986ef7-c8d8-4927-8075-ec2e46e16430` | Tâche « JobTracker P2 Test » (programmée à 03:51) : exécution programmée **ou** « Run now » | Non (non attribuable) |
| 4 | 2026-10-08T01:54:24.253951Z | 03:54:24 | `P2_TEST_AUTO_002` | `3a6ea42b-c12b-4923-977f-7509ec796445` | Même tâche : « Run now » **ou** exécution programmée | Non (non attribuable) |
| 5 | 2026-10-08T02:09:54.449883Z | 04:09:54 | `P2_TEST_AUTO_003` | `736bcfed-1689-4212-9882-b9f0b6e3815f` | Tâche ponctuelle programmée à **04:06**, **sans aucune interaction** | **Oui (P2)** |

**Détection de doublons** (`check_sink.py`) : `P2_TEST_AUTO_002` a été reçu 2 fois, parce que la
même tâche s'est exécutée deux fois (horaire et « Run now »). Les notes retenues comme preuves
(P1 et `P2_TEST_AUTO_003`) ont chacune été reçues **exactement une fois**.

**Contrôles associés** :
- création de la tâche `P2_TEST_AUTO_002` : 0 écriture (vérifié à 01:49:44 UTC) ;
- création de la tâche `P2_TEST_AUTO_003` : 0 écriture (vérifié à 01:57:16 UTC) ;
- `P2_TEST_AUTO_003` : aucun doublon dans les 90 s suivant sa réception (surveillance jusqu'à
  02:11:31 UTC).

**Journal du serveur** : 5 lignes `record_ping`, identiques au puits. Aucune autre écriture.

## 3. Mesures

- **Retard de l'ordonnanceur ChatGPT** : 2 min 38 s (tâche de 03:51, si l'écriture n°3 est
  l'exécution programmée) et **3 min 54 s** (tâche de 04:06, mesure certaine).
- **Confirmation humaine** : aucune, que ce soit en conversation ou en tâche programmée, sur
  ChatGPT Plus. Cela contredit la documentation (« Write actions by default require
  confirmation »).

## 4. Environnement de test

| Élément | Valeur |
|---|---|
| Compte | Propriétaire, **ChatGPT Plus**, ChatGPT web |
| Serveur | Prototype jetable hors dépôt, SDK `mcp` 2.3.0, streamable HTTP sans état, écoute 127.0.0.1:8765 |
| Exposition | Tunnel rapide Cloudflare (`cloudflared` 2026.10.0), sous-domaine `*.trycloudflare.com` désormais périmé |
| Authentification MCP | **No authentication**, plus une URL à capacité (jeton de 256 bits, non archivé) |
| Garde-fous | Notes limitées à `[A-Za-z0-9 _.:-]{1,80}`, 10 écritures par minute, 100 au total, expiration le 11 octobre 2026 à 01:38 UTC, journaux d'accès désactivés |
| Smoke test local | 13/13 (avant exposition) |
| Empreintes SHA-256 des sources | Voir §7 |

## 5. Limites (P3 non exécuté), à vérifier à l'étape 5 du CDC

1. Absence réelle prolongée : ChatGPT et le navigateur fermés pendant des heures.
2. Récurrence 2 fois par jour et fiabilité sur plusieurs jours.
3. **Authentification OAuth 2.1** du vrai MCP : comportement d'une tâche face à un jeton
   expiré ou à un consentement à renouveler en ton absence (**risque principal**).
4. Écriture groupée (`create_opportunities`, 20 offres au plus).
5. Stabilité dans le temps du comportement « sans confirmation ».
6. Exécutions multiples d'une même tâche (horaire et « Run now ») : l'idempotence est assurée
   côté JobTracker (Lot 1).

## 6. Nettoyage

Voir le rapport de nettoyage dans [LOT2-V2-ETAPE-0-FAISABILITE.md](./LOT2-V2-ETAPE-0-FAISABILITE.md)
(§0 ter). Le prototype a été supprimé après cet archivage, et **n'est donc plus
reproductible** en l'état.

## 7. Empreintes SHA-256 complètes des sources supprimées

```
dedaa0311718ab510489f49d1748a8068d107f3dc8a25d722c2a9c819bbb3860  server.py
2d9516819521577d615a13e9e79ae998e94d07e704583309dfdcf1b0b95c3430  check_sink.py
8fef47e445725a8c7ecd985c21ff5fc463f25183a1f4a8d85cefcdc256ed2eb9  smoke_test.py
b68b0f64a0241e67c1117ec1693ab32fb3b0084ca68f17b2aab3f80135a6f27f  README.md
```
