# 📝 TODO List - JobTracker SaaS

## 🎨 Design & Branding
- [x] Supprimer le badge "Made with Emergent" dans `frontend/public/index.html` (lignes 63-107) pour avoir un look marque blanche.

## ✅ Complété

- [x] **Maintenance & Qualité** :
  - [x] Linting Errors : Corriger les warnings ESLint dans `src/hooks/useTracking.js`, `ApplicationTimeline.jsx`, `MatchingScoreModal.jsx`.
  - [x] Import/Export : Vérifier la prise en compte des entretiens dans l'import (JSON/CSV).
  - [x] **Bug Fix Excel Date** : Correction du bug de date 1970 lors de l'import Excel (ajout support des dates série Excel).
- [x] **Intégration Extension IA (Full)** :
  - [x] Stockage complet des données (Compétences, Expérience, Salaires, Description).
  - [x] Affichage des badges de compétences et détails IA dans le frontend.
  - [x] Support de modification manuelle de tous les champs IA dans le formulaire.

### 🔐 Administration Multi-Tenant
- [x] Créer un modèle `Role` (admin, standard, premium)
- [x] Ajouter le champ `role` au modèle User (défaut: "standard")
- [x] Middleware de vérification des permissions admin
- [x] Dashboard Admin avec statistiques globales :
  - Nombre total d'utilisateurs
  - Nombre de candidatures sur la plateforme
  - Nombre d'entretiens planifiés
  - Utilisateurs actifs (dernière connexion < 7 jours)
  - Graphiques d'évolution (inscriptions, activité)
- [x] Gestion des utilisateurs :
  - Liste des utilisateurs avec recherche/filtres
  - Voir le profil détaillé d'un utilisateur
  - Activer/Désactiver un compte
  - Changer le rôle d'un utilisateur
- [x] Export des statistiques globales (JSON)
- [x] Script `seed_admin.py` pour initialisation admin local

### 📅 Entretiens
- [x] Calendrier multi-vues (jour, semaine, mois, année)
- [x] Autocomplétion recherche candidature dans le formulaire

### 🔧 Corrections UI
- [x] Espacement cartes dashboard "Candidatures récentes"
- [x] Responsive liens longs (Teams, Zoom) dans les cartes entretiens
- [x] Modal détail entretien : espacement entre sections
- [x] Sidebar fixe avec scroll interne
- [x] Page Paramètres : layout 2 colonnes (était entassé à gauche)

## 🔴 Bugs & Corrections UI (P0)
- [ ] (Aucun bug critique en attente)

## 🎓 Fonctionnalités pour Étudiants (P1)
> En se mettant à la place d'un étudiant en recherche de stage/alternance/emploi

### 📊 Suivi Avancé des Candidatures
- [x] **Timeline visuelle** : Voir l'historique complet d'une candidature (envoyé → réponse → entretien → offre)
- [x] **Rappels automatiques** : Notification si pas de réponse après X jours (configurable)
- [x] **Relance suggérée** : Bouton "Relancer" avec génération d'email IA pré-rempli
- [x] **Score de matching** : IA analyse le CV vs offre d'emploi et donne un pourcentage de compatibilité

### 📅 Gestion du Temps
- [x] **Intégration Google Calendar** : Backend OAuth 2.0 complet (nécessite credentials)
- [x] **Section Google Calendar** : UI dans les paramètres avec statut connexion
- [x] **Rappels automatiques par Push** : 24h et 1h avant l'entretien (notifications push)
- [ ] **Rappels par email/SMS** : Envoi d'emails/SMS en complément des push
- [ ] **Préparation entretien** : Checklist personnalisée avant chaque entretien

