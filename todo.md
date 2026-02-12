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
- [ ] **Rappels par email/SMS** : 24h et 1h avant l'entretien
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
- [ ] **PWA** : Application installable sur mobile
- [ ] **Mode hors-ligne** : Consulter ses candidatures sans connexion
- [ ] **Notifications push** : Alertes en temps réel

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
- [ ] Configurer le déploiement Vercel pour `jobtracker.maadec.com` (ajout `vercel.json`, `mangum`, config DNS Hostinger)
- [ ] Tester l'application complète (Backend + Frontend)
- [ ] Configurer MongoDB Atlas pour la production
- [ ] Tester l'analyse de CV avec un vrai fichier
- [ ] Vérifier les notifications (email et navigateur)

## 💰 Monétisation Future (P3)
- [ ] **Plan Gratuit** : Limite de X candidatures/mois
- [ ] **Plan Premium** : Illimité + fonctionnalités IA avancées
- [ ] **Intégration Stripe** : Paiement par abonnement

