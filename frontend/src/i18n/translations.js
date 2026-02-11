export const translations = {
  fr: {
    // Navigation
    nav: {
      features: 'Fonctionnalités',
      analytics: 'Analytique',
      ai: 'IA',
      architecture: 'Architecture',
      getInTouch: 'Me Contacter',
    },
    
    // Hero Section
    hero: {
      badge: 'Suivi d\'Emploi Propulsé par l\'IA',
      title1: 'Suivez vos Candidatures.',
      title2: 'Analysez vos Performances.',
      title3: 'Optimisez Votre Carrière avec l\'IA.',
      description: 'Une plateforme full-stack intelligente qui transforme la gestion de vos candidatures. Propulsée par Google Gemini Pro et OpenAI GPT-3.5 pour des conseils de carrière intelligents.',
      ctaDemo: 'Voir la Démo',
      ctaArchitecture: 'Explorer l\'Architecture',
      dashboard: {
        title: 'Tableau de Bord',
        totalApps: 'Candidatures Totales',
        interviews: 'Entretiens',
        thisWeek: 'cette semaine',
        responseRate: 'Taux de Réponse',
        aboveAvg: 'Au-dessus moy.',
        seniorEngineer: 'Ingénieur Senior',
        fullStackDev: 'Développeur Full Stack',
        backendLead: 'Lead Backend',
        interview: 'Entretien',
        applied: 'Candidaté',
        inReview: 'En Cours',
      },
      aiAdvisor: 'Conseiller IA',
      active: 'Actif',
    },
    
    // Features Section
    features: {
      label: 'Fonctionnalités',
      title1: 'Tout ce qu\'il Vous Faut pour',
      title2: 'Décrocher le Job de vos Rêves',
      description: 'Une boîte à outils complète conçue pour les chercheurs d\'emploi modernes qui veulent rester organisés et stratégiques.',
      items: [
        {
          title: 'Gestion des Candidatures',
          description: 'Suivi centralisé de toutes vos candidatures avec statuts personnalisés et notes.'
        },
        {
          title: 'Planification d\'Entretiens',
          description: 'Gérez vos entretiens à venir, définissez des rappels et suivez les résultats.'
        },
        {
          title: 'Filtrage Intelligent',
          description: 'Capacités de recherche et filtrage puissantes pour trouver vos candidatures instantanément.'
        },
        {
          title: 'Système de Favoris',
          description: 'Marquez les candidatures prioritaires et accédez-y rapidement depuis votre tableau de bord.'
        },
        {
          title: 'Suivi des Statuts',
          description: 'Suivez les étapes de candidature de Candidaté à Offre avec des indicateurs visuels.'
        },
        {
          title: 'Opérations en Masse',
          description: 'Mettez à jour plusieurs candidatures en une fois avec des actions par lot puissantes.'
        },
      ]
    },
    
    // Analytics Section
    analytics: {
      label: 'Analytique',
      title1: 'Décisions de Carrière',
      title2: 'Basées sur les Données',
      description: 'Obtenez des insights précieux sur votre recherche d\'emploi avec des analyses complètes. Suivez les taux de réponse, les conversions d\'entretiens et les tendances de candidatures.',
      kpis: {
        responseRate: 'Taux de Réponse',
        interviewConversion: 'Conversion Entretien',
        avgResponseTime: 'Temps Réponse Moy.',
        activeApplications: 'Candidatures Actives',
      },
      chart: {
        title: 'Évolution des Candidatures',
        last30: '30 derniers jours',
        last90: '90 derniers jours',
        thisYear: 'Cette année',
        applications: 'Candidatures',
        currentMonth: 'Mois en cours',
      }
    },
    
    // AI Section
    ai: {
      label: 'Intelligence IA',
      title1: 'Propulsé par une',
      title2: 'IA Avancée',
      description: 'Exploitant Google Gemini Pro et OpenAI GPT-3.5 pour des conseils de carrière intelligents et une assistance en temps réel.',
      advisor: {
        title: 'Conseiller de Carrière IA',
        poweredBy: 'Propulsé par Google Gemini Pro',
        features: [
          'Recommandations de stratégie de carrière personnalisées',
          'Analyse de CV/Resume (support PDF & Word)',
          'Analyse des tendances du marché et insights',
          'Conseils de préparation aux entretiens',
          'Cache intelligent avec cooldown 60s & rétention 24h'
        ],
        uploadCv: 'Téléchargez votre CV pour analyse IA',
      },
      chatbot: {
        title: 'Assistant Chatbot IA',
        poweredBy: 'Propulsé par OpenAI GPT-3.5',
        messages: [
          { role: 'user', message: 'Comment dois-je me préparer pour un entretien ingénieur senior chez un GAFAM ?' },
          { role: 'ai', message: 'Basé sur votre profil, concentrez-vous sur ces domaines clés :\n\n1. System Design - Pratiquez la conception de systèmes scalables\n2. Comportemental - Utilisez la méthode STAR avec vos exemples de projets\n3. Coding - Problèmes LeetCode medium/hard\n\nVotre expérience Flask + IA est un différenciateur fort. Mettez en avant le projet Job Tracking !' },
          { role: 'user', message: 'Quel est mon taux de succès actuel ?' },
          { role: 'ai', message: 'Votre taux de réponse est de 34%, soit 12% au-dessus de la moyenne du secteur. Vos secteurs les plus forts sont les Startups Tech (45% de réponse) et Enterprise (38% de réponse).' },
        ],
        placeholder: 'Posez une question sur votre recherche d\'emploi...',
      }
    },
    
    // Architecture Section
    architecture: {
      label: 'Architecture',
      title1: 'Construit pour la',
      title2: 'Production',
      description: 'Une architecture robuste et scalable suivant les meilleures pratiques de l\'industrie pour des applications de niveau entreprise.',
      categories: {
        backend: 'Backend',
        frontend: 'Frontend',
        aiApis: 'IA & APIs',
        devops: 'DevOps',
      },
      diagram: {
        title: 'Architecture Système',
        client: 'Client',
        browser: 'Navigateur',
        frontend: 'Frontend',
        backend: 'Backend',
        database: 'Base de données',
        aiApis: 'APIs IA',
        dockerized: 'Conteneurisé avec Docker Compose',
      },
      folderStructure: 'Structure du Projet',
    },
    
    // Data Export Section
    dataExport: {
      label: 'Gestion des Données',
      title1: 'Exportez & Importez',
      title2: 'Vos Données',
      description: 'Contrôle total sur vos données. Importez des candidatures existantes ou exportez tout dans plusieurs formats pour sauvegarde, analyse ou migration.',
      features: [
        'Import en masse depuis des feuilles de calcul',
        'Sauvegarde de données en un clic',
        'Génération de PDF statistiques',
        'Export JSON compatible API'
      ],
      formats: [
        { name: 'Excel', ext: '.xlsx', description: 'Export complet avec formatage' },
        { name: 'CSV', ext: '.csv', description: 'Compatibilité universelle' },
        { name: 'JSON', ext: '.json', description: 'Format prêt pour API' },
        { name: 'Rapport PDF', ext: '.pdf', description: 'Statistiques & analytique' },
      ]
    },
    
    // Security Section
    security: {
      label: 'Sécurité',
      title1: 'Construit avec la',
      title2: 'Sécurité en Priorité',
      features: [
        { title: 'Gestion des Secrets .env', description: 'Tous les identifiants sensibles stockés de manière sécurisée dans des variables d\'environnement' },
        { title: 'Routes Admin Protégées', description: 'Contrôle d\'accès basé sur les rôles pour les fonctions administratives' },
        { title: 'Réinitialisation DB Contrôlée', description: 'Opérations de base de données sécurisées avec confirmations' },
        { title: 'Limitation de Taux API', description: 'Cooldown 60s et cache 24h pour optimisation API IA' },
      ]
    },
    
    // Technical Deep Dive Section
    technical: {
      label: 'Approfondissement',
      title1: 'Détails d\'Implémentation',
      title2: 'Technique',
      description: 'Pour les ingénieurs curieux et les recruteurs techniques qui veulent voir sous le capot.',
      topics: [
        {
          title: 'Mécanisme de Cache IA',
          content: `L'intégration IA utilise un système de cache sophistiqué :
      
• Cooldown de 60 secondes entre les requêtes pour éviter les abus d'API
• Rétention du cache 24 heures pour les requêtes identiques
• Réponses de fallback quand les limites de taux sont atteintes
• Invalidation automatique du cache pour les données utilisateur mises à jour`
        },
        {
          title: 'Architecture d\'Intégration Chatbot',
          content: `Le chatbot OpenAI GPT-3.5 est intégré avec :

• Support WebSocket pour des réponses en temps réel
• Gestion de la fenêtre de contexte pour l'historique de conversation
• Injection du profil utilisateur pour des réponses personnalisées
• Rendu de réponse en streaming pour une meilleure UX`
        },
        {
          title: 'Structure de Routage Flask',
          content: `Design d'API RESTful suivant les bonnes pratiques :

• Organisation des routes basée sur Blueprint
• Middleware d'authentification JWT
• Validation des requêtes avec schémas marshmallow
• Gestion d'erreurs complète avec exceptions personnalisées`
        },
        {
          title: 'Flux d\'Initialisation Base de Données',
          content: `SQLite avec SQLAlchemy ORM fournit :

• Migration automatique du schéma au démarrage
• Injection de données seed pour le mode démo
• Connection pooling pour les performances
• Gestion des transactions avec support rollback`
        },
        {
          title: 'Déploiement Docker',
          content: `Conteneurisation prête pour la production :

• Dockerfile multi-stage pour des images optimisées
• Docker Compose pour l'orchestration des services
• Health checks et politiques de redémarrage
• Montage de volumes pour la persistance des données`
        },
      ]
    },
    
    // CTA Section
    cta: {
      title1: 'Intéressé par la Construction de',
      title2: 'Plateformes Intelligentes ?',
      description: 'Je suis passionné par la création de solutions propulsées par l\'IA qui résolvent de vrais problèmes. Discutons de comment nous pouvons travailler ensemble sur votre prochain projet.',
      contact: 'Travaillons Ensemble',
      github: 'Voir sur GitHub',
    },
    
    // Footer
    footer: {
      tagline: 'Ingénieur Full-Stack & IA construisant des applications web intelligentes prêtes pour la production.',
      project: 'Projet',
      techStack: 'Stack Technique',
      getInTouch: 'Me Contacter',
      contactText: 'Ouvert aux opportunités et collaborations en développement IA & Full-Stack.',
      copyright: '© {year} MAADEC - MAAD Engineering & Consulting. Tous droits réservés.',
      builtWith: 'Construit avec Flask, React et IA',
    },
    
    // Language
    language: {
      fr: 'Français',
      en: 'English',
    }
  },
  
  en: {
    // Navigation
    nav: {
      features: 'Features',
      analytics: 'Analytics',
      ai: 'AI',
      architecture: 'Architecture',
      getInTouch: 'Get in Touch',
    },
    
    // Hero Section
    hero: {
      badge: 'AI-Powered Job Tracking',
      title1: 'Track Applications.',
      title2: 'Analyze Performance.',
      title3: 'Optimize Your Career with AI.',
      description: 'An intelligent full-stack platform that transforms how you manage job applications. Powered by Google Gemini Pro and OpenAI GPT-3.5 for smart career insights.',
      ctaDemo: 'View Live Demo',
      ctaArchitecture: 'Explore Architecture',
      dashboard: {
        title: 'Application Dashboard',
        totalApps: 'Total Applications',
        interviews: 'Interviews',
        thisWeek: 'this week',
        responseRate: 'Response Rate',
        aboveAvg: 'Above avg',
        seniorEngineer: 'Senior Engineer',
        fullStackDev: 'Full Stack Dev',
        backendLead: 'Backend Lead',
        interview: 'Interview',
        applied: 'Applied',
        inReview: 'In Review',
      },
      aiAdvisor: 'AI Advisor',
      active: 'Active',
    },
    
    // Features Section
    features: {
      label: 'Features',
      title1: 'Everything You Need to',
      title2: 'Land Your Dream Job',
      description: 'A comprehensive toolkit designed for modern job seekers who want to stay organized and strategic.',
      items: [
        {
          title: 'Application Management',
          description: 'Centralized tracking for all your job applications with custom statuses and notes.'
        },
        {
          title: 'Interview Scheduling',
          description: 'Manage upcoming interviews, set reminders, and track interview outcomes.'
        },
        {
          title: 'Smart Filtering',
          description: 'Powerful search and filter capabilities to find applications instantly.'
        },
        {
          title: 'Favorites System',
          description: 'Mark priority applications and access them quickly from your dashboard.'
        },
        {
          title: 'Status Tracking',
          description: 'Track application stages from Applied to Offer with visual indicators.'
        },
        {
          title: 'Bulk Operations',
          description: 'Update multiple applications at once with powerful batch actions.'
        },
      ]
    },
    
    // Analytics Section
    analytics: {
      label: 'Analytics',
      title1: 'Data-Driven',
      title2: 'Career Decisions',
      description: 'Gain valuable insights into your job search with comprehensive analytics. Track response rates, interview conversions, and application trends over time.',
      kpis: {
        responseRate: 'Response Rate',
        interviewConversion: 'Interview Conversion',
        avgResponseTime: 'Avg. Response Time',
        activeApplications: 'Active Applications',
      },
      chart: {
        title: 'Application Timeline',
        last30: 'Last 30 days',
        last90: 'Last 90 days',
        thisYear: 'This year',
        applications: 'Applications',
        currentMonth: 'Current Month',
      }
    },
    
    // AI Section
    ai: {
      label: 'AI Intelligence',
      title1: 'Powered by',
      title2: 'Advanced AI',
      description: 'Leveraging Google Gemini Pro and OpenAI GPT-3.5 for intelligent career guidance and real-time assistance.',
      advisor: {
        title: 'AI Career Advisor',
        poweredBy: 'Powered by Google Gemini Pro',
        features: [
          'Personalized career strategy recommendations',
          'CV/Resume analysis (PDF & Word support)',
          'Market trend analysis and insights',
          'Interview preparation guidance',
          'Smart caching with 60s cooldown & 24h retention'
        ],
        uploadCv: 'Upload your CV for AI analysis',
      },
      chatbot: {
        title: 'AI Chatbot Assistant',
        poweredBy: 'Powered by OpenAI GPT-3.5',
        messages: [
          { role: 'user', message: 'How should I prepare for a senior engineer interview at FAANG?' },
          { role: 'ai', message: 'Based on your profile, focus on these key areas:\n\n1. System Design - Practice designing scalable systems\n2. Behavioral - Use STAR method with your project examples\n3. Coding - LeetCode medium/hard problems\n\nYour Flask + AI experience is a strong differentiator. Emphasize the Job Tracking project!' },
          { role: 'user', message: 'What\'s my current application success rate?' },
          { role: 'ai', message: 'Your response rate is 34%, which is 12% above the industry average. Your strongest sectors are Tech Startups (45% response) and Enterprise (38% response).' },
        ],
        placeholder: 'Ask about your job search...',
      }
    },
    
    // Architecture Section
    architecture: {
      label: 'Architecture',
      title1: 'Built for',
      title2: 'Production',
      description: 'A robust, scalable architecture following industry best practices for enterprise-grade applications.',
      categories: {
        backend: 'Backend',
        frontend: 'Frontend',
        aiApis: 'AI & APIs',
        devops: 'DevOps',
      },
      diagram: {
        title: 'System Architecture',
        client: 'Client',
        browser: 'Browser',
        frontend: 'Frontend',
        backend: 'Backend',
        database: 'Database',
        aiApis: 'AI APIs',
        dockerized: 'Containerized with Docker Compose',
      },
      folderStructure: 'Project Structure',
    },
    
    // Data Export Section
    dataExport: {
      label: 'Data Management',
      title1: 'Export & Import',
      title2: 'Your Data',
      description: 'Full control over your data. Import existing applications or export everything in multiple formats for backup, analysis, or migration.',
      features: [
        'Bulk import from spreadsheets',
        'One-click data backup',
        'Statistics PDF generation',
        'API-compatible JSON export'
      ],
      formats: [
        { name: 'Excel', ext: '.xlsx', description: 'Full data export with formatting' },
        { name: 'CSV', ext: '.csv', description: 'Universal compatibility' },
        { name: 'JSON', ext: '.json', description: 'API-ready format' },
        { name: 'PDF Report', ext: '.pdf', description: 'Statistics & analytics' },
      ]
    },
    
    // Security Section
    security: {
      label: 'Security',
      title1: 'Built with',
      title2: 'Security First',
      features: [
        { title: '.env Secret Management', description: 'All sensitive credentials stored securely in environment variables' },
        { title: 'Protected Admin Routes', description: 'Role-based access control for administrative functions' },
        { title: 'Controlled Database Reset', description: 'Safe database operations with confirmation safeguards' },
        { title: 'API Rate Limiting', description: '60s cooldown and 24h caching for AI API optimization' },
      ]
    },
    
    // Technical Deep Dive Section
    technical: {
      label: 'Deep Dive',
      title1: 'Technical',
      title2: 'Implementation Details',
      description: 'For the curious engineers and technical recruiters who want to see under the hood.',
      topics: [
        {
          title: 'AI Caching Mechanism',
          content: `The AI integration uses a sophisticated caching system:
      
• 60-second cooldown between requests to prevent API abuse
• 24-hour cache retention for identical queries
• Fallback responses when rate limits are reached
• Automatic cache invalidation for updated user data`
        },
        {
          title: 'Chatbot Integration Architecture',
          content: `The OpenAI GPT-3.5 chatbot is integrated with:

• WebSocket support for real-time responses
• Context window management for conversation history
• User profile injection for personalized responses
• Streaming response rendering for better UX`
        },
        {
          title: 'Flask Routing Structure',
          content: `RESTful API design following best practices:

• Blueprint-based route organization
• JWT authentication middleware
• Request validation with marshmallow schemas
• Comprehensive error handling with custom exceptions`
        },
        {
          title: 'Database Initialization Flow',
          content: `SQLite with SQLAlchemy ORM provides:

• Automatic schema migration on startup
• Seed data injection for demo mode
• Connection pooling for performance
• Transaction management with rollback support`
        },
        {
          title: 'Docker Deployment',
          content: `Production-ready containerization:

• Multi-stage Dockerfile for optimized images
• Docker Compose for service orchestration
• Health checks and restart policies
• Volume mounting for data persistence`
        },
      ]
    },
    
    // CTA Section
    cta: {
      title1: 'Interested in Building',
      title2: 'Intelligent Platforms?',
      description: 'I\'m passionate about creating AI-powered solutions that solve real problems. Let\'s discuss how we can work together on your next project.',
      contact: 'Let\'s Work Together',
      github: 'View on GitHub',
    },
    
    // Footer
    footer: {
      tagline: 'Full-Stack & AI Engineer building production-ready intelligent web applications.',
      project: 'Project',
      techStack: 'Tech Stack',
      getInTouch: 'Get in Touch',
      contactText: 'Open to opportunities and collaborations in AI & Full-Stack development.',
      copyright: '© {year} MAADEC - MAAD Engineering & Consulting. All rights reserved.',
      builtWith: 'Built with Flask, React, and AI',
    },
    
    // Language
    language: {
      fr: 'Français',
      en: 'English',
    }
  }
};
