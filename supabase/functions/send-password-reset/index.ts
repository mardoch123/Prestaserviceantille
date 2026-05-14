import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// EmailJS Configuration
const EMAILJS_SERVICE_ID = "service_0u67mco";
const EMAILJS_TEMPLATE_ID = "template_dhqrmbu";
const EMAILJS_PUBLIC_KEY = "jjYNnpHbr5djyFBlK";

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

    // Appeler l'API admin directement pour générer le lien
    const adminResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey
      },
      body: JSON.stringify({
        type: "recovery",
        email: email,
        options: {
          redirectTo: "https://prestaservicesantilles.com/reset-password"
        }
      })
    });

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      console.error("Erreur API admin:", adminResponse.status, errorText);
      // Ne pas révéler si l'email existe
      return new Response(
        JSON.stringify({ success: true, message: "Si cet email existe, un lien de réinitialisation a été envoyé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetData = await adminResponse.json();
    const resetLink = resetData.properties?.href;
    const appUrl = Deno.env.get("SITE_URL") || "https://prestaservicesantilles.com";

    // Envoyer l'email via EmailJS
    console.log("Envoi email via EmailJS à:", email);
    console.log("Reset link:", resetLink);

    const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: email,
          name: "Presta Services Antilles",
          subject: "Réinitialisation de votre mot de passe",
          message: `Cliquez sur le lien suivant pour réinitialiser votre mot de passe : ${resetLink}\n\nCe lien expire dans 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`
        }
      }),
    });

    if (!emailjsResponse.ok) {
      const errorData = await emailjsResponse.text();
      console.error("Erreur EmailJS:", errorData);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'envoi de l'email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email EmailJS envoyé avec succès à:", email);

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
