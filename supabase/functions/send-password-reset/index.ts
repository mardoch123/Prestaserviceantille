import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Configuration serveur manquante" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Vérifier si l'utilisateur existe
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    const user = userData?.users?.find((u) => 
      u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      // Ne pas révéler si l'email existe ou non pour des raisons de sécurité
      return new Response(
        JSON.stringify({ success: true, message: "Si cet email existe, un lien de réinitialisation a été envoyé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Générer le lien de réinitialisation via Supabase
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
    });

    if (resetError) {
      console.error("Erreur génération lien:", resetError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la génération du lien" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = resetData.properties?.href;
    const appUrl = Deno.env.get("SITE_URL") || "https://prestaservicesantilles.com";

    // Envoyer l'email via Resend
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY non configurée");
      return new Response(
        JSON.stringify({ error: "Service email non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Presta Services Antilles <onboarding@resend.dev>",
        to: email,
        subject: "Réinitialisation de votre mot de passe",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e40af 0%, #0d9488 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Presta Services Antilles</h1>
              </div>
              <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                <h2 style="color: #1e293b; margin-top: 0;">Réinitialisation de votre mot de passe</h2>
                <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Réinitialiser mon mot de passe</a>
                </div>
                <p style="font-size: 14px; color: #64748b;">Ce lien expire dans 1 heure.</p>
                <p style="font-size: 14px; color: #64748b;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                  © 2026 Presta Services Antilles - Martinique
                </p>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("Erreur Resend:", errorData);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'envoi de l'email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email de réinitialisation envoyé" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erreur:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
