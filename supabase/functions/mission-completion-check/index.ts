import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const EMAIL_BRAND_NAME = "Presta Services Antilles";

// Délai minimum après la fin de mission avant d'envoyer la demande de confirmation : 2 heures
const COMPLETION_CHECK_DELAY_MS = 2 * 60 * 60 * 1000;
// Fenêtre maximale : on ne relance pas des missions vieilles de plus de 7 jours (anti-spam)
const MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
// La Martinique est en UTC-4 toute l'année (pas d'heure d'été)
const MARTINIQUE_OFFSET = "-04:00";

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

/**
 * Reproduction exacte de getMissionValidationToken (utils/emailTemplates.ts côté front).
 * Token déterministe utilisé par la page /validation-prestation.
 */
function getMissionValidationToken(missionId: string, missionDate?: string): string {
  const raw = `psa-val-${missionId}-${missionDate || "mission"}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalisation des statuts identique à celle du front (DataContext.tsx).
 * Retourne true si la mission est terminée ou annulée (donc exclue de la relance).
 */
function isClosedStatus(value: any): boolean {
  const plain = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");

  if (["completed", "complete", "terminee", "termine", "done", "finished"].includes(plain)) return true;
  if (["cancelled", "canceled", "annulee", "annule"].includes(plain)) return true;
  return false;
}

function buildCompletionCheckMessage(params: {
  providerName: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  service?: string | null;
  doneUrl: string;
  notDoneUrl: string;
}): string {
  const safeService = String(params.service || "Prestation").trim();

  return `PRESTA SERVICES ANTILLES
31 Résidence L'Autre Bord – 97220 La Trinité
📧 prestaservicesantilles@gmail.com | 📞 0696 06 15 94

Objet : Confirmation d'intervention du ${params.date} - ${params.clientName}

Bonjour ${params.providerName},

Votre intervention pour le client ${params.clientName} s'est achevée il y a plus de 2 heures.

DÉTAILS DE L'INTERVENTION :
- Client : ${params.clientName}
- Prestation : ${safeService}
- Date : ${params.date}
- Horaires : ${params.startTime} - ${params.endTime}

Merci de confirmer l'état de cette intervention en cliquant simplement sur l'un des boutons ci-dessous :

<div style="margin: 25px 0; text-align: center;">
  <a href="${params.doneUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 6px;">
    ✅ FAIT (Prestation Réalisée)
  </a>
  <span style="display: inline-block; width: 12px;"></span>
  <a href="${params.notDoneUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 6px;">
    ❌ PAS FAIT (Non Réalisée)
  </a>
</div>

LIENS DIRECTS DE CONFIRMATION :
👉 Si la prestation a bien été effectuée (FAIT) :
${params.doneUrl}

👉 Si la prestation n'a pas été effectuée (PAS FAIT) :
${params.notDoneUrl}

Merci pour votre rigueur et votre réactivité !

Cordialement,
L'équipe Presta Services Antilles`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Accepte GET (cron pg_net http_get) et POST
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const appBaseUrl = String(Deno.env.get("APP_BASE_URL") || "https://www.prestaservicesantilles.com").replace(/\/+$/, "");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Math.max(Number(body?.limit || 100), 1), 500);
    const dryRun = Boolean(body?.dryRun);

    const nowMs = Date.now();
    // Date du jour en Martinique (UTC-4) pour borner la requête
    const martiniqueToday = new Date(nowMs - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lookbackDate = new Date(nowMs - MAX_LOOKBACK_MS).toISOString().slice(0, 10);

    // Superset : missions récentes dont la demande de confirmation n'a pas encore été envoyée
    const { data: missions, error: missionsError } = await supabase
      .from("missions")
      .select("id,date,start_time,end_time,client_id,client_name,service,provider_id,provider_name,status,completion_check_sent")
      .or("completion_check_sent.is.null,completion_check_sent.eq.false")
      .gte("date", lookbackDate)
      .lte("date", martiniqueToday)
      .order("date", { ascending: false })
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
        // Uniquement les missions NON déclarées terminées et NON annulées
        if (isClosedStatus((m as any).status)) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "mission_closed" });
          continue;
        }

        const date = String((m as any).date || "");
        const startTime = String((m as any).start_time || "").slice(0, 5);
        const endTime = String((m as any).end_time || "").slice(0, 5);
        const clientName = String((m as any).client_name || "Client");
        const service = (m as any).service ?? null;
        const providerId = String((m as any).provider_id || "");
        const providerName = String((m as any).provider_name || "Prestataire");

        if (!date || !endTime || !providerId) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "missing_fields" });
          continue;
        }

        // Heure de fin de mission convertie en UTC (Martinique = UTC-4 fixe)
        const missionEndMs = new Date(`${date}T${endTime}:00${MARTINIQUE_OFFSET}`).getTime();
        if (!Number.isFinite(missionEndMs)) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "invalid_end_time" });
          continue;
        }

        // Envoi uniquement si au moins 2h se sont écoulées depuis la fin de la mission
        if (nowMs - missionEndMs < COMPLETION_CHECK_DELAY_MS) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "delay_not_reached" });
          continue;
        }

        candidates++;

        // Récupérer l'email du prestataire
        const { data: provider } = await supabase
          .from("providers")
          .select("id,email,first_name,last_name")
          .eq("id", providerId)
          .maybeSingle();

        const providerEmail = String((provider as any)?.email || "").trim();
        if (!providerEmail) {
          skipped++;
          results.push({ id: missionId, status: "skipped", reason: "missing_provider_email" });
          continue;
        }

        const fullProviderName = `${String((provider as any)?.first_name || "").trim()} ${String((provider as any)?.last_name || "").trim()}`.trim() || providerName;

        if (!dryRun) {
          // Vérification anti-doublon : la mission a peut-être été validée ou déjà relancée entre temps
          const { data: freshMission } = await supabase
            .from("missions")
            .select("status, completion_check_sent")
            .eq("id", missionId)
            .single();

          if (freshMission?.completion_check_sent) {
            skipped++;
            results.push({ id: missionId, status: "skipped", reason: "already_sent_race_condition" });
            continue;
          }
          if (isClosedStatus(freshMission?.status)) {
            skipped++;
            results.push({ id: missionId, status: "skipped", reason: "mission_closed_race_condition" });
            continue;
          }

          // URLs de validation directe (identiques à celles générées côté front)
          const token = getMissionValidationToken(missionId, date);
          const doneUrl = `${appBaseUrl}/validation-prestation?id=${encodeURIComponent(missionId)}&action=done&token=${token}`;
          const notDoneUrl = `${appBaseUrl}/validation-prestation?id=${encodeURIComponent(missionId)}&action=not_done&token=${token}`;

          const subject = `Confirmation d'intervention du ${date} - ${clientName}`;
          const message = buildCompletionCheckMessage({
            providerName: fullProviderName,
            clientName,
            date,
            startTime,
            endTime,
            service,
            doneUrl,
            notDoneUrl,
          });

          await sendEmailViaEmailJS({ to: providerEmail, subject, message });

          // Marquage : une seule fois par mission, définitif
          await supabase
            .from("missions")
            .update({
              completion_check_sent: true,
              completion_check_sent_at: new Date().toISOString(),
            })
            .eq("id", missionId);

          // Log email
          await supabase.from("email_logs").insert({
            recipient_email: providerEmail,
            subject: `${EMAIL_BRAND_NAME} - ${subject}`,
            template_type: "mission_completion_check",
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          // Notifications (prestataire + admin)
          const nowIso = new Date().toISOString();
          const notifRows = [
            {
              id: crypto.randomUUID(),
              title: "Confirmation d'intervention demandée",
              message: `Merci de confirmer l'intervention chez ${clientName} le ${date} (${startTime} - ${endTime}) via l'email reçu.`,
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
              title: "Email de suivi envoyé au prestataire",
              message: `Demande de confirmation (+2h) envoyée à ${fullProviderName} pour l'intervention du ${date} (${clientName}).`,
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
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
