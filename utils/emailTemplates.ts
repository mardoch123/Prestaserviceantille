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

    // Helper function to create HTML email
    const createHtmlEmail = (title: string, content: string): string => {
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px 0; }
        .info-box { background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; border-radius: 5px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .button:hover { background: #764ba2; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        .credentials { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .credentials strong { color: #856404; }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${companyName}</h1>
            <p style="margin: 5px 0 0 0;">${title}</p>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>${companyAddress}</p>
            <p>Email: ${companyEmail} | Tél: ${companyPhone}</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} ${companyName}. Tous droits réservés.</p>
        </div>
    </div>
</body>
</html>
        `.trim();
    };

    // Template selection based on type
    switch (templateType) {
        // ========== WELCOME EMAILS ==========
        case 'welcome_client_panel':
            return {
                subject: `Bienvenue chez ${companyName} - Accès à votre espace client`,
                message: createHtmlEmail(
                    '🎉 Bienvenue !',
                    `
                    <p>Bonjour <strong>${context.name || 'Client'}</strong>,</p>
                    <p>Nous sommes ravis de vous accueillir chez ${companyName} ! Votre compte client a été créé avec succès.</p>
                    
                    <div class="credentials">
                        <p><strong>🔐 Vos identifiants de connexion :</strong></p>
                        <p><strong>Email :</strong> ${context.login || context.email}</p>
                        <p><strong>Mot de passe :</strong> <code style="background: #ffe69c; padding: 2px 8px; border-radius: 3px;">${context.password}</code></p>
                    </div>
                    
                    <p>Vous pouvez vous connecter dès maintenant à votre espace client pour :</p>
                    <ul>
                        <li>Consulter vos missions en cours et à venir</li>
                        <li>Suivre vos documents (devis, factures, contrats)</li>
                        <li>Gérer vos informations personnelles</li>
                        <li>Contacter notre équipe</li>
                    </ul>
                    
                    <p style="text-align: center;">
                        <a href="${context.link || 'https://outremerfermetures.com/login'}" class="button">Accéder à mon espace client</a>
                    </p>
                    
                    <p><strong>Conseil de sécurité :</strong> Nous vous recommandons de changer votre mot de passe lors de votre première connexion.</p>
                    
                    <p>Notre équipe reste à votre disposition pour toute question.</p>
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'welcome_provider':
            return {
                subject: `Bienvenue dans l'équipe ${companyName} - Accès prestataire`,
                message: createHtmlEmail(
                    '👷 Bienvenue dans l\'équipe !',
                    `
                    <p>Bonjour <strong>${context.name || 'Prestataire'}</strong>,</p>
                    <p>Bienvenue chez ${companyName} ! Votre compte prestataire est maintenant actif.</p>
                    
                    <div class="credentials">
                        <p><strong>🔐 Vos identifiants de connexion :</strong></p>
                        <p><strong>Email :</strong> ${context.login || context.email}</p>
                        <p><strong>Mot de passe :</strong> <code style="background: #ffe69c; padding: 2px 8px; border-radius: 3px;">${context.password}</code></p>
                    </div>
                    
                    <p>Depuis votre espace prestataire, vous pourrez :</p>
                    <ul>
                        <li>Consulter vos missions assignées</li>
                        <li>Démarrer et terminer vos interventions</li>
                        <li>Télécharger vos photos et rapports</li>
                        <li>Gérer vos congés et disponibilités</li>
                        <li>Suivre vos heures de travail</li>
                    </ul>
                    
                    <p style="text-align: center;">
                        <a href="${context.link || 'https://outremerfermetures.com/login'}" class="button">Accéder à mon espace</a>
                    </p>
                    
                    <p><strong>Important :</strong> Pensez à changer votre mot de passe lors de votre première connexion.</p>
                    
                    <p>Nous sommes ravis de vous compter parmi notre équipe !</p>
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        // ========== MISSION EMAILS ==========
        case 'reminder_48h':
            return {
                subject: `⚠️ Rappel Intervention - Annulation impossible sans frais`,
                message: createHtmlEmail(
                    '⏰ Rappel Important',
                    `
                    <p>Bonjour <strong>${context.clientName || 'Client'}</strong>,</p>
                    
                    <div class="info-box" style="border-left-color: #ffc107; background: #fff3cd;">
                        <p style="margin: 0;"><strong>⚠️ Votre intervention est prévue dans moins de 48 heures</strong></p>
                    </div>
                    
                    <p><strong>📅 Détails de l'intervention :</strong></p>
                    <ul>
                        <li><strong>Date :</strong> ${context.date || 'À confirmer'}</li>
                        <li><strong>Heure :</strong> ${context.time || context.startTime || 'À confirmer'}</li>
                    </ul>
                    
                    <div class="info-box" style="border-left-color: #dc3545; background: #f8d7da;">
                        <p style="margin: 0; color: #721c24;"><strong>Important :</strong> À partir de maintenant, toute annulation de votre part sera considérée comme tardive. La mission sera facturée à 50% (hors SAP) conformément à nos conditions générales.</p>
                    </div>
                    
                    <p>Si vous avez des questions ou des préoccupations, n'hésitez pas à nous contacter rapidement.</p>
                    
                    <p>Merci de votre confiance,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'provider_mission_assigned':
            return {
                subject: `🔔 Nouvelle mission assignée`,
                message: createHtmlEmail(
                    '📋 Nouvelle Mission',
                    `
                    <p>Bonjour,</p>
                    <p>Une nouvelle mission vous a été assignée.</p>
                    
                    <div class="info-box">
                        <p><strong>Client :</strong> ${context.clientName || 'Non spécifié'}</p>
                        <p><strong>Mission ID :</strong> ${context.missionId || 'N/A'}</p>
                    </div>
                    
                    <p>Connectez-vous à votre espace prestataire pour consulter tous les détails de cette mission.</p>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/login" class="button">Voir ma mission</a>
                    </p>
                    
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'mission_report':
            return {
                subject: `✅ Compte rendu de votre intervention`,
                message: createHtmlEmail(
                    '✅ Mission Terminée',
                    `
                    <p>Bonjour <strong>${context.clientName || 'Client'}</strong>,</p>
                    <p>Votre intervention a été réalisée avec succès !</p>
                    
                    <div class="info-box">
                        <p><strong>📅 Date :</strong> ${context.date || 'N/A'}</p>
                        <p><strong>🕐 Horaire :</strong> ${context.startTime || ''} - ${context.endTime || ''}</p>
                        <p><strong>🔧 Service :</strong> ${context.service || 'N/A'}</p>
                        <p><strong>👷 Intervenant :</strong> ${context.providerName || 'N/A'}</p>
                    </div>
                    
                    <p><strong>📝 Remarques :</strong></p>
                    <p>${context.remark || 'R.A.S - Aucune remarque particulière'}</p>
                    
                    <p>Les photos et le rapport complet sont disponibles dans votre espace client.</p>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/login" class="button">Consulter le rapport complet</a>
                    </p>
                    
                    <p>Merci de votre confiance,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'admin_mission_report':
            return {
                subject: `📊 Fin de Mission - Rapport disponible`,
                message: createHtmlEmail(
                    '✅ Rapport de Mission',
                    `
                    <p>Bonjour Admin,</p>
                    <p>Une mission vient de se terminer.</p>
                    
                    <div class="info-box">
                        <p><strong>Client :</strong> ${context.clientName || 'N/A'}</p>
                        <p><strong>Prestataire :</strong> ${context.providerName || 'N/A'}</p>
                        <p><strong>Date :</strong> ${context.date || 'N/A'}</p>
                    </div>
                    
                    <p>Le rapport complet avec photos est disponible dans l'espace admin.</p>
                    
                    <p style="text-align: center;">
                        <a href="${context.link || 'https://outremerfermetures.com/reports'}" class="button">Voir le rapport</a>
                    </p>
                    `
                )
            };

        case 'admin_mission_cancelled':
            return {
                subject: `🚨 URGENT - Annulation Prestataire`,
                message: createHtmlEmail(
                    '⚠️ Annulation Mission',
                    `
                    <p>Bonjour Admin,</p>
                    
                    <div class="info-box" style="border-left-color: #dc3545; background: #f8d7da;">
                        <p style="color: #721c24; margin: 0;"><strong>🚨 Un prestataire a annulé une mission</strong></p>
                    </div>
                    
                    <p><strong>Prestataire :</strong> ${context.providerName || 'N/A'}</p>
                    <p><strong>Client :</strong> ${context.clientName || 'N/A'}</p>
                    <p><strong>Date :</strong> ${context.date || 'N/A'}</p>
                    <p><strong>Motif :</strong> ${context.reason || 'Non spécifié'}</p>
                    
                    <p><strong>⚡ Action requise :</strong> Le créneau est maintenant libéré. Vous devez réassigner cette mission à un autre prestataire.</p>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/admin" class="button">Gérer la mission</a>
                    </p>
                    `
                )
            };

        case 'admin_client_cancelled_late':
            return {
                subject: `⚠️ URGENT - Annulation Tardive Client`,
                message: createHtmlEmail(
                    '⚠️ Annulation Tardive',
                    `
                    <p>Bonjour Admin,</p>
                    
                    <div class="info-box" style="border-left-color: #ffc107; background: #fff3cd;">
                        <p style="color: #856404; margin: 0;"><strong>⚠️ Annulation tardive (moins de 48h)</strong></p>
                    </div>
                    
                    <p><strong>Client :</strong> ${context.clientName || 'N/A'}</p>
                    <p><strong>Date de la mission :</strong> ${context.date || 'N/A'}</p>
                    
                    <p><strong>💰 Facturation :</strong> Cette mission doit être facturée à 50% conformément aux CGV.</p>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/admin" class="button">Gérer la facturation</a>
                    </p>
                    `
                )
            };

        case 'admin_client_cancelled':
            return {
                subject: `ℹ️ Annulation Client`,
                message: createHtmlEmail(
                    'ℹ️ Annulation Mission',
                    `
                    <p>Bonjour Admin,</p>
                    <p>Un client a annulé une mission dans les délais.</p>
                    
                    <div class="info-box">
                        <p><strong>Client :</strong> ${context.clientName || 'N/A'}</p>
                        <p><strong>Date :</strong> ${context.date || 'N/A'}</p>
                    </div>
                    
                    <p>Le créneau est maintenant disponible pour une nouvelle réservation.</p>
                    `
                )
            };

        // ========== DOCUMENT EMAILS ==========
        case 'new_document':
            return {
                subject: context.subject || `📄 Nouveau document disponible`,
                message: createHtmlEmail(
                    '📄 Nouveau Document',
                    `
                    <p>Bonjour,</p>
                    <p>Un nouveau document est disponible dans votre espace client.</p>
                    
                    <div class="info-box">
                        <p><strong>Type :</strong> ${context.type || 'Document'}</p>
                        <p><strong>Référence :</strong> ${context.ref || context.reference || 'N/A'}</p>
                    </div>
                    
                    <p>Connectez-vous pour le consulter et le télécharger.</p>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/login" class="button">Consulter mes documents</a>
                    </p>
                    
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'document_status_update':
            return {
                subject: context.subject || `📄 Mise à jour de document`,
                message: createHtmlEmail(
                    '🔄 Mise à Jour Document',
                    `
                    <p>Bonjour,</p>
                    <p>Le statut d'un de vos documents a été mis à jour.</p>
                    
                    <div class="info-box">
                        <p><strong>Document :</strong> ${context.ref || context.reference || 'N/A'}</p>
                        <p><strong>Nouveau statut :</strong> ${context.status || 'Mis à jour'}</p>
                    </div>
                    
                    <p>Connectez-vous pour voir les détails.</p>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/login" class="button">Voir mes documents</a>
                    </p>
                    
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'admin_quote_signed':
            return {
                subject: `✅ URGENT - Devis Signé`,
                message: createHtmlEmail(
                    '✅ Devis Signé',
                    `
                    <p>Bonjour Admin,</p>
                    
                    <div class="info-box" style="border-left-color: #28a745; background: #d4edda;">
                        <p style="color: #155724; margin: 0;"><strong>✅ Un devis a été signé !</strong></p>
                    </div>
                    
                    <p><strong>Client :</strong> ${context.clientName || 'N/A'}</p>
                    <p><strong>Référence :</strong> ${context.reference || context.ref || 'N/A'}</p>
                    
                    <p><strong>⚡ Action requise :</strong> Planifier les missions et créer le contrat SAP si applicable.</p>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/admin" class="button">Gérer le devis</a>
                    </p>
                    `
                )
            };

        case 'admin_quote_rejected':
            return {
                subject: `❌ Devis Refusé`,
                message: createHtmlEmail(
                    '❌ Devis Refusé',
                    `
                    <p>Bonjour Admin,</p>
                    <p>Un client a refusé un devis.</p>
                    
                    <div class="info-box">
                        <p><strong>Client :</strong> ${context.clientName || 'N/A'}</p>
                        <p><strong>Référence :</strong> ${context.reference || context.ref || 'N/A'}</p>
                    </div>
                    
                    <p>Vous pouvez contacter le client pour comprendre les raisons et proposer des alternatives.</p>
                    `
                )
            };

        // ========== OTHER EMAILS ==========
        case 'reset_password':
            return {
                subject: `🔐 Réinitialisation de votre mot de passe`,
                message: createHtmlEmail(
                    '🔐 Nouveau Mot de Passe',
                    `
                    <p>Bonjour <strong>${context.name || 'Utilisateur'}</strong>,</p>
                    <p>Votre mot de passe a été réinitialisé comme demandé.</p>
                    
                    <div class="credentials">
                        <p><strong>🔐 Votre nouveau mot de passe :</strong></p>
                        <p><code style="background: #ffe69c; padding: 2px 8px; border-radius: 3px; font-size: 16px;">${context.password || context.newPassword || 'N/A'}</code></p>
                    </div>
                    
                    <p><strong>⚠️ Pour votre sécurité :</strong></p>
                    <ul>
                        <li>Changez ce mot de passe temporaire dès votre première connexion</li>
                        <li>Ne partagez jamais votre mot de passe</li>
                        <li>Utilisez un mot de passe fort et unique</li>
                    </ul>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/login" class="button">Se connecter</a>
                    </p>
                    
                    <p>Si vous n'avez pas demandé cette réinitialisation, contactez-nous immédiatement.</p>
                    
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'agenda_reminder':
            return {
                subject: `⏰ Rappel Agenda`,
                message: createHtmlEmail(
                    '⏰ Rappel',
                    `
                    <p>Bonjour,</p>
                    <p>Ceci est un rappel pour votre agenda.</p>
                    
                    <div class="info-box">
                        <p>${context.message || context.note || 'Vous avez un événement programmé.'}</p>
                    </div>
                    
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        case 'admin_new_message':
            return {
                subject: `💬 Nouveau message client`,
                message: createHtmlEmail(
                    '💬 Nouveau Message',
                    `
                    <p>Bonjour Admin,</p>
                    <p>Vous avez reçu un nouveau message d'un client.</p>
                    
                    <div class="info-box">
                        <p><strong>Client :</strong> ${context.clientName || 'N/A'}</p>
                        <p><strong>Message :</strong></p>
                        <p style="font-style: italic;">"${context.message || context.text || 'Voir dans l\'application'}"</p>
                    </div>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/admin/messages" class="button">Répondre au message</a>
                    </p>
                    `
                )
            }

        // ========== CONTRACT VALIDATION EMAILS ==========
        case 'contract_validation_request':
            return {
                subject: `🔔 URGENT - Demande de validation de contrat`,
                message: createHtmlEmail(
                    '📝 Demande de Validation',
                    `
                    <p>Bonjour Super Administrateur,</p>
                    
                    <div class="info-box" style="border-left-color: #ffc107; background: #fff3cd;">
                        <p style="color: #856404; margin: 0;"><strong>⚡ Une demande de validation de contrat nécessite votre attention</strong></p>
                    </div>
                    
                    <p><strong>Informations du contrat :</strong></p>
                    <ul>
                        <li><strong>Référence :</strong> ${context.contractRef || 'N/A'}</li>
                        <li><strong>Client :</strong> ${context.clientName || 'N/A'}</li>
                        <li><strong>Demandé par :</strong> ${context.secretaryName || 'Secrétariat'}</li>
                    </ul>
                    
                    <p><strong>⚡ Action requise :</strong> Veuillez vous connecter pour examiner et valider ce contrat.</p>
                    
                    <p style="text-align: center;">
                        <a href="${context.link || 'https://presta-antilles.app/login'}" class="button">Accéder à l'espace de validation</a>
                    </p>
                    
                    <p>Cordialement,<br>Système ${companyName}</p>
                    `
                )
            };

        case 'contract_validated':
            return {
                subject: `✅ Contrat validé - ${context.contractRef}`,
                message: createHtmlEmail(
                    '✅ Validation Confirmée',
                    `
                    <p>Bonjour,</p>
                    
                    <div class="info-box" style="border-left-color: #28a745; background: #d4edda;">
                        <p style="color: #155724; margin: 0;"><strong>✅ Un contrat a été validé par le super administrateur</strong></p>
                    </div>
                    
                    <p><strong>Informations :</strong></p>
                    <ul>
                        <li><strong>Contrat :</strong> ${context.contractRef || 'N/A'}</li>
                        <li><strong>Client :</strong> ${context.clientName || 'N/A'}</li>
                        <li><strong>Validé par :</strong> ${context.superAdminName || 'Super Admin'}</li>
                        <li><strong>Date de validation :</strong> ${context.validatedAt || 'N/A'}</li>
                    </ul>
                    
                    <p>Le contrat est maintenant actif et peut être utilisé.</p>
                    
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };

        // ========== DEFAULT TEMPLATE ==========
        default:
            return {
                subject: context.subject || `Message de ${companyName}`,
                message: createHtmlEmail(
                    'Notification',
                    `
                    <p>Bonjour ${context.name || context.clientName || context.providerName || ''},</p>
                    <p>${context.message || 'Vous avez reçu une notification.'}</p>
                    
                    <div class="info-box">
                        <p>Connectez-vous à votre espace pour plus de détails.</p>
                    </div>
                    
                    <p style="text-align: center;">
                        <a href="https://outremerfermetures.com/login" class="button">Accéder à mon espace</a>
                    </p>
                    
                    <p>Cordialement,<br>L'équipe ${companyName}</p>
                    `
                )
            };
    }
};
