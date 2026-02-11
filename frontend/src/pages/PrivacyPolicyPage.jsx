import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Eye, Lock, UserCheck, Globe, Mail, FileText } from 'lucide-react';
import { useLanguage } from '../i18n';

export default function PrivacyPolicyPage() {
  const { language } = useLanguage();
  
  const content = {
    fr: {
      title: 'Politique de Confidentialité',
      backToHome: 'Retour à l\'accueil',
      lastUpdate: 'Dernière mise à jour : Décembre 2025',
      intro: 'MAADEC - MAAD Engineering & Consulting s\'engage à protéger la vie privée des utilisateurs de l\'application Job Tracking. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles.',
      sections: [
        {
          title: 'Responsable du traitement',
          icon: UserCheck,
          content: `**MAADEC - MAAD Engineering & Consulting**
Dirigeant : Abdoul Ahad Mbacké DIOUF
Adresse : Cité Cora FALL Villa N°56, Zac Mbao, Sénégal
Email : contact@maadec.com
Téléphone : +33 7 49 05 18 79`
        },
        {
          title: 'Données collectées',
          icon: Database,
          content: `Dans le cadre de l'utilisation de Job Tracking, nous collectons les données suivantes :

**Données d'identification :**
• Nom et prénom
• Adresse email
• Mot de passe (hashé)

**Données de candidature :**
• Entreprises et postes visés
• Dates de candidature
• Statuts des candidatures
• Notes et commentaires

**Données d'entretien :**
• Dates et types d'entretiens
• Informations de contact des recruteurs
• Notes de préparation

**Données techniques :**
• Adresse IP
• Type de navigateur
• Données de connexion`
        },
        {
          title: 'Finalités du traitement',
          icon: Eye,
          content: `Vos données sont collectées et traitées pour les finalités suivantes :

• **Gestion de votre compte utilisateur** : création, authentification, personnalisation
• **Fonctionnement du service** : suivi de vos candidatures et entretiens
• **Analyse IA** : conseils personnalisés via nos outils d'intelligence artificielle (Gemini, GPT-4o)
• **Amélioration du service** : statistiques d'usage anonymisées
• **Communication** : notifications et alertes liées à vos candidatures
• **Sécurité** : protection contre les accès non autorisés`
        },
        {
          title: 'Base légale du traitement',
          icon: FileText,
          content: `Le traitement de vos données personnelles est fondé sur :

• **L'exécution du contrat** : les données sont nécessaires pour vous fournir le service Job Tracking
• **Votre consentement** : pour certaines fonctionnalités optionnelles (notifications, newsletter)
• **L'intérêt légitime** : pour l'amélioration de nos services et la sécurité de la plateforme`
        },
        {
          title: 'Durée de conservation',
          icon: Lock,
          content: `Vos données sont conservées pendant :

• **Données de compte** : pendant toute la durée d'utilisation du service, puis 3 ans après la dernière connexion
• **Données de candidatures** : pendant la durée de votre utilisation, supprimées sur demande
• **Données techniques** : 12 mois maximum
• **Données de facturation** : 10 ans (obligation légale)

Vous pouvez demander la suppression de vos données à tout moment via les paramètres de votre compte ou en nous contactant.`
        },
        {
          title: 'Partage des données',
          icon: Globe,
          content: `Vos données peuvent être partagées avec :

• **Services d'IA** : Google (Gemini) et OpenAI (GPT-4o) pour les fonctionnalités d'analyse et de conseil. Ces services sont soumis à leurs propres politiques de confidentialité.
• **Hébergeur** : Emergent Labs pour l'hébergement sécurisé de l'application
• **Sous-traitants techniques** : uniquement pour assurer le fonctionnement du service

**Nous ne vendons jamais vos données personnelles à des tiers.**

En cas de transfert hors de l'Union Européenne, nous nous assurons que des garanties appropriées sont en place (clauses contractuelles types, certifications).`
        },
        {
          title: 'Sécurité des données',
          icon: Shield,
          content: `Nous mettons en œuvre des mesures de sécurité robustes pour protéger vos données :

• **Chiffrement** : connexions HTTPS, mots de passe hashés avec bcrypt
• **Authentification** : tokens JWT sécurisés
• **Accès restreint** : seules les personnes autorisées ont accès aux données
• **Sauvegardes** : sauvegardes régulières et sécurisées
• **Surveillance** : monitoring des accès et détection des anomalies`
        },
        {
          title: 'Vos droits',
          icon: UserCheck,
          content: `Conformément à la réglementation applicable, vous disposez des droits suivants :

• **Droit d'accès** : obtenir une copie de vos données personnelles
• **Droit de rectification** : corriger des données inexactes
• **Droit à l'effacement** : demander la suppression de vos données
• **Droit à la portabilité** : recevoir vos données dans un format structuré
• **Droit d'opposition** : vous opposer au traitement de vos données
• **Droit de limitation** : limiter le traitement de vos données

Pour exercer ces droits, contactez-nous à : **contact@maadec.com**

Vous pouvez également introduire une réclamation auprès de l'autorité de protection des données compétente.`
        },
        {
          title: 'Cookies',
          icon: Database,
          content: `Job Tracking utilise des cookies essentiels pour :

• **Authentification** : maintenir votre session connectée
• **Préférences** : mémoriser vos paramètres (langue, thème)
• **Sécurité** : protection contre les attaques CSRF

Nous n'utilisons pas de cookies publicitaires ou de traçage.`
        },
        {
          title: 'Modifications de la politique',
          icon: FileText,
          content: `Cette politique de confidentialité peut être mise à jour occasionnellement. En cas de modification significative, nous vous en informerons par email ou via une notification dans l'application.

La date de dernière mise à jour est indiquée en haut de cette page.`
        },
        {
          title: 'Contact',
          icon: Mail,
          content: `Pour toute question concernant cette politique de confidentialité ou vos données personnelles :

**MAADEC - MAAD Engineering & Consulting**
Email : contact@maadec.com
Téléphone : +33 7 49 05 18 79
Adresse : Cité Cora FALL Villa N°56, Zac Mbao, Sénégal`
        }
      ]
    },
    en: {
      title: 'Privacy Policy',
      backToHome: 'Back to home',
      lastUpdate: 'Last updated: December 2025',
      intro: 'MAADEC - MAAD Engineering & Consulting is committed to protecting the privacy of Job Tracking application users. This privacy policy explains how we collect, use, and protect your personal data.',
      sections: [
        {
          title: 'Data Controller',
          icon: UserCheck,
          content: `**MAADEC - MAAD Engineering & Consulting**
Director: Abdoul Ahad Mbacké DIOUF
Address: Cité Cora FALL Villa N°56, Zac Mbao, Senegal
Email: contact@maadec.com
Phone: +33 7 49 05 18 79`
        },
        {
          title: 'Data Collected',
          icon: Database,
          content: `When using Job Tracking, we collect the following data:

**Identification data:**
• First and last name
• Email address
• Password (hashed)

**Application data:**
• Companies and positions applied for
• Application dates
• Application statuses
• Notes and comments

**Interview data:**
• Interview dates and types
• Recruiter contact information
• Preparation notes

**Technical data:**
• IP address
• Browser type
• Connection data`
        },
        {
          title: 'Purposes of Processing',
          icon: Eye,
          content: `Your data is collected and processed for the following purposes:

• **User account management**: creation, authentication, personalization
• **Service operation**: tracking your applications and interviews
• **AI analysis**: personalized advice through our artificial intelligence tools (Gemini, GPT-4o)
• **Service improvement**: anonymized usage statistics
• **Communication**: notifications and alerts related to your applications
• **Security**: protection against unauthorized access`
        },
        {
          title: 'Legal Basis for Processing',
          icon: FileText,
          content: `The processing of your personal data is based on:

• **Contract execution**: data is necessary to provide you with the Job Tracking service
• **Your consent**: for certain optional features (notifications, newsletter)
• **Legitimate interest**: for improving our services and platform security`
        },
        {
          title: 'Data Retention Period',
          icon: Lock,
          content: `Your data is retained for:

• **Account data**: for the duration of service use, then 3 years after the last login
• **Application data**: for the duration of your use, deleted upon request
• **Technical data**: 12 months maximum
• **Billing data**: 10 years (legal obligation)

You can request deletion of your data at any time through your account settings or by contacting us.`
        },
        {
          title: 'Data Sharing',
          icon: Globe,
          content: `Your data may be shared with:

• **AI services**: Google (Gemini) and OpenAI (GPT-4o) for analysis and advisory features. These services are subject to their own privacy policies.
• **Host**: Emergent Labs for secure application hosting
• **Technical subcontractors**: only to ensure service operation

**We never sell your personal data to third parties.**

In case of transfer outside the European Union, we ensure that appropriate safeguards are in place (standard contractual clauses, certifications).`
        },
        {
          title: 'Data Security',
          icon: Shield,
          content: `We implement robust security measures to protect your data:

• **Encryption**: HTTPS connections, passwords hashed with bcrypt
• **Authentication**: secure JWT tokens
• **Restricted access**: only authorized persons have access to data
• **Backups**: regular and secure backups
• **Monitoring**: access monitoring and anomaly detection`
        },
        {
          title: 'Your Rights',
          icon: UserCheck,
          content: `In accordance with applicable regulations, you have the following rights:

• **Right of access**: obtain a copy of your personal data
• **Right of rectification**: correct inaccurate data
• **Right to erasure**: request deletion of your data
• **Right to portability**: receive your data in a structured format
• **Right to object**: object to the processing of your data
• **Right to restriction**: limit the processing of your data

To exercise these rights, contact us at: **contact@maadec.com**

You may also lodge a complaint with the competent data protection authority.`
        },
        {
          title: 'Cookies',
          icon: Database,
          content: `Job Tracking uses essential cookies for:

• **Authentication**: maintaining your logged-in session
• **Preferences**: remembering your settings (language, theme)
• **Security**: protection against CSRF attacks

We do not use advertising or tracking cookies.`
        },
        {
          title: 'Policy Changes',
          icon: FileText,
          content: `This privacy policy may be updated occasionally. In case of significant changes, we will inform you by email or via a notification in the application.

The last update date is indicated at the top of this page.`
        },
        {
          title: 'Contact',
          icon: Mail,
          content: `For any questions regarding this privacy policy or your personal data:

**MAADEC - MAAD Engineering & Consulting**
Email: contact@maadec.com
Phone: +33 7 49 05 18 79
Address: Cité Cora FALL Villa N°56, Zac Mbao, Senegal`
        }
      ]
    }
  };

  const t = content[language] || content.fr;

  return (
    <div className="min-h-screen bg-[#020817]">
      {/* Header */}
      <div className="bg-[#0a0f1a] border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-slate-400 hover:text-gold transition-colors"
            data-testid="back-to-home"
          >
            <ArrowLeft size={20} className="mr-2" />
            {t.backToHome}
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-white mb-4" data-testid="privacy-policy-title">
            {t.title}
          </h1>
          <p className="text-slate-500 mb-6">{t.lastUpdate}</p>
          <p className="text-slate-400 mb-12 text-lg leading-relaxed">{t.intro}</p>

          <div className="space-y-8">
            {t.sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6"
                  data-testid={`privacy-section-${index}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                      <Icon size={20} className="text-gold" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                  </div>
                  <div className="text-slate-400 whitespace-pre-line leading-relaxed">
                    {section.content.split('**').map((part, i) => 
                      i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-slate-500 text-sm text-center">
            © {new Date().getFullYear()} MAADEC - MAAD Engineering & Consulting. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
