import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createTransport } from "https://esm.sh/nodemailer@6.9.7";

// Declare Deno to avoid TypeScript errors if the environment types are not loaded
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Gestion des requêtes CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, template, context } = await req.json();

    // Vérification de la configuration SMTP
    if (!Deno.env.get('MAIL_HOST') || !Deno.env.get('MAIL_USERNAME')) {
        console.error("Missing configuration SMTP env vars");
        throw new Error('Configuration SMTP manquante sur le serveur.');
    }

    // Configuration du transporteur SMTP (Hostinger)
    const transporter = createTransport({
      host: Deno.env.get('MAIL_HOST'),
      port: parseInt(Deno.env.get('MAIL_PORT') || '465'),
      secure: Deno.env.get('MAIL_ENCRYPTION') === 'ssl', 
      auth: {
        user: Deno.env.get('MAIL_USERNAME'),
        pass: Deno.env.get('MAIL_PASSWORD'),
      },
    });

    // --- Génération du HTML en fonction du template ---
    let htmlContent = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">`;
    
    // En-tête
    htmlContent += `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #2A9D8F; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${Deno.env.get('MAIL_FROM_NAME') || 'Presta Services Antilles'}</h1>
        </div>
        <div style="padding: 30px;">
    `;

    // Corps du message
    switch(template) {
        case 'welcome_client_panel':
            htmlContent += `
                <h2 style="color: #264653;">Bienvenue ${context.name} !</h2>
                <p>Votre espace client a été créé avec succès. Vous pouvez désormais suivre vos prestations, factures et documents en temps réel.</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Votre identifiant :</strong> ${context.login}</p>
                    <p style="margin: 5px 0;"><strong>Mot de passe provisoire :</strong> <span style="font-family: monospace; font-size: 16px; color: #E76F51;">${context.password}</span></p>
                </div>
                <p style="text-align: center; margin-top: 30px;">
                    <a href="${context.link}" style="background-color: #E76F51; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accéder à mon espace</a>
                </p>
            `;
            break;

        case 'welcome_provider':
            htmlContent += `
                <h2 style="color: #264653;">Bienvenue dans l'équipe, ${context.name} !</h2>
                <p>Votre compte intervenant est désormais actif. Connectez-vous pour voir vos missions et gérer votre planning.</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Email :</strong> ${context.login}</p>
                    <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${context.password}</p>
                </div>
                <p style="text-align: center; margin-top: 30px;">
                    <a href="${context.link}" style="background-color: #2A9D8F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accéder à mon espace</a>
                </p>
            `;
            break;

        case 'reset_password':
            htmlContent += `
                <h2 style="color: #264653;">Réinitialisation de mot de passe</h2>
                <p>Votre mot de passe a été réinitialisé par un administrateur.</p>
                <p><strong>Nouveau mot de passe :</strong> ${context.newPassword}</p>
                <p>Pensez à le modifier dès votre prochaine connexion.</p>
            `;
            break;

        case 'reminder_48h':
            htmlContent += `
                <h2 style="color: #E76F51;">Rappel Intervention</h2>
                <p>Bonjour ${context.clientName},</p>
                <p>Ceci est un rappel pour votre intervention prévue le :</p>
                <p style="font-size: 18px; text-align: center;"><strong>📅 ${context.date} à ${context.time}</strong></p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #E76F51; font-weight: bold; font-size: 12px;">⚠️ IMPORTANT : Conformément à nos conditions générales, nous vous rappelons que toute annulation à moins de 48h de l'intervention entraînera une facturation.</p>
            `;
            break;

        case 'mission_report':
            htmlContent += `
                <h2 style="color: #2A9D8F;">Compte Rendu de Mission</h2>
                <p>Bonjour ${context.clientName},</p>
                <p>L'intervention suivante est terminée :</p>
                <ul style="list-style: none; padding: 0;">
                    <li><strong>📅 Date :</strong> ${context.date}</li>
                    <li><strong>⏰ Horaire :</strong> ${context.startTime} - ${context.endTime}</li>
                    <li><strong>👤 Intervenant :</strong> ${context.providerName}</li>
                    <li><strong>🧹 Service :</strong> ${context.service}</li>
                </ul>
                <div style="background-color: #eaf4f4; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <strong>📝 Remarque de l'intervenant :</strong><br/>
                    <em>"${context.remark}"</em>
                </div>
            `;
            break;

        case 'provider_mission_assigned':
            htmlContent += `
                <h2 style="color: #264653;">Nouvelle Mission Assignée</h2>
                <p>Une nouvelle mission a été ajoutée à votre planning.</p>
                <p><strong>Client :</strong> ${context.clientName}</p>
                <p>Connectez-vous à votre espace pour voir l'adresse et les détails complets (ID: ${context.missionId}).</p>
            `;
            break;

        case 'admin_quote_signed':
            htmlContent += `
                <h2 style="color: #2A9D8F;">✅ Devis Signé !</h2>
                <p>Le devis <strong>${context.ref}</strong> a été signé par <strong>${context.clientName}</strong>.</p>
                <p><strong>Montant :</strong> ${context.total} €</p>
                <p>Les créneaux associés ont été verrouillés dans le planning.</p>
            `;
            break;

        case 'admin_mission_cancelled':
            htmlContent += `
                <h2 style="color: #E76F51;">🚨 Annulation Prestataire</h2>
                <p><strong>Intervenant :</strong> ${context.providerName}</p>
                <p><strong>Client :</strong> ${context.clientName}</p>
                <p><strong>Date :</strong> ${context.date}</p>
                <p><strong>Motif :</strong> ${context.reason}</p>
                <p>Merci de contacter le client pour reprogrammer ou trouver un remplaçant.</p>
            `;
            break;

        case 'new_document':
            htmlContent += `
                <h2 style="color: #264653;">Nouveau Document Disponible</h2>
                <p>Un nouveau document (${context.type}) référence <strong>${context.ref}</strong> est disponible dans votre espace.</p>
                <p><strong>Montant :</strong> ${context.total} €</p>
            `;
            break;

        default:
            htmlContent += `
                <h3>${subject}</h3>
                <pre style="background: #eee; padding: 10px; overflow: auto;">${JSON.stringify(context, null, 2)}</pre>
            `;
    }

    // Pied de page
    htmlContent += `
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
            <p style="margin: 0;">${Deno.env.get('MAIL_FROM_NAME') || 'Presta Services Antilles'}</p>
            <p style="margin: 5px 0;">Ceci est un email automatique, merci de ne pas y répondre directement sauf indication contraire.</p>
        </div>
    </div>
    </div>`;

    const mailOptions = {
      from: `"${Deno.env.get('MAIL_FROM_NAME')}" <${Deno.env.get('MAIL_FROM_ADDRESS')}>`,
      to: to,
      subject: subject,
      html: htmlContent,
    };

    // Envoi effectif
    const info = await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error sending email:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});