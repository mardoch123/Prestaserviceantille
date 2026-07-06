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
  clientName: string;
  date: string;
  time: string;
  service?: string | null;
}): string {
  const safeService = String(params.service || "").trim();
  const serviceLine = safeService ? `- Prestation : ${safeService}` : "";

  return `PRESTA SERVICES ANTILLES
31 Résidence L'Autre Bord – 97220 La Trinité
📧 prestaservicesantilles@gmail.com | 📞 0696 06 15 94

Objet : Rappel important – intervention à moins de 48h

Bonjour ${params.clientName},

Nous vous rappelons que votre intervention est prévue dans moins de 48 heures.

DÉTAILS DE L'INTERVENTION :
- Date : ${params.date}
- Heure : ${params.time}
${serviceLine}

IMPORTANT : Toute annulation à moins de 48h entraîne une facturation à 100% de la prestation, conformément à nos conditions.

Si vous avez un empêchement, merci de nous contacter au plus vite.

Cordialement,
L’équipe Presta Services Antilles`;
}

function buildReminderNotificationMessage(params: { date: string; time: string }): string {
  return `Votre intervention du ${params.date} à ${params.time} est à moins de 48h. Toute annulation entraîne une facturation à 100%.`;
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
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    // Fetch a superset: planned missions in the next 3 days and not yet reminded.
    const inThreeDays = new Date(nowMs + 3 * 24 * 60 * 60 * 1000);

    const { data: missions, error: missionsError } = await supabase
      .from("missions")
      .select("id,date,start_time,client_id,client_name,service,reminder_48h_sent,status")
      .eq("status", "planned")
      .or("reminder_48h_sent.is.null,reminder_48h_sent.eq.false")
      .gte("date", now.toISOString().slice(0, 10))
      .lte("date", inThreeDays.toISOString().slice(0, 10))
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
        const clientId = String((m as any).client_id || "");
        const clientName = String((m as any).client_name || "Client");
        const service = (m as any).service ?? null;

        if (!date || !startTime || !clientId) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "missing_fields" });
          continue;
        }

        const missionDate = new Date(`${date}T${startTime}:00`);
        const diff = missionDate.getTime() - nowMs;

        // Only send if within next 48h
        if (!(diff > 0 && diff <= fortyEightHoursMs)) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "not_in_48h_window" });
          continue;
        }

        candidates++;

        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id,email,name")
          .eq("id", clientId)
          .maybeSingle();

        if (clientError) throw clientError;
        const email = String((client as any)?.email || "").trim();
        if (!email) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "missing_client_email" });
          continue;
        }

        const subject = "Rappel intervention – annulation à moins de 48h";
        const message = buildReminderMessage({
          clientName: clientName || String((client as any)?.name || "Client"),
          date,
          time: startTime,
          service,
        });

        if (!dryRun) {
          // Vérification de sécurité : s'assurer que le reminder n'a pas été envoyé entre temps
          // (évite les doublons si la fonction est appelée plusieurs fois en parallèle)
          const { data: freshMission } = await supabase
            .from("missions")
            .select("reminder_48h_sent")
            .eq("id", missionId)
            .single();

          if (freshMission?.reminder_48h_sent) {
            skipped++;
            results.push({ id: missionId, status: "skipped", reason: "already_sent_race_condition" });
            continue;
          }

          await sendEmailViaEmailJS({ to: email, subject, message });

          // Log email in email_logs
          await supabase.from("email_logs").insert({
            recipient_email: email,
            subject: `${EMAIL_BRAND_NAME} - ${subject}`,
            template_type: "reminder_48h",
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          // Mark mission
          await supabase.from("missions").update({ reminder_48h_sent: true }).eq("id", missionId);

          // Notifications (client + admin)
          const nowIso = new Date().toISOString();
          const notifRows = [
            {
              id: crypto.randomUUID(),
              title: "Rappel intervention",
              message: buildReminderNotificationMessage({ date, time: startTime }),
              date: nowIso,
              is_read: false,
              link: null,
              created_at: nowIso,
              target_user_type: "client",
              target_user_role: "client",
              target_user_id: clientId,
            },
            {
              id: crypto.randomUUID(),
              title: "Rappel 48h envoyé",
              message: `Rappel 48h envoyé au client ${clientName} pour le ${date} à ${startTime}.`,
              date: nowIso,
              is_read: false,
              link: "tab:planning",
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
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
