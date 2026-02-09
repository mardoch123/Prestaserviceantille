import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
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
    const url = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit || 25), 1), 100);

    const { data: rows, error } = await supabase
      .from("mkt_notification_outbox")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const row of rows || []) {
      try {
        if (row.channel !== "email") {
          await supabase
            .from("mkt_notification_outbox")
            .update({ status: "failed", last_error: `Unsupported channel: ${row.channel}` })
            .eq("id", row.id);
          failed++;
          continue;
        }

        const to = String(row.to_email || "");
        if (!to) {
          await supabase
            .from("mkt_notification_outbox")
            .update({ status: "failed", last_error: "Missing to_email" })
            .eq("id", row.id);
          failed++;
          continue;
        }

        const subject = String(row.title || "Notification");
        const template = String(row.template || "");
        const context = row.data || {};

        const { error: sendError } = await supabase.functions.invoke("send-email", {
          body: {
            to,
            subject,
            template,
            context,
          },
        });

        if (sendError) {
          await supabase
            .from("mkt_notification_outbox")
            .update({ status: "failed", last_error: String(sendError.message || sendError) })
            .eq("id", row.id);
          failed++;
          continue;
        }

        await supabase
          .from("mkt_notification_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
        sent++;
      } catch (e) {
        await supabase
          .from("mkt_notification_outbox")
          .update({ status: "failed", last_error: String((e as any)?.message || e) })
          .eq("id", row.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: (rows || []).length, sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
