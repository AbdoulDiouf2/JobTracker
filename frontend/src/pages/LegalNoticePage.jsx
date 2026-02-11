import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, User, FileText, Mail, Phone, MapPin } from 'lucide-react';
import { useLanguage } from '../i18n';

export default function LegalNoticePage() {
  const { language } = useLanguage();
  
  const content = {
    fr: {
      title: 'Mentions Légales',
      backToHome: 'Retour à l\'accueil',
      lastUpdate: 'Dernière mise à jour : Décembre 2025',
      sections: [
        {
          title: 'Éditeur du site',
          icon: Building2,
          content: `Le site Job Tracking est édité par :

**MAADEC - MAAD Engineering & Consulting**

Dirigeant : Abdoul Ahad Mbacké DIOUF
Forme juridique : Entreprise Individuelle
NINEA : 012390978
RCCM : SN.DKR.2025.A.31734`
        },
        {
          title: 'Coordonnées',
          icon: MapPin,
          content: `**Adresse :**
Cité Cora FALL Villa N°56
Zac Mbao, Sénégal

**Email :** contact@maadec.com
**Téléphone :** +33 7 49 05 18 79`
        },
        {
          title: 'Directeur de la publication',
          icon: User,
          content: `Le directeur de la publication est Monsieur Abdoul Ahad Mbacké DIOUF, en sa qualité de dirigeant de MAADEC.`
        },
        {
          title: 'Hébergement',
          icon: FileText,
          content: `Le site est hébergé par :
Emergent Labs
Service de cloud computing

L'hébergeur assure la continuité de service et la sécurité des données conformément aux standards de l'industrie.`
        },
        {
          title: 'Propriété intellectuelle',
          icon: FileText,
          content: `L'ensemble des contenus présents sur le site Job Tracking (textes, images, graphismes, logo, icônes, code source) sont la propriété exclusive de MAADEC ou de ses partenaires.

Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable de MAADEC.

Toute exploitation non autorisée du site ou de l'un quelconque des éléments qu'il contient sera considérée comme constitutive d'une contrefaçon et poursuivie conformément aux dispositions des articles L.335-2 et suivants du Code de Propriété Intellectuelle.`
        },
        {
          title: 'Limitation de responsabilité',
          icon: FileText,
          content: `MAADEC s'efforce d'assurer au mieux l'exactitude et la mise à jour des informations diffusées sur ce site. Toutefois, MAADEC décline toute responsabilité :

• En cas d'interruption ou d'inaccessibilité du site
• En cas de survenance de bugs
• En cas d'inexactitude ou d'omission portant sur des informations disponibles sur le site
• Pour tout dommage résultant d'une intrusion frauduleuse d'un tiers

Les liens hypertextes présents sur le site et dirigeant les utilisateurs vers d'autres sites web n'engagent pas la responsabilité de MAADEC quant au contenu de ces sites.`
        },
        {
          title: 'Droit applicable',
          icon: FileText,
          content: `Les présentes mentions légales sont régies par le droit sénégalais. En cas de litige, et après une tentative de recherche d'une solution amiable, les tribunaux compétents du Sénégal seront seuls compétents.`
        }
      ]
    },
    en: {
      title: 'Legal Notice',
      backToHome: 'Back to home',
      lastUpdate: 'Last updated: December 2025',
      sections: [
        {
          title: 'Website Publisher',
          icon: Building2,
          content: `The Job Tracking website is published by:

**MAADEC - MAAD Engineering & Consulting**

Director: Abdoul Ahad Mbacké DIOUF
Legal form: Sole Proprietorship
NINEA: 012390978
RCCM: SN.DKR.2025.A.31734`
        },
        {
          title: 'Contact Information',
          icon: MapPin,
          content: `**Address:**
Cité Cora FALL Villa N°56
Zac Mbao, Senegal

**Email:** contact@maadec.com
**Phone:** +33 7 49 05 18 79`
        },
        {
          title: 'Publication Director',
          icon: User,
          content: `The publication director is Mr. Abdoul Ahad Mbacké DIOUF, in his capacity as director of MAADEC.`
        },
        {
          title: 'Hosting',
          icon: FileText,
          content: `The website is hosted by:
Emergent Labs
Cloud computing service

The host ensures service continuity and data security in accordance with industry standards.`
        },
        {
          title: 'Intellectual Property',
          icon: FileText,
          content: `All content on the Job Tracking website (texts, images, graphics, logo, icons, source code) are the exclusive property of MAADEC or its partners.

Any reproduction, representation, modification, publication, or adaptation of all or part of the website elements, regardless of the means or process used, is prohibited without prior written authorization from MAADEC.

Any unauthorized use of the website or any of its elements will be considered as counterfeiting and prosecuted in accordance with intellectual property laws.`
        },
        {
          title: 'Limitation of Liability',
          icon: FileText,
          content: `MAADEC strives to ensure the accuracy and updating of information published on this website. However, MAADEC disclaims any responsibility:

• In case of interruption or inaccessibility of the website
• In case of bugs occurring
• In case of inaccuracy or omission regarding information available on the website
• For any damage resulting from fraudulent intrusion by a third party

Hyperlinks on the website directing users to other websites do not engage MAADEC's responsibility regarding the content of those sites.`
        },
        {
          title: 'Applicable Law',
          icon: FileText,
          content: `These legal notices are governed by Senegalese law. In case of dispute, and after attempting to find an amicable solution, the competent courts of Senegal will have sole jurisdiction.`
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
          <h1 className="text-4xl font-bold text-white mb-4" data-testid="legal-notice-title">
            {t.title}
          </h1>
          <p className="text-slate-500 mb-12">{t.lastUpdate}</p>

          <div className="space-y-10">
            {t.sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6"
                  data-testid={`legal-section-${index}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                      <Icon size={20} className="text-gold" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                  </div>
                  <div className="text-slate-400 whitespace-pre-line leading-relaxed prose prose-invert prose-sm max-w-none">
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
