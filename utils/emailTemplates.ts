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
    const companyPhone = '0590 12 34 56';
    const companyAddress = '31 Résidence L\'Autre Bord – 97220 La Trinité';

    // Helper function to create Text email (Fallback for when HTML is not supported/configured)
    const createTextEmail = (title: string, content: string): string => {
        return `
${companyName.toUpperCase()}
==================================================

${title}

--------------------------------------------------

${content}

--------------------------------------------------
${companyName}
${companyAddress}
Email: ${companyEmail} | Tél: ${companyPhone}
        `.trim();
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

Nous sommes ravis de vous accueillir chez ${companyName} ! Votre compte client a été créé avec succès.

VOS IDENTIFIANTS DE CONNEXION :
- Email : ${context.login || context.email}
- Mot de passe : ${context.password}

Vous pouvez vous connecter dès maintenant à votre espace client pour :
- Consulter vos missions en cours et à venir
- Suivre vos documents (devis, factures, contrats)
- Gérer vos informations personnelles
- Contacter notre équipe

Accédez à votre espace ici : ${context.link || 'https://outremerfermetures.com/login'}

Conseil de sécurité : Nous vous recommandons de changer votre mot de passe lors de votre première connexion.`
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

Accédez à votre espace ici : ${context.link || 'https://outremerfermetures.com/login'}

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

IMPORTANT : À partir de maintenant, toute annulation de votre part sera considérée comme tardive. La mission sera facturée à 50% (hors SAP) conformément à nos conditions générales.

Si vous avez des questions, n'hésitez pas à nous contacter rapidement.`
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
https://outremerfermetures.com/login`
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
https://outremerfermetures.com/login`
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
${context.link || 'https://outremerfermetures.com/reports'}`
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

Gérer la mission : https://outremerfermetures.com/admin`
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

FACTURATION : Cette mission doit être facturée à 50% conformément aux CGV.

Gérer la facturation : https://outremerfermetures.com/admin`
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
https://outremerfermetures.com/login`
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
https://outremerfermetures.com/login`
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

Gérer le devis : https://outremerfermetures.com/admin`
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
                    `Bonjour ${context.name || 'Utilisateur'},

Votre mot de passe a été réinitialisé comme demandé.

VOTRE NOUVEAU MOT DE PASSE :
${context.password || context.newPassword || 'N/A'}

POUR VOTRE SÉCURITÉ :
- Changez ce mot de passe temporaire dès votre première connexion
- Ne partagez jamais votre mot de passe

Se connecter : https://outremerfermetures.com/login`
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

Répondre au message : https://outremerfermetures.com/admin/messages`
                )
            }

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

Accéder à l'espace de validation : ${context.link || 'https://presta-antilles.app/login'}`
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

${context.message || 'Vous avez reçu une notification.'}

Connectez-vous à votre espace pour plus de détails sur https://outremerfermetures.com/login`
                )
            };
    }
};