### 📝 Préparation & Ressources
- [ ] **Banque de questions** : Questions fréquentes par type d'entretien (RH, technique, manager)
- [ ] **Notes d'entretien** : Espace pour prendre des notes pendant/après l'entretien
- [ ] **Feedback post-entretien** : Auto-évaluation (comment ça s'est passé, points à améliorer)
- [ ] **Fiches entreprise** : Infos sur l'entreprise (secteur, taille, culture, avis Glassdoor)

### 🎯 Objectifs & Motivation
- [ ] **Objectifs hebdomadaires** : "Envoyer 10 candidatures cette semaine"
- [ ] **Statistiques personnelles** : Taux de réponse, taux de conversion entretien
- [ ] **Badges/Achievements** : Gamification pour maintenir la motivation
- [ ] **Conseils personnalisés** : L'IA suggère des améliorations basées sur les stats

### 📄 Gestion des Documents
- [x] **Stockage CV** : Plusieurs versions de CV (par secteur/poste)
- [x] **Lettres de motivation** : Templates personnalisables + génération IA
- [x] **Portfolio** : Lien vers projets GitHub, portfolio en ligne
- [x] **Suivi des documents envoyés** : Quel CV/LM envoyé à quelle entreprise
- [x] **Sélecteur CV dans candidatures** : Dropdown pour associer un CV

### 🔍 Recherche d'Emploi Intelligente
- [ ] **Agrégation d'offres** : Import automatique depuis LinkedIn, Indeed, APEC, Welcome to the Jungle
- [ ] **Alertes personnalisées** : Notification quand une offre correspond au profil
- [ ] **Candidature en 1 clic** : Pré-remplir les formulaires avec les infos du profil
- [ ] **Suivi des offres sauvegardées** : Bookmarker des offres pour postuler plus tard

### 👥 Réseau & Contacts
- [ ] **Carnet de contacts** : Stocker les contacts (recruteurs, RH, managers)
- [ ] **Historique des échanges** : Notes sur chaque interaction
- [ ] **LinkedIn integration** : Voir le profil LinkedIn du recruteur

### 📱 Mobile & Accessibilité
- [x] **PWA** : Application installable sur mobile (manifest.json, service-worker, icônes)
- [x] **Mode hors-ligne** : Consulter ses candidatures sans connexion (Service Worker avec cache)
- [x] **Notifications push** : Alertes en temps réel (Web Push API, VAPID)

## 🧩 Extension Chrome (Automation)
- [x] **Job Clipper (Basique)** : Détection via sélecteurs CSS (LinkedIn/Indeed).
- [x] **Job AI Parser** : Extraction IA automatique du contenu de la page (Salaire, Stack, Expérience, Description).
- [ ] **Auto-Fill** : Remplissage automatique des formulaires de candidature (Lever, Greenhouse) avec les infos du profil stockées dans JobTracker.

## 🤖 Configuration IA Multi-Provider
- [x] **Support Groq** : Ajout de Groq comme fournisseur d'API (Llama 3.3 70B, Mixtral, Gemma 2)
- [x] **Sélection de modèle** : Dropdown pour choisir le modèle IA dans le chatbot
- [x] **Modèles disponibles** :
  - OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo
  - Google: Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash
  - Groq: Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B, Gemma 2 9B
- [x] **Endpoint extraction IA** : `/api/ai/extract-job` pour l'extension Chrome

## 🚀 Déploiement & Production (P2)
- [x] Configurer le déploiement Vercel (monorepo, `vercel.json` avec routage SPA et Python backend)
- [x] Optimisation de la taille du build (suppression pandas, numpy, boto3 pour la limite de 250MB)
- [x] Configurer MongoDB Atlas pour la production (Cluster Free configuré)
- [x] Correction des erreurs FS (utilisation de `/tmp/` pour les uploads sur Vercel)
- [x] Correction des compatibilités (bcrypt 3.2.2 pour passlib)
- [x] Configurer les credentials Google Cloud (OAuth Client ID) pour l'URL de prod
- [ ] Tester l'analyse de CV avec un vrai fichier sur la prod
- [ ] Vérifier les notifications (email et navigateur) en prod

## 💰 Monétisation Future (P3)
- [ ] **Plan Gratuit** : Limite de X candidatures/mois
- [ ] **Plan Premium** : Illimité + fonctionnalités IA avancées
- [ ] **Intégration Stripe** : Paiement par abonnement

---

## 🏢 VERSION B2B - Plateforme Multi-Tenant pour Écoles & Institutions (P4)

> Transformer JobTracker en plateforme institutionnelle scalable pour écoles, bootcamps, cabinets RH et agences de placement. Capitalise sur le backend existant (FastAPI + MongoDB multi-user) et l'admin panel déjà présent.

### 🎯 Vision B2B
Permettre aux institutions de centraliser le suivi emploi de leurs étudiants/alumni, avec preuves data pour accréditations, différenciation marketing, et économies opérationnelles.

---

### 🔷 Phase 1 : Fonctionnalités B2B Essentielles (MVP B2B)

#### 1.1 Multi-Tenant Complet
- [ ] **Modèle Organisation** : Nouveau modèle `Organization` (id, name, slug, logo_url, domain_custom, plan, created_at)
- [ ] **Isolation des données** : Champ `organization_id` sur tous les modèles (users, applications, interviews, documents)
- [ ] **Hiérarchie admin** :
  - `super_admin` : Accès global plateforme (équipe JobTracker)
  - `org_admin` : Admin d'une organisation (directeur école, responsable RH)
  - `org_manager` : Gestionnaire local (coach carrière, tuteur)
  - `org_member` : Utilisateur standard (étudiant, alumni)
- [ ] **Middleware tenant** : Filtrage automatique des requêtes par `organization_id` du JWT
- [ ] **Sous-domaine/domaine custom** : `mon-ecole.jobtracker.fr` ou `carriere.mon-ecole.fr`

#### 1.2 Dashboard Admin Central (Organisation)
- [ ] **Stats agrégées temps réel** :
  - Taux de placement global (% étudiants embauchés en <3/6/12 mois)
  - Temps moyen à l'embauche (jours entre inscription et 1ère offre acceptée)
  - ROI formation (salaires moyens post-embauche vs coût formation)
  - Taux de réponse employeurs (par secteur, région)
- [ ] **Graphiques Recharts étendus** :
  - Évolution cohortes (comparaison promo 2024 vs 2025)
  - Funnel emploi (candidatures → entretiens → offres → embauches)
  - Heatmap activité (jours/heures les plus actifs)
  - Répartition géographique des embauches (carte France/monde)
- [ ] **Filtres avancés** : Par promo, domaine (tech, marketing, data), région, période
- [ ] **Alertes dashboard** : Étudiants inactifs >7j, taux réponse en baisse, deadline promo

#### 1.3 Gestion Utilisateurs en Masse
- [ ] **Invitation email** : Envoi d'invitations personnalisées avec lien d'inscription pré-rempli
- [ ] **Import CSV/Excel** : 
  - Template téléchargeable (colonnes : email, nom, prénom, promo, domaine, date_fin_formation)
  - Validation des données avant import
  - Rapport d'erreurs détaillé
  - Import jusqu'à 1000 utilisateurs par batch
- [ ] **Rôles organisation** :
  - `etudiant` : En formation active
  - `alumni` : Diplômé (accès lifetime)
  - `coach` : Accompagnateur carrière (voit ses coachés)
  - `admin_org` : Gestion complète
- [ ] **Activation/Désactivation auto** :
  - Activation automatique à la date de début de formation
  - Passage en mode "alumni" à la date de fin
  - Désactivation après X mois d'inactivité (configurable)
- [ ] **Groupes/Cohortes** : Regroupement par promo (ex: "Data 2025"), spécialité, campus

#### 1.4 Reporting Avancé
- [ ] **Exports personnalisés** :
  - Format Excel (.xlsx) avec mise en forme pro
  - Format PDF avec logo école et graphiques
  - Filtres : par promo, domaine, région, période, statut
- [ ] **KPIs institutionnels** :
  - Taux de placement à 3/6/12 mois
  - Salaire moyen/médian par promo et domaine
  - Nombre moyen de candidatures avant embauche
  - Durée moyenne du processus de recrutement
  - Top 10 entreprises qui recrutent les alumni
- [ ] **Conformité RGPD** :
  - Export données personnelles (droit d'accès)
  - Anonymisation pour rapports publics
  - Suppression automatique après X ans (configurable)
  - Logs de consentement
- [ ] **Rapports planifiés** : Envoi automatique hebdo/mensuel aux admins (email)

#### 1.5 Notifications Cross-Tenant
- [ ] **Alertes admins** :
  - Étudiants inactifs depuis X jours
  - Fin de formation approchant
  - Objectifs non atteints (ex: <5 candidatures/semaine)
- [ ] **Notifications globales** :
  - Nouvelles offres partenaires
  - Événements carrière (job dating, webinaires)
  - Annonces importantes
- [ ] **Canaux d'intégration** :
  - Slack : Webhook vers channel dédié
  - Microsoft Teams : Connecteur Teams
  - Email pro : Templates personnalisés
  - SMS : Pour alertes critiques (via Twilio)

---

### 🔶 Phase 2 : Fonctionnalités B2B Avancées (Up-sell 200-1000€/mois)

#### 2.1 Partenariats Employeurs
- [ ] **Matching IA étudiant → offres** :
  - Algorithme de scoring (compétences, localisation, salaire souhaité)
  - Suggestions automatiques aux étudiants
  - Notification "Nouvelle offre compatible à 85%"
- [ ] **Portail offres privées** :
  - Espace employeurs partenaires pour poster des offres exclusives
  - Visibilité restreinte aux étudiants de l'école
  - Statistiques pour l'employeur (vues, candidatures)
- [ ] **Co-branding** :
  - Logo école sur les candidatures envoyées via la plateforme
  - Template email "recommandé par [École]"
  - Badge "Alumni certifié [École]" sur profil LinkedIn (via API)

#### 2.2 Analytics Prédictifs (IA)
- [ ] **Forecast taux de placement** :
  - Modèle ML basé sur historique des promos précédentes
  - Prédiction à 3/6/12 mois
  - Variables : activité plateforme, secteur, région, saisonnalité
- [ ] **Benchmarks anonymisés** :
  - Comparaison vs autres écoles du même secteur (data agrégée)
  - Positionnement sur les KPIs clés
- [ ] **Alertes "risque échec emploi"** :
  - Score de risque par étudiant (0-100)
  - Facteurs : inactivité, CV incomplet, peu d'entretiens
  - Déclenchement automatique de coaching prioritaire

#### 2.3 Coaching Groupé
- [ ] **Webinaires intégrés** :
  - Intégration Zoom/Meet pour sessions live
  - Replay stocké dans la plateforme
  - Tracking présence et engagement
- [ ] **Templates école** :
  - CV template officiel de l'école
  - Modèle de profil LinkedIn optimisé
  - Guide de candidature par secteur
- [ ] **Chatbot IA customisé** :
  - Persona adapté à l'école (ton, exemples sectoriels)
  - Connaissance des partenaires employeurs
  - FAQ spécifiques (ex: "Comment contacter le career center?")

#### 2.4 Import Massif & Migrations
- [ ] **Onboarding historique** :
  - Import CV alumni des 5 dernières années
  - Parsing automatique des PDF pour extraction données
  - Enrichissement via LinkedIn (avec consentement)
- [ ] **Connecteurs SIRH** :
  - API Workday (import/export employés)
  - API SAP SuccessFactors
  - API Oracle HCM
- [ ] **Migration LinkedIn Recruiter** :
  - Import des candidats trackés
  - Mapping des statuts

#### 2.5 Gamification
- [ ] **Système de badges** :
  - "Premier entretien décroché"
  - "10 candidatures envoyées"
  - "Offre acceptée en <30 jours"
  - Badges personnalisés par école
- [ ] **Leaderboards** :
  - Classement par taux de réponse
  - Classement par nombre d'entretiens
  - Anonymisation optionnelle
- [ ] **Concours internes** :
  - "Meilleure lettre de motivation" (vote des pairs)
  - "CV le plus consulté par les recruteurs"
  - Prix/récompenses école

#### 2.6 Intégrations Pro
- [ ] **LMS (Learning Management System)** :
  - Moodle : Sync notes → profil étudiant
  - Canvas : Import parcours formation
  - 360Learning : Badges certifications
- [ ] **Suites bureautiques** :
  - Google Workspace : Drive (CV), Calendar (entretiens), Gmail (notifications)
  - Microsoft 365 : OneDrive, Outlook, Teams
- [ ] **ATS (Applicant Tracking System)** :
  - Lever : Sync statuts candidatures
  - Greenhouse : Import offres partenaires
  - Workable : Webhook événements
- [ ] **CRM Éducation** :
  - Salesforce Education Cloud
  - HubSpot for Education
  - Pipedrive

#### 2.7 White-Label Complet
- [ ] **Domaine personnalisé** :
  - `carriere.mon-ecole.fr` avec certificat SSL
  - Redirection depuis sous-domaine JobTracker
- [ ] **Personnalisation visuelle** :
  - Upload logo (header, favicon, emails)
  - Couleurs primaires/secondaires (CSS variables)
  - Police personnalisée
- [ ] **Suppression mentions JobTracker** :
  - Footer, emails, exports PDF
  - Option "Powered by JobTracker" pour plans intermédiaires

#### 2.8 Conformité & Audit
- [ ] **Logs d'audit** :
  - Historique de toutes les actions admin
  - Export pour compliance (RGPD, audits qualité)
  - Rétention configurable (1-7 ans)
- [ ] **Certificats de placement** :
  - PDF signé numériquement
  - QR code de vérification
  - Utilisable pour accréditations (France Compétences, Qualiopi)
- [ ] **Outils RGPD avancés** :
  - Gestion consentements granulaire
  - Portabilité données (export complet JSON)
  - Droit à l'oubli (suppression irréversible)
  - DPO dashboard (Data Protection Officer)

#### 2.9 Mobile App Wrapper
- [ ] **PWA avancée** :
  - Mode offline complet (IndexedDB sync)
  - Push notifications riches (images, actions)
  - Installation guidée sur iOS/Android
- [ ] **App native light** (optionnel) :
  - React Native wrapper de la PWA
  - Publication App Store / Play Store
  - Notifications natives

#### 2.10 API Entreprise
- [ ] **Webhooks sortants** :
  - Événements : nouvelle candidature, entretien planifié, offre acceptée
  - Payload personnalisable
  - Retry automatique et logs
- [ ] **API REST documentée** :
  - OpenAPI 3.0 / Swagger UI
  - Authentification OAuth2 / API Key
  - Rate limiting par plan
- [ ] **Intégration payroll** :
  - Sync salaire post-embauche (pour calcul ROI)
  - Connexion SIRH école
  - Anonymisation pour benchmarks

---

### 💰 Modèle de Pricing B2B

| Plan | Prix/mois | Utilisateurs | Fonctionnalités |
|------|-----------|--------------|-----------------|
| **Starter** | 99€ | Jusqu'à 50 | Multi-tenant basique, Dashboard, Import CSV, Exports Excel |
| **Pro** | 299€ | Jusqu'à 200 | + Reporting avancé, Notifications Slack/Email, Coaching IA |
| **Business** | 599€ | Jusqu'à 500 | + Analytics prédictifs, Intégrations ATS/LMS, White-label partiel |
| **Enterprise** | 999€+ | Illimité | + White-label complet, API, SLA, Support dédié, Custom dev |

**Options à la carte** :
- Domaine personnalisé : +50€/mois
- App mobile native : +100€/mois
- Intégration SIRH custom : Sur devis

---

### 🎯 Bénéfices pour une École (ROI)

#### Amélioration Employabilité
- Tracking centralisé → **+30-50% taux de placement** (stats via dashboard)
- Preuve ROI pour accréditation Pôle Emploi / France Compétences / Qualiopi
- Identification précoce des étudiants en difficulté

#### Différenciation Marketing
- "**98% de nos alumni embauchés en <3 mois**" (preuves data exportables)
- Témoignages auto-générés via IA
- Rankings et benchmarks vs concurrents

#### Économies Opérationnelles
- Onboarding auto promo : **500 étudiants importés en 1 clic**
- Coaching IA scale : pas besoin de 10 career coaches FTE
- Automatisation rappels et relances

#### Revenus Indirects
- Commissions employeurs (**5% sur embauches** via plateforme partenaire)
- Upsell alumni lifetime (services post-diplôme)
- Sponsoring entreprises sur portail offres

#### Rétention Alumni
- Portail lifelong (suivi carrière 5+ ans)
- Événements jobs (calendrier partagé)
- Réseau alumni actif

---

### 🚀 Roadmap d'Implémentation B2B

#### Sprint 1 (2 semaines) - Fondations Multi-Tenant
- [ ] Modèle `Organization` + migrations
- [ ] Middleware tenant isolation
- [ ] Extension modèle `User` avec `organization_id`
- [ ] Admin super_admin vs org_admin

#### Sprint 2 (2 semaines) - Dashboard Organisation
- [ ] Stats agrégées par organisation
- [ ] Graphiques cohortes et funnel
- [ ] Filtres avancés

#### Sprint 3 (2 semaines) - Gestion Utilisateurs Masse
- [ ] Import CSV avec validation
- [ ] Invitation email batch
- [ ] Rôles et groupes/cohortes

#### Sprint 4 (2 semaines) - Reporting & Exports
- [ ] Export Excel/PDF personnalisé
- [ ] KPIs institutionnels
- [ ] Rapports planifiés

#### Sprint 5 (2 semaines) - Intégrations & Polish
- [ ] Webhooks Slack/Teams
- [ ] Conformité RGPD v1
- [ ] Tests avec 1-2 écoles pilotes

#### Post-MVP - Itérations
- Analytics prédictifs
- Partenariats employeurs
- White-label
- App mobile

---

### 📞 Go-to-Market B2B

1. **Écoles pilotes** : Contacter 2-3 bootcamps/écoles (MBA Big Data, écoles IA) pour beta gratuite
2. **Case study** : Documenter résultats (taux placement avant/après)
3. **Pricing validation** : Tester acceptabilité 299-599€/mois
4. **Stripe Billing** : Facturation récurrente automatisée
5. **Sales outreach** : LinkedIn, salons emploi formation, partenariats France Compétences

