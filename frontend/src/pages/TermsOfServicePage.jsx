import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, AlertTriangle, Scale, Ban, RefreshCw, Mail, CheckCircle } from 'lucide-react';
import { useLanguage } from '../i18n';

export default function TermsOfServicePage() {
  const { language } = useLanguage();
  
  const content = {
    fr: {
      title: 'Conditions Générales d\'Utilisation',
      backToHome: 'Retour à l\'accueil',
      lastUpdate: 'Dernière mise à jour : Décembre 2025',
      intro: 'Les présentes Conditions Générales d\'Utilisation (CGU) régissent l\'accès et l\'utilisation de l\'application Job Tracking, éditée par MAADEC - MAAD Engineering & Consulting. En utilisant notre service, vous acceptez ces conditions dans leur intégralité.',
      sections: [
        {
          title: 'Article 1 - Objet',
          icon: FileText,
          content: `Les présentes CGU ont pour objet de définir les modalités et conditions d'utilisation de l'application Job Tracking (ci-après "le Service").

Le Service est une application de suivi de candidatures professionnelles permettant aux utilisateurs de :
• Gérer et suivre leurs candidatures
• Planifier et organiser leurs entretiens
• Bénéficier de conseils personnalisés via l'intelligence artificielle
• Exporter et analyser leurs données de recherche d'emploi`
        },
        {
          title: 'Article 2 - Éditeur du Service',
          icon: Shield,
          content: `Le Service est édité par :

**MAADEC - MAAD Engineering & Consulting**
Dirigeant : Abdoul Ahad Mbacké DIOUF
Forme juridique : Entreprise Individuelle
NINEA : 012390978
RCCM : SN.DKR.2025.A.31734
Adresse : Cité Cora FALL Villa N°56, Zac Mbao, Sénégal
Email : contact@maadec.com
Téléphone : +33 7 49 05 18 79`
        },
        {
          title: 'Article 3 - Accès au Service',
          icon: CheckCircle,
          content: `**3.1 Conditions d'accès**
L'accès au Service nécessite :
• Une connexion internet
• La création d'un compte utilisateur
• L'acceptation des présentes CGU

**3.2 Inscription**
Pour créer un compte, l'utilisateur doit fournir :
• Une adresse email valide
• Un mot de passe sécurisé
• Ses informations d'identification

L'utilisateur s'engage à fournir des informations exactes et à les maintenir à jour.

**3.3 Confidentialité du compte**
L'utilisateur est responsable de la confidentialité de ses identifiants de connexion. Toute activité effectuée depuis son compte est présumée réalisée par lui.`
        },
        {
          title: 'Article 4 - Utilisation du Service',
          icon: CheckCircle,
          content: `**4.1 Usage autorisé**
Le Service est destiné à un usage personnel et professionnel licite. L'utilisateur peut :
• Enregistrer et suivre ses candidatures
• Planifier ses entretiens
• Utiliser les fonctionnalités d'analyse IA
• Exporter ses données

**4.2 Engagements de l'utilisateur**
L'utilisateur s'engage à :
• Utiliser le Service de manière loyale et conforme aux présentes CGU
• Ne pas porter atteinte à la sécurité ou au fonctionnement du Service
• Respecter les droits des tiers
• Ne pas utiliser le Service à des fins illégales`
        },
        {
          title: 'Article 5 - Comportements interdits',
          icon: Ban,
          content: `Il est strictement interdit de :

• Tenter d'accéder au Service de manière non autorisée
• Utiliser des robots, scrapers ou tout système automatisé non autorisé
• Collecter les données d'autres utilisateurs
• Diffuser des contenus illicites, diffamatoires ou portant atteinte aux droits de tiers
• Perturber ou surcharger les serveurs du Service
• Contourner les mesures de sécurité
• Revendre ou commercialiser l'accès au Service
• Utiliser le Service pour du spam ou des communications non sollicitées

Le non-respect de ces interdictions peut entraîner la suspension ou la résiliation immédiate du compte.`
        },
        {
          title: 'Article 6 - Propriété intellectuelle',
          icon: Shield,
          content: `**6.1 Droits de MAADEC**
L'ensemble des éléments du Service (code, design, textes, logos, images) sont protégés par le droit de la propriété intellectuelle et appartiennent à MAADEC.

Toute reproduction, représentation ou exploitation non autorisée est interdite.

**6.2 Droits de l'utilisateur**
L'utilisateur conserve la propriété de ses données personnelles et des contenus qu'il crée dans le Service.

Il accorde à MAADEC une licence limitée pour traiter ces données dans le cadre du fonctionnement du Service.`
        },
        {
          title: 'Article 7 - Fonctionnalités IA',
          icon: FileText,
          content: `**7.1 Nature des conseils IA**
Le Service intègre des fonctionnalités d'intelligence artificielle (Google Gemini, OpenAI GPT-4o) pour fournir des conseils et analyses.

Ces conseils sont fournis à titre informatif et ne constituent pas des conseils professionnels garantis.

**7.2 Limitations**
MAADEC ne garantit pas :
• L'exactitude des conseils générés par l'IA
• Les résultats obtenus suite à l'application de ces conseils
• La disponibilité permanente des fonctionnalités IA

L'utilisateur reste seul responsable de ses décisions professionnelles.`
        },
        {
          title: 'Article 8 - Responsabilité',
          icon: AlertTriangle,
          content: `**8.1 Responsabilité de MAADEC**
MAADEC s'engage à fournir le Service avec diligence. Toutefois, MAADEC ne peut être tenu responsable :
• Des interruptions temporaires du Service
• Des dommages indirects résultant de l'utilisation du Service
• Des actions de tiers ou de cas de force majeure
• Des résultats de recherche d'emploi de l'utilisateur

**8.2 Responsabilité de l'utilisateur**
L'utilisateur est responsable :
• De l'exactitude des informations qu'il saisit
• De la conservation de ses identifiants
• De son utilisation du Service conforme aux CGU`
        },
        {
          title: 'Article 9 - Données personnelles',
          icon: Shield,
          content: `Le traitement des données personnelles est régi par notre Politique de Confidentialité, accessible à l'adresse /privacy.

En utilisant le Service, l'utilisateur reconnaît avoir pris connaissance de cette politique et consent au traitement de ses données tel que décrit.`
        },
        {
          title: 'Article 10 - Tarification',
          icon: FileText,
          content: `**10.1 Accès gratuit**
L'accès aux fonctionnalités de base du Service est gratuit.

**10.2 Fonctionnalités premium**
Des fonctionnalités avancées peuvent être proposées moyennant paiement. Les conditions tarifaires seront communiquées avant toute souscription.

**10.3 Modifications tarifaires**
MAADEC se réserve le droit de modifier ses tarifs. Les utilisateurs seront informés de toute modification avec un préavis raisonnable.`
        },
        {
          title: 'Article 11 - Durée et résiliation',
          icon: RefreshCw,
          content: `**11.1 Durée**
Les présentes CGU sont conclues pour une durée indéterminée à compter de la création du compte utilisateur.

**11.2 Résiliation par l'utilisateur**
L'utilisateur peut résilier son compte à tout moment depuis les paramètres de son compte ou en contactant MAADEC.

**11.3 Résiliation par MAADEC**
MAADEC peut suspendre ou résilier un compte en cas de :
• Violation des présentes CGU
• Non-utilisation prolongée du compte
• Demande des autorités compétentes

**11.4 Effets de la résiliation**
La résiliation entraîne la suppression des données de l'utilisateur, sauf obligation légale de conservation.`
        },
        {
          title: 'Article 12 - Modifications des CGU',
          icon: RefreshCw,
          content: `MAADEC se réserve le droit de modifier les présentes CGU à tout moment.

Les utilisateurs seront informés des modifications par email ou notification dans l'application au moins 30 jours avant leur entrée en vigueur.

La poursuite de l'utilisation du Service après l'entrée en vigueur des nouvelles CGU vaut acceptation de celles-ci.`
        },
        {
          title: 'Article 13 - Droit applicable et litiges',
          icon: Scale,
          content: `**13.1 Droit applicable**
Les présentes CGU sont régies par le droit sénégalais.

**13.2 Règlement des litiges**
En cas de litige relatif à l'interprétation ou l'exécution des présentes CGU :
• Les parties s'engagent à rechercher une solution amiable
• À défaut d'accord, les tribunaux compétents du Sénégal seront seuls compétents

**13.3 Médiation**
Conformément aux dispositions applicables, l'utilisateur peut recourir à une procédure de médiation avant toute action judiciaire.`
        },
        {
          title: 'Article 14 - Contact',
          icon: Mail,
          content: `Pour toute question relative aux présentes CGU :

**MAADEC - MAAD Engineering & Consulting**
Email : contact@maadec.com
Téléphone : +33 7 49 05 18 79
Adresse : Cité Cora FALL Villa N°56, Zac Mbao, Sénégal`
        }
      ]
    },
    en: {
      title: 'Terms of Service',
      backToHome: 'Back to home',
      lastUpdate: 'Last updated: December 2025',
      intro: 'These Terms of Service (ToS) govern access to and use of the Job Tracking application, published by MAADEC - MAAD Engineering & Consulting. By using our service, you agree to these terms in their entirety.',
      sections: [
        {
          title: 'Article 1 - Purpose',
          icon: FileText,
          content: `These ToS define the terms and conditions of use of the Job Tracking application (hereinafter "the Service").

The Service is a professional application tracking application that allows users to:
• Manage and track their job applications
• Plan and organize their interviews
• Benefit from personalized advice via artificial intelligence
• Export and analyze their job search data`
        },
        {
          title: 'Article 2 - Service Publisher',
          icon: Shield,
          content: `The Service is published by:

**MAADEC - MAAD Engineering & Consulting**
Director: Abdoul Ahad Mbacké DIOUF
Legal form: Sole Proprietorship
NINEA: 012390978
RCCM: SN.DKR.2025.A.31734
Address: Cité Cora FALL Villa N°56, Zac Mbao, Senegal
Email: contact@maadec.com
Phone: +33 7 49 05 18 79`
        },
        {
          title: 'Article 3 - Access to the Service',
          icon: CheckCircle,
          content: `**3.1 Access conditions**
Access to the Service requires:
• An internet connection
• Creation of a user account
• Acceptance of these ToS

**3.2 Registration**
To create an account, the user must provide:
• A valid email address
• A secure password
• Their identification information

The user agrees to provide accurate information and keep it up to date.

**3.3 Account confidentiality**
The user is responsible for the confidentiality of their login credentials. Any activity performed from their account is presumed to have been done by them.`
        },
        {
          title: 'Article 4 - Use of the Service',
          icon: CheckCircle,
          content: `**4.1 Authorized use**
The Service is intended for lawful personal and professional use. The user may:
• Record and track their applications
• Plan their interviews
• Use AI analysis features
• Export their data

**4.2 User commitments**
The user agrees to:
• Use the Service fairly and in accordance with these ToS
• Not compromise the security or operation of the Service
• Respect the rights of third parties
• Not use the Service for illegal purposes`
        },
        {
          title: 'Article 5 - Prohibited Behavior',
          icon: Ban,
          content: `It is strictly forbidden to:

• Attempt to access the Service in an unauthorized manner
• Use robots, scrapers or any unauthorized automated system
• Collect data from other users
• Distribute illegal, defamatory content or content that infringes on the rights of third parties
• Disrupt or overload the Service servers
• Bypass security measures
• Resell or commercialize access to the Service
• Use the Service for spam or unsolicited communications

Failure to comply with these prohibitions may result in immediate suspension or termination of the account.`
        },
        {
          title: 'Article 6 - Intellectual Property',
          icon: Shield,
          content: `**6.1 MAADEC rights**
All elements of the Service (code, design, texts, logos, images) are protected by intellectual property law and belong to MAADEC.

Any unauthorized reproduction, representation or exploitation is prohibited.

**6.2 User rights**
The user retains ownership of their personal data and content they create in the Service.

They grant MAADEC a limited license to process this data for the operation of the Service.`
        },
        {
          title: 'Article 7 - AI Features',
          icon: FileText,
          content: `**7.1 Nature of AI advice**
The Service integrates artificial intelligence features (Google Gemini, OpenAI GPT-4o) to provide advice and analysis.

This advice is provided for informational purposes and does not constitute guaranteed professional advice.

**7.2 Limitations**
MAADEC does not guarantee:
• The accuracy of AI-generated advice
• Results obtained following the application of this advice
• Permanent availability of AI features

The user remains solely responsible for their professional decisions.`
        },
        {
          title: 'Article 8 - Liability',
          icon: AlertTriangle,
          content: `**8.1 MAADEC liability**
MAADEC undertakes to provide the Service with diligence. However, MAADEC cannot be held responsible for:
• Temporary interruptions of the Service
• Indirect damages resulting from use of the Service
• Actions of third parties or force majeure
• User's job search results

**8.2 User liability**
The user is responsible for:
• The accuracy of the information they enter
• Keeping their credentials safe
• Their use of the Service in accordance with the ToS`
        },
        {
          title: 'Article 9 - Personal Data',
          icon: Shield,
          content: `The processing of personal data is governed by our Privacy Policy, available at /privacy.

By using the Service, the user acknowledges having read this policy and consents to the processing of their data as described.`
        },
        {
          title: 'Article 10 - Pricing',
          icon: FileText,
          content: `**10.1 Free access**
Access to basic Service features is free.

**10.2 Premium features**
Advanced features may be offered for a fee. Pricing conditions will be communicated before any subscription.

**10.3 Pricing changes**
MAADEC reserves the right to change its prices. Users will be informed of any changes with reasonable notice.`
        },
        {
          title: 'Article 11 - Duration and Termination',
          icon: RefreshCw,
          content: `**11.1 Duration**
These ToS are concluded for an indefinite period from the creation of the user account.

**11.2 Termination by user**
The user may terminate their account at any time from their account settings or by contacting MAADEC.

**11.3 Termination by MAADEC**
MAADEC may suspend or terminate an account in case of:
• Violation of these ToS
• Prolonged non-use of the account
• Request from competent authorities

**11.4 Effects of termination**
Termination results in the deletion of user data, except for legal retention obligations.`
        },
        {
          title: 'Article 12 - ToS Modifications',
          icon: RefreshCw,
          content: `MAADEC reserves the right to modify these ToS at any time.

Users will be informed of changes by email or notification in the application at least 30 days before they take effect.

Continued use of the Service after the new ToS take effect constitutes acceptance of them.`
        },
        {
          title: 'Article 13 - Applicable Law and Disputes',
          icon: Scale,
          content: `**13.1 Applicable law**
These ToS are governed by Senegalese law.

**13.2 Dispute resolution**
In case of dispute regarding the interpretation or execution of these ToS:
• The parties agree to seek an amicable solution
• Failing agreement, the competent courts of Senegal will have sole jurisdiction

**13.3 Mediation**
In accordance with applicable provisions, the user may resort to a mediation procedure before any legal action.`
        },
        {
          title: 'Article 14 - Contact',
          icon: Mail,
          content: `For any questions regarding these ToS:

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
          <h1 className="text-4xl font-bold text-white mb-4" data-testid="terms-of-service-title">
            {t.title}
          </h1>
          <p className="text-slate-500 mb-6">{t.lastUpdate}</p>
          <p className="text-slate-400 mb-12 text-lg leading-relaxed">{t.intro}</p>

          <div className="space-y-6">
            {t.sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.03 }}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 mb-2"
                  data-testid={`terms-section-${index}`}
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
