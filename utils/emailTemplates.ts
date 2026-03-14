/**
 * Email Templates Configuration
 * 
 * This module contains all preconfigured email templates for the application.
 * Each template generates a complete HTML/text message ready to be sent via EmailJS.
 * 
 * EmailJS variables used:
 * - {{subject}} - Email subject
 * - {{message}} - Complete HTML message body
 * - {{to_email}} - Recipient email
 * - {{name}} - Recipient name (From name in EmailJS)
 */

export interface EmailTemplateData {
    subject: string;
    message: string;
}

/**
 * Generates a complete email message based on template type and context
 */
export const generateEmailTemplate = (
    templateType: string,
    context: any
): EmailTemplateData => {
    const companyName = 'PRESTA SERVICES ANTILLES';
    const companyEmail = 'prestaservicesantilles.rh@gmail.com';
    const companyPhone = '0696 06 15 94';
    const companyAddress = '31 Résidence L\'Autre Bord – 97220 La Trinité';

    // Helper function to create Text email (Fallback for when HTML is not supported/configured)
    const createTextEmail = (title: string, content: string): string => {
        const applyTextEmphasis = (input: string): string => {
            const raw = String(input ?? '');

            // 1) Bold "Bonjour ..." line (plain text, no HTML)
            const withBoldGreeting = raw.replace(/^Bonjour([^\n]*)$/m, (line) => {
                const trimmed = String(line || '').trim();
                if (!trimmed) return line;
                if (trimmed.startsWith('**Bonjour')) return line;
                return `**${trimmed}**`;
            });

            // 2) Bold company name occurrences
            return withBoldGreeting
                .replace(/\bPresta Services Antilles\b/g, '**Presta Services Antilles**')
                .replace(/\bPRESTA SERVICES ANTILLES\b/g, '**PRESTA SERVICES ANTILLES**');
        };

        const portalLink = context?.link || 'https://www.prestaservicesantilles.com/';
        const safeTitle = String(title || '').trim();
        const subjectLine = safeTitle ? `Objet : ${safeTitle}` : `Objet : Nouvelle notification – Presta Services Antilles`;

        const rawMessage = `
${companyName}
${companyAddress}
📧 ${companyEmail} | 📞 ${companyPhone}

${subjectLine}

${content}

Merci de vous connecter à votre espace personnel pour en prendre connaissance :
🔗 ${portalLink}

Restant à votre disposition pour toute question,
L’équipe Presta Services Antilles

Ce message vous a été envoyé automatiquement via notre système sécurisé.
        `.trim();

        return applyTextEmphasis(rawMessage);
    };

    // Helper to format key-value pairs textually
    const formatInfo = (label: string, value: string) => `${label}: ${value}`;

    // Template selection based on type
    switch (templateType) {
        // ========== WELCOME EMAILS ==========
        case 'welcome_client_panel':
            return {
                subject: `Bienvenue chez ${companyName} - Accès à votre espace client`,
                message: createTextEmail(
                    'Bienvenue !',
                    `Bonjour ${context.name || 'Client'},

Bienvenue chez ${companyName}. Votre compte client a été créé avec succès.

VOS IDENTIFIANTS DE CONNEXION :
- Email : ${context.login || context.email}
- Mot de passe : ${context.password}

ACCÉDER À VOTRE ESPACE CLIENT :
${context.link || 'https://www.prestaservicesantilles.com/'}

AVANCE IMMÉDIATE (CRÉATION DE COMPTE) :
https://avance-immediate.fr/auto-declaration/1758065687734

Vous pouvez utiliser votre espace client pour :
- consulter vos prestations à venir,
- suivre vos documents (devis, factures, contrats),
- nous contacter.

Conseil de sécurité : changez votre mot de passe lors de votre première connexion.`
                )
            };

        case 'welcome_provider':
            return {
                subject: `Bienvenue dans l'équipe ${companyName} - Accès prestataire`,
                message: createTextEmail(
                    'Bienvenue dans l\'équipe !',
                    `Bonjour ${context.name || 'Prestataire'},

Bienvenue chez ${companyName} ! Votre compte prestataire est maintenant actif.

VOS IDENTIFIANTS DE CONNEXION :
- Email : ${context.login || context.email}
- Mot de passe : ${context.password}

Depuis votre espace prestataire, vous pourrez :
- Consulter vos missions assignées
- Démarrer et terminer vos interventions
- Télécharger vos photos et rapports
- Gérer vos congés et disponibilités
- Suivre vos heures de travail

Accédez à votre espace ici : ${context.link || 'https://www.prestaservicesantilles.com/'}

Important : Pensez à changer votre mot de passe lors de votre première connexion.`
                )
            };

        // ========== MISSION EMAILS ==========
        case 'reminder_48h':
            return {
                subject: `Rappel Intervention - Annulation impossible sans frais`,
                message: createTextEmail(
                    'Rappel Important',
                    `Bonjour ${context.clientName || 'Client'},

[!] ATTENTION : Votre intervention est prévue dans moins de 48 heures.

DÉTAILS DE L'INTERVENTION :
- Date : ${context.date || 'À confirmer'}
- Heure : ${context.time || context.startTime || 'À confirmer'}

IMPORTANT : À partir de maintenant, toute annulation de votre part sera considérée comme tardive. La prestation sera due à 100% conformément à nos conditions.

Si vous avez des questions, n'hésitez pas à nous contacter rapidement.`
                )
            };

        case 'client_mission_cancelled':
            return {
                subject: `Confirmation d’annulation de votre prestation`,
                message: createTextEmail(
                    'Annulation confirmée',
                    `Bonjour ${context.clientName || 'Client'},

Nous confirmons la prise en compte de votre demande d’annulation.

DÉTAILS DE LA PRESTATION :
- Date : ${context.date || 'N/A'}
- Heure : ${context.time || context.startTime || 'N/A'}
- Service : ${context.service || 'N/A'}

RAPPEL IMPORTANT (CONDITIONS D’ANNULATION) :
${context.policyText || "Toute annulation à moins de 48h entraîne une facturation à 100% de la prestation."}

Si vous souhaitez reprogrammer une prestation, vous pouvez nous contacter :
📧 ${companyEmail} | 📞 ${companyPhone}
`
                )
            };

        case 'provider_mission_assigned':
            return {
                subject: `Nouvelle mission assignée`,
                message: createTextEmail(
                    'Nouvelle Mission',
                    `Bonjour,

Une nouvelle mission vous a été assignée.

DÉTAILS :
- Client : ${context.clientName || 'Non spécifié'}
- Mission ID : ${context.missionId || 'N/A'}

Connectez-vous à votre espace prestataire pour consulter tous les détails de cette mission :
https://www.prestaservicesantilles.com/`
                )
            };

        case 'mission_report':
            return {
                subject: `Compte rendu de votre intervention`,
                message: createTextEmail(
                    'Mission Terminée',
                    `Bonjour ${context.clientName || 'Client'},

Votre intervention a été réalisée avec succès !

RÉCAPITULATIF :
- Date : ${context.date || 'N/A'}
- Horaire : ${context.startTime || ''} - ${context.endTime || ''}
- Service : ${context.service || 'N/A'}
- Intervenant : ${context.providerName || 'N/A'}

REMARQUES :
${context.remark || 'R.A.S - Aucune remarque particulière'}

Les photos et le rapport complet sont disponibles dans votre espace client :
https://www.prestaservicesantilles.com/`
                )
            };

        case 'admin_mission_report':
            return {
                subject: `Fin de Mission - Rapport disponible`,
                message: createTextEmail(
                    'Rapport de Mission',
                    `Bonjour Admin,

Une mission vient de se terminer.

DÉTAILS :
- Client : ${context.clientName || 'N/A'}
- Prestataire : ${context.providerName || 'N/A'}
- Date : ${context.date || 'N/A'}

Le rapport complet avec photos est disponible dans l'espace admin :
${context.link || 'https://www.prestaservicesantilles.com/reports'}`
                )
            };

        case 'admin_mission_cancelled':
            return {
                subject: `URGENT - Annulation Prestataire`,
                message: createTextEmail(
                    'Annulation Mission',
                    `Bonjour Admin,

[!] ALERTE : Un prestataire a annulé une mission.

DÉTAILS :
- Prestataire : ${context.providerName || 'N/A'}
- Client : ${context.clientName || 'N/A'}
- Date : ${context.date || 'N/A'}
- Motif : ${context.reason || 'Non spécifié'}

ACTION REQUISE : Le créneau est maintenant libéré. Vous devez réassigner cette mission à un autre prestataire.

Gérer la mission : https://www.prestaservicesantilles.com/admin`
                )
            };

        case 'admin_client_cancelled_late':
            return {
                subject: `URGENT - Annulation Tardive Client`,
                message: createTextEmail(
                    'Annulation Tardive',
                    `Bonjour Admin,

[!] ATTENTION : Annulation tardive (moins de 48h).

DÉTAILS :
- Client : ${context.clientName || 'N/A'}
- Date de la mission : ${context.date || 'N/A'}

FACTURATION : Cette mission doit être facturée à 100% conformément aux conditions.

Gérer la facturation : https://www.prestaservicesantilles.com/admin`
                )
            };

        case 'admin_client_cancelled':
            return {
                subject: `Annulation Client`,
                message: createTextEmail(
                    'Annulation Mission',
                    `Bonjour Admin,

Un client a annulé une mission dans les délais.

DÉTAILS :
- Client : ${context.clientName || 'N/A'}
- Date : ${context.date || 'N/A'}

Le créneau est maintenant disponible pour une nouvelle réservation.`
                )
            };

        // ========== DOCUMENT EMAILS ==========
        case 'new_document':
            return {
                subject: context.subject || `Nouveau document disponible`,
                message: createTextEmail(
                    'Nouveau Document',
                    `Bonjour,

Un nouveau document est disponible dans votre espace client.

- Type : ${context.type || 'Document'}
- Référence : ${context.ref || context.reference || 'N/A'}

Connectez-vous pour le consulter et le télécharger :
https://www.prestaservicesantilles.com/`
                )
            };

        case 'quote_signature_reminder':
            return {
                subject: `Rappel - Signature de votre devis ${context.quoteRef || context.ref || 'N/A'}`,
                message: createTextEmail(
                    'Rappel signature devis',
                    `Bonjour ${context.clientName || context.name || 'Client'},

Un rappel concernant votre devis ${context.quoteRef || context.ref || 'N/A'}.

Temps restant avant expiration : ${context.remainingText || 'N/A'}

VOS IDENTIFIANTS DE CONNEXION :
- Email : ${context.login || context.email || 'N/A'}
- Mot de passe : ${context.password ? context.password : 'Déjà communiqué dans un mail précédent.'}

Accédez à votre espace ici : ${context.link || 'https://www.prestaservicesantilles.com/'}

Si vous avez déjà signé votre devis, vous pouvez ignorer ce message.`
                )
            };

        case 'document_status_update':
            return {
                subject: context.subject || `Mise à jour de document`,
                message: createTextEmail(
                    'Mise à Jour Document',
                    `Bonjour,

Le statut d'un de vos documents a été mis à jour.

- Document : ${context.ref || context.reference || 'N/A'}
- Nouveau statut : ${context.status || 'Mis à jour'}

Connectez-vous pour voir les détails :
https://www.prestaservicesantilles.com/`
                )
            };

        case 'admin_quote_signed':
            return {
                subject: `URGENT - Devis Signé`,
                message: createTextEmail(
                    'Devis Signé',
                    `Bonjour Admin,

[OK] Un devis a été signé !

- Client : ${context.clientName || 'N/A'}
- Référence : ${context.reference || context.ref || 'N/A'}

ACTION REQUISE : Planifier les missions et créer le contrat SAP si applicable.

Gérer le devis : https://www.prestaservicesantilles.com/admin`
                )
            };

        case 'admin_quote_rejected':
            return {
                subject: `Devis Refusé`,
                message: createTextEmail(
                    'Devis Refusé',
                    `Bonjour Admin,

Un client a refusé un devis.

- Client : ${context.clientName || 'N/A'}
- Référence : ${context.reference || context.ref || 'N/A'}

Vous pouvez contacter le client pour comprendre les raisons et proposer des alternatives.`
                )
            };

        // ========== OTHER EMAILS ==========
        case 'reset_password':
            return {
                subject: `Réinitialisation de votre mot de passe`,
                message: createTextEmail(
                    'Nouveau Mot de Passe',
                    `Bonjour ${context.name || context.clientName || context.providerName || 'Cher client'},

Votre mot de passe a été réinitialisé comme demandé.

VOTRE NOUVEAU MOT DE PASSE :
${context.password || context.newPassword || 'N/A'}

POUR VOTRE SÉCURITÉ :
- Changez ce mot de passe temporaire dès votre première connexion
- Ne partagez jamais votre mot de passe

Se connecter : https://www.prestaservicesantilles.com/`
                )
            };

        case 'agenda_reminder':
            return {
                subject: `Rappel Agenda`,
                message: createTextEmail(
                    'Rappel',
                    `Bonjour,

Ceci est un rappel pour votre agenda.

Message :
${context.message || context.note || 'Vous avez un événement programmé.'}`
                )
            };

        case 'admin_new_message':
            return {
                subject: `Nouveau message client`,
                message: createTextEmail(
                    'Nouveau Message',
                    `Bonjour Admin,

Vous avez reçu un nouveau message d'un client.

- Client : ${context.clientName || 'N/A'}
- Message : "${context.message || context.text || 'Voir dans l\'application'}"

Répondre au message : https://www.prestaservicesantilles.com/admin/messages`
                )
            }

        case 'admin_new_service_request':
            return {
                subject: `Nouvelle demande de service client`,
                message: createTextEmail(
                    'Nouvelle Demande de Service',
                    `Bonjour Admin,

Une nouvelle demande de service a été soumise par un client.

DÉTAILS DE LA DEMANDE :
- Client : ${context.clientName || 'N/A'}
- Service : ${context.serviceType || 'N/A'}
- Pack : ${context.packName || 'Non spécifié'}
- Date demandée : ${context.requestedDate || 'N/A'}
- Créneau : ${context.requestedTime || 'N/A'}

ACTION REQUISE : Veuillez valider cette demande dans l'interface admin.

Accéder aux demandes : ${context.link || 'https://www.prestaservicesantilles.com/admin/nouvelles-demandes'}`
                )
            };

        case 'new_pack_announcement':
            return {
                subject: `Nouveau pack disponible !`,
                message: createTextEmail(
                    'Nouveau Pack',
                    `Bonjour ${context.clientName || 'Client'},

Nous sommes ravis de vous annoncer la disponibilité d'un nouveau pack !

DÉTAILS DU PACK :
- Nom : ${context.packName || 'N/A'}
- Description : ${context.packDescription || 'N/A'}
- Prix : ${context.packPrice || 'N/A'}

DÉCOUVRIR LE PACK :
${context.link || 'https://www.prestaservicesantilles.com/packs'}

N'hésitez pas à nous contacter pour plus d'informations.

---
Vous recevez cet email car vous êtes inscrit sur Presta Services Antilles.
Pour vous désabonner des emails marketing : https://www.prestaservicesantilles.com/unsubscribe?email=${encodeURIComponent(context.clientEmail || '')}`
                )
            };

        case 'no_mission_reminder':
            return {
                subject: `Rappel : Pas de mission prévue`,
                message: createTextEmail(
                    'Rappel',
                    `Bonjour ${context.clientName || 'Client'},

Ceci est un rappel pour vous informer qu'il n'y a pas de mission prévue pour vous dans les prochains jours.

SI VOUS AVEZ BESOIN D'UNE MISSION :
- Contactez-nous pour discuter de vos besoins
- Consultez notre site web pour voir les missions disponibles

${context.link || 'https://www.prestaservicesantilles.com/missions'}

---
Vous recevez cet email car vous êtes inscrit sur Presta Services Antilles.
Pour vous désabonner des emails marketing : https://www.prestaservicesantilles.com/unsubscribe?email=${encodeURIComponent(context.clientEmail || '')}`
                )
            };

        case 'post_mission_reminder':
            return {
                subject: `Rappel : Mission terminée`,
                message: createTextEmail(
                    'Rappel',
                    `Bonjour ${context.clientName || 'Client'},

Ceci est un rappel pour vous informer que votre mission est terminée.

DÉTAILS DE LA MISSION :
- Date : ${context.missionDate || 'N/A'}
- Heure : ${context.missionTime || 'N/A'}
- Prestataire : ${context.providerName || 'N/A'}

SI VOUS AVEZ DES QUESTIONS OU DES PRÉOCCUPATIONS :
- Contactez-nous pour discuter de vos besoins
- Consultez notre site web pour voir les missions disponibles

${context.link || 'https://www.prestaservicesantilles.com/missions'}

---
Vous recevez cet email car vous êtes inscrit sur Presta Services Antilles.
Pour vous désabonner des emails marketing : https://www.prestaservicesantilles.com/unsubscribe?email=${encodeURIComponent(context.clientEmail || '')}`
                )
            };

        case 'client_request_validated':
            return {
                subject: `Votre demande de service a été validée`,
                message: createTextEmail(
                    'Demande Validée',
                    `Bonjour ${context.clientName || 'Client'},

Nous avons le plaisir de vous confirmer que votre demande de service a été validée.

DÉTAILS VALIDÉS :
- Service : ${context.serviceType || 'N/A'}
- Date : ${context.serviceDate || 'À confirmer'}
- Devis : ${context.devisRef || 'Généré et disponible dans votre espace'}

PROCHAINES ÉTAPES :
Nos équipes vont maintenant assigner des prestataires qualifiés à votre mission très prochainement. Vous recevrez une notification dès qu'un prestataire aura été assigné.

Vous pouvez consulter votre devis signé et suivre l'avancement de votre mission dans votre espace client :
${context.link || 'https://www.prestaservicesantilles.com/'}

Merci de votre confiance,
L'équipe Presta Services Antilles`
                )
            };

        // ========== AFFILIATE / REFERRAL SYSTEM EMAILS ==========
        case 'referrer_welcome':
            return {
                subject: `Bienvenue dans le programme de parrainage !`,
                message: createTextEmail(
                    'Programme de Parrainage',
                    `Bonjour ${context.referrerName || 'Cher Parrain'},

Félicitations ! Vous faites maintenant partie du programme de parrainage Presta Services Antilles.

VOTRE CODE PARRAIN :
${context.referralCode || 'N/A'}

COMMENT ÇA MARCHE :
1️⃣ Partagez votre code avec vos proches
2️⃣ Ils s'inscrivent avec votre code et reçoivent une réduction
3️⃣ Vous gagnez des points à chaque mission effectuée par vos filleuls
4️⃣ Convertissez vos points en récompenses exclusives

VOS AVANTAGES :
- Gagnez des points à chaque mission de vos filleuls
- Accès exclusif aux promotions réservées aux parrains
- Suivez vos filleuls et vos gains en temps réel

ACCÉDER À VOTRE ESPACE PARRAIN :
${context.link || 'https://www.prestaservicesantilles.com/parrainage/dashboard'}

📊 Suivez vos performances, consultez vos points et découvrez les récompenses disponibles dans votre espace dédié.

Merci de faire confiance à Presta Services Antilles !`
                )
            };

        case 'new_referral_signed_up':
            return {
                subject: `🎉 Nouveau filleul inscrit avec votre code !`,
                message: createTextEmail(
                    'Nouveau Filleul',
                    `Bonjour ${context.referrerName || 'Cher Parrain'},

 Excellente nouvelle ! Un nouveau filleul vient de s'inscrire avec votre code de parrainage.

DÉTAILS DU FILLEUL :
- Nom : ${context.refereeName || 'N/A'}
- Date d'inscription : ${context.signupDate || new Date().toLocaleDateString('fr-FR')}

CE QUE VOUS GAGNEZ :
✅ Des points à chaque mission effectuée par ce filleul
✅ Des récompenses exclusives à cumuler

SUIVRE VOS FILLEULS :
${context.link || 'https://www.prestaservicesantilles.com/parrainage/mes-filleuls'}

Continuez à partager votre code pour gagner encore plus de récompenses !

Votre code parrain : ${context.referralCode || 'N/A'}`
                )
            };

        case 'referral_points_earned':
            return {
                subject: `💰 Vous avez gagné des points !`,
                message: createTextEmail(
                    'Points Gagnés',
                    `Bonjour ${context.referrerName || 'Cher Parrain'},

 Félicitations ! Vous venez de gagner des points grâce à votre filleul.

DÉTAILS DES POINTS GAGNÉS :
- Points gagnés : +${context.pointsEarned || 'N/A'} points
- Filleul concerné : ${context.refereeName || 'N/A'}
- Mission effectuée : ${context.missionType || 'Service'}
- Date : ${context.missionDate || new Date().toLocaleDateString('fr-FR')}

VOTRE SOLDE ACTUEL :
${context.totalPoints || 'N/A'} points

💡 À quoi servent vos points ?
Vos points vous permettent d'obtenir des réductions sur vos propres prestations ou des récompenses exclusives.

DÉCOUVRIR LES RÉCOMPENSES :
${context.link || 'https://www.prestaservicesantilles.com/parrainage/recompenses'}

Continuez à parrainer et cumulez encore plus de points !`
                )
            };

        case 'reward_available':
            return {
                subject: `🎁 Une récompense vous attend !`,
                message: createTextEmail(
                    'Récompense Disponible',
                    `Bonjour ${context.referrerName || 'Cher Parrain'},

 Excellente nouvelle ! Vous avez cumulé suffisamment de points pour obtenir une récompense.

VOTRE SOLDE :
${context.totalPoints || 'N/A'} points disponibles

RÉCOMPENSES DISPONIBLES :
${context.availableRewards || '- Réduction de 10% sur votre prochaine prestation (500 points)\n- 1 heure de ménage offerte (1000 points)\n- Pack découverte gratuit (1500 points)'}

COMMENT RÉCLAMER :
1. Connectez-vous à votre espace parrain
2. Choisissez votre récompense
3. Profitez-en immédiatement ou sur votre prochaine prestation

VOIR LES RÉCOMPENSES :
${context.link || 'https://www.prestaservicesantilles.com/parrainage/recompenses'}

N'attendez pas, vos points n'attendent que vous ! 🎉`
                )
            };

        case 'referee_welcome':
            return {
                subject: `Bienvenue ! Vous avez été parrainé`,
                message: createTextEmail(
                    'Bienvenue Parrainé',
                    `Bonjour ${context.refereeName || 'Cher Client'},

Bienvenue chez Presta Services Antilles ! Vous avez été parrainé par ${context.referrerName || 'un de nos clients'}.

VOTRE AVANTAGE PARRAINAGE :
🎁 ${context.bonusOffer || '10% de réduction sur votre première prestation'}

COMMENT PROFITER DE VOTRE OFFRE :
1. Connectez-vous à votre espace client
2. Réservez votre première prestation
3. La réduction sera automatiquement appliquée

ACCÉDER À VOTRE ESPACE :
${context.link || 'https://www.prestaservicesantilles.com/'}

VOS IDENTIFIANTS :
- Email : ${context.email || 'N/A'}
- Mot de passe : ${context.password || 'Défini lors de votre inscription'}

Vous aussi, devenez parrain !
Après votre première prestation, vous pourrez à votre tour parrainer vos proches et gagner des récompenses.

Merci de nous faire confiance,
L'équipe Presta Services Antilles`
                )
            };

        // ========== CONTRACT VALIDATION EMAILS ==========
        case 'contract_validation_request':
            return {
                subject: `URGENT - Demande de validation de contrat`,
                message: createTextEmail(
                    'Demande de Validation',
                    `Bonjour Super Administrateur,

[!] Une demande de validation de contrat nécessite votre attention.

INFORMATIONS DU CONTRAT :
- Référence : ${context.contractRef || 'N/A'}
- Client : ${context.clientName || 'N/A'}
- Demandé par : ${context.secretaryName || 'Secrétariat'}

ACTION REQUISE : Veuillez vous connecter pour examiner et valider ce contrat.

Accéder à l'espace de validation : ${context.link || 'https://www.prestaservicesantilles.com/login'}`
                )
            };

        case 'contract_validated':
            return {
                subject: `Contrat validé - ${context.contractRef}`,
                message: createTextEmail(
                    'Validation Confirmée',
                    `Bonjour,

[OK] Un contrat a été validé par le super administrateur.

INFORMATIONS :
- Contrat : ${context.contractRef || 'N/A'}
- Client : ${context.clientName || 'N/A'}
- Validé par : ${context.superAdminName || 'Super Admin'}
- Date de validation : ${context.validatedAt || 'N/A'}

Le contrat est maintenant actif et peut être utilisé.`
                )
            };

        // ========== DEFAULT TEMPLATE ==========
        default:
            return {
                subject: context.subject || `Message de ${companyName}`,
                message: createTextEmail(
                    'Notification',
                    `Bonjour ${context.name || context.clientName || context.providerName || ''},

Vous avez reçu une nouvelle notification importante concernant votre compte.

${context.message || 'Vous avez reçu une notification.'}
`
                )
            };
    }
};
