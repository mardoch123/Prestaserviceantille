import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_BRAND_NAME = "Presta Services Antilles";

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

async function sendEmailViaEmailJS(params: { to: string; subject: string; message: string }) {
  const serviceId = getRequiredEnv("EMAILJS_SERVICE_ID");
  const templateId = getRequiredEnv("EMAILJS_TEMPLATE_ID");
  const publicKey = getRequiredEnv("EMAILJS_PUBLIC_KEY");

  const normalizedSubject = `${EMAIL_BRAND_NAME} - ${String(params.subject || "").trim()}`.trim();

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: params.to,
        name: EMAIL_BRAND_NAME,
        subject: normalizedSubject,
        message: params.message,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`EmailJS send failed: ${res.status} ${txt}`);
  }
}

function buildReminderMessage(params: {
  providerName: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  service?: string | null;
  address?: string | null;
}): string {
  const safeService = String(params.service || "").trim();
  const serviceLine = safeService ? `- Prestation : ${safeService}` : "";
  const safeAddress = String(params.address || "").trim();
  const addressLine = safeAddress ? `- Adresse : ${safeAddress}` : "";

  return `PRESTA SERVICES ANTILLES
31 Résidence L'Autre Bord – 97220 La Trinité
📧 prestaservicesantilles.rh@gmail.com | 📞 0696 06 15 94

Objet : Rappel mission dans 24h

Bonjour ${params.providerName},

Vous avez une mission prévue dans moins de 24 heures.

DÉTAILS DE LA MISSION :
- Client : ${params.clientName}
- Date : ${params.date}
- Heure : ${params.startTime} - ${params.endTime}
${serviceLine}
${addressLine}

IMPORTANT :
- Merci de confirmer votre présence en répondant à cet email ou via votre espace prestataire.
- En cas d'empêchement, contactez-nous immédiatement au 0696 06 15 94.

Cordialement,
L'équipe Presta Services Antilles`;
}

function buildReminderNotificationMessage(params: { 
  clientName: string;
  date: string; 
  startTime: string;
  endTime: string;
}): string {
  return `Mission demain chez ${params.clientName} - ${params.date} de ${params.startTime} à ${params.endTime}.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit || 100), 1), 500);
    const dryRun = Boolean(body?.dryRun);

    const now = new Date();
    const nowMs = now.getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    // Fetch a superset: planned missions in the next 2 days with provider assigned
    const inTwoDays = new Date(nowMs + 2 * 24 * 60 * 60 * 1000);

    const { data: missions, error: missionsError } = await supabase
      .from("missions")
      .select("id,date,start_time,end_time,client_id,client_name,service,provider_id,provider_name,reminder_24h_provider_sent,status")
      .eq("status", "planned")
      .not("provider_id", "is", null)
      .or("reminder_24h_provider_sent.is.null,reminder_24h_provider_sent.eq.false")
      .gte("date", now.toISOString().slice(0, 10))
      .lte("date", inTwoDays.toISOString().slice(0, 10))
      .order("date", { ascending: true })
      .limit(limit);

    if (missionsError) {
      return new Response(JSON.stringify({ error: missionsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let candidates = 0;
    let processed = 0;
    let sent = 0;
    let skipped = 0;
    const results: Array<{ id: string; status: "sent" | "skipped" | "error"; reason?: string }> = [];

    for (const m of missions || []) {
      const missionId = String((m as any).id || "");
      if (!missionId) continue;

      try {
        const date = String((m as any).date || "");
        const startTime = String((m as any).start_time || "").slice(0, 5);
        const endTime = String((m as any).end_time || "").slice(0, 5);
        const clientId = String((m as any).client_id || "");
        const clientName = String((m as any).client_name || "Client");
        const service = (m as any).service ?? null;
        const providerId = String((m as any).provider_id || "");
        const providerName = String((m as any).provider_name || "Prestataire");

        if (!date || !startTime || !providerId) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "missing_fields" });
          continue;
        }

        const missionDate = new Date(`${date}T${startTime}:00`);
        const diff = missionDate.getTime() - nowMs;

        // Only send if within next 24h
        if (!(diff > 0 && diff <= twentyFourHoursMs)) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "not_in_24h_window" });
          continue;
        }

        candidates++;

        // Fetch provider email and client address
        const [{ data: provider }, { data: client }] = await Promise.all([
          supabase.from("providers").select("id,email,first_name,last_name").eq("id", providerId).maybeSingle(),
          supabase.from("clients").select("id,address").eq("id", clientId).maybeSingle()
        ]);

        const providerEmail = String((provider as any)?.email || "").trim();
        if (!providerEmail) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "missing_provider_email" });
          continue;
        }

        const fullProviderName = `${String((provider as any)?.first_name || "").trim()} ${String((provider as any)?.last_name || "").trim()}`.trim() || providerName;
        const address = String((client as any)?.address || "").trim() || null;

        const subject = "Rappel mission dans 24h";
        const message = buildReminderMessage({
          providerName: fullProviderName,
          clientName,
          date,
          startTime,
          endTime,
          service,
          address
        });

        if (!dryRun) {
          await sendEmailViaEmailJS({ to: providerEmail, subject, message });

          // Mark mission as reminded
          await supabase.from("missions").update({ reminder_24h_provider_sent: true }).eq("id", missionId);

          // Notifications (provider + admin)
          const nowIso = new Date().toISOString();
          const notifRows = [
            {
              id: crypto.randomUUID(),
              title: "Mission demain",
              message: buildReminderNotificationMessage({ clientName, date, startTime, endTime }),
              date: nowIso,
              is_read: false,
              link: `mission:${missionId}`,
              created_at: nowIso,
              target_user_type: "provider",
              target_user_role: "provider",
              target_user_id: providerId,
            },
            {
              id: crypto.randomUUID(),
              title: "Rappel 24h prestataire envoyé",
              message: `Rappel envoyé à ${fullProviderName} pour la mission chez ${clientName} le ${date} à ${startTime}.`,
              date: nowIso,
              is_read: false,
              link: `tab:planning`,
              created_at: nowIso,
              target_user_type: "admin",
              target_user_role: "admin",
              target_user_id: null,
            },
          ];

          await supabase.from("notifications").insert(notifRows);
        }

        processed++;
        sent++;
        results.push({ id: missionId, status: "sent" });
      } catch (e) {
        processed++;
        results.push({ id: missionId, status: "error", reason: String((e as any)?.message || e) });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        fetched: (missions || []).length,
        candidates,
        processed,
        sent,
        skipped,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
