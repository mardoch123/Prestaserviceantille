import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Client {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

interface Mission {
  id: string;
  client_id: string;
  date: string;
  status: string;
}

// Edge Function: Automated Marketing Campaigns
// This function runs on a schedule (e.g., daily) to send automated marketing emails

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      noMissionReminders: 0,
      postMissionReminders: 0,
      errors: [] as string[]
    };

    // ===== 1. NO MISSION REMINDERS (Clients registered > 3 days with no missions) =====
    try {
      const { data: noMissionClients, error: noMissionError } = await supabase.rpc('marketing_get_target_clients', {
        p_target_all_clients: false,
        p_target_min_days_since_registration: 3,
        p_target_has_missions: false,
        p_target_mission_status: null,
        p_target_specific_client_ids: null,
        p_target_max_days_since_registration: null,
        p_target_min_days_since_last_mission: null,
        p_target_max_days_since_last_mission: null
      });

      if (noMissionError) throw noMissionError;

      if (noMissionClients && noMissionClients.length > 0) {
        // Create campaign for no-mission reminder
        const campaignName = `Rappel sans mission - ${new Date().toISOString().split('T')[0]}`;
        const subject = 'Vos services d\'entretien vous attendent !';
        
        const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0f766e;">Nos packs vous attendent !</h2>
  <p>Bonjour,</p>
  <p>Nous avons remarqué que vous êtes inscrit chez Presta Services Antilles depuis quelques jours, mais vous n'avez pas encore profité de nos services.</p>
  <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #b45309;">Pourquoi choisir nos services ?</h3>
    <ul style="margin-bottom: 0;">
      <li>Ménage régulier ou ponctuel</li>
      <li>Entretien de vos espaces extérieurs</li>
      <li>Services à la personne</li>
      <li>Et bien plus encore !</li>
    </ul>
  </div>
  <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Découvrir nos offres</a>
  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
    Presta Services Antilles - Simplifiez votre quotidien<br>
    📞 0696 06 15 94 | 📧 prestaservicesantilles@gmail.com
  </p>
</div>`;

        // Create the campaign
        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .insert({
            type: 'auto_no_mission',
            status: 'sending',
            name: campaignName,
            subject: subject,
            html_content: htmlContent,
            target_all_clients: false,
            target_min_days_since_registration: 3,
            target_has_missions: false,
            sent_count: noMissionClients.length
          })
          .select('id')
          .single();

        if (campaignError) throw campaignError;

        // Insert pending email logs
        const emailLogs = noMissionClients.map((client: any) => ({
          campaign_id: campaign.id,
          client_id: client.client_id,
          client_email: client.client_email,
          client_name: client.client_name,
          subject: subject,
          html_content: htmlContent,
          status: 'pending'
        }));

        const { error: logsError } = await supabase
          .from('marketing_email_logs')
          .insert(emailLogs);

        if (logsError) throw logsError;

        // Mark campaign as sent
        await supabase
          .from('marketing_campaigns')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', campaign.id);

        results.noMissionReminders = noMissionClients.length;
      }
    } catch (e: any) {
      results.errors.push(`No-mission reminder failed: ${e.message}`);
    }

    // ===== 2. POST-MISSION REMINDERS (Clients with completed missions > 15 days ago) =====
    try {
      const { data: postMissionClients, error: postMissionError } = await supabase.rpc('marketing_get_target_clients', {
        p_target_all_clients: false,
        p_target_min_days_since_registration: null,
        p_target_has_missions: true,
        p_target_mission_status: ['completed'],
        p_target_specific_client_ids: null,
        p_target_max_days_since_registration: null,
        p_target_min_days_since_last_mission: 15,
        p_target_max_days_since_last_mission: 60 // Don't send to clients with missions older than 60 days
      });

      if (postMissionError) throw postMissionError;

      if (postMissionClients && postMissionClients.length > 0) {
        // Create campaign for post-mission reminder
        const campaignName = `Rappel post-mission - ${new Date().toISOString().split('T')[0]}`;
        const subject = 'De nouveaux packs pourraient vous intéresser !';
        
        const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0f766e;">Découvrez nos nouveaux packs !</h2>
  <p>Bonjour,</p>
  <p>Nous espérons que votre dernière prestation avec Presta Services Antilles s'est bien déroulée !</p>
  <p>🎉 Depuis votre dernière mission, nous avons enrichi notre catalogue avec de nouveaux packs qui pourraient vous intéresser.</p>
  <div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #115e59;">✨ Pourquoi ne pas découvrir ce que nous avons de nouveau ?</h3>
    <p style="margin-bottom: 0;">Nos nouveaux packs sont conçus pour répondre à tous vos besoins d'entretien et de services à la personne.</p>
  </div>
  <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Voir nos offres actuelles</a>
  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
    Presta Services Antilles - Simplifiez votre quotidien<br>
    📞 0696 06 15 94 | 📧 prestaservicesantilles@gmail.com
  </p>
</div>`;

        // Create the campaign
        const { data: campaign, error: campaignError } = await supabase
          .from('marketing_campaigns')
          .insert({
            type: 'auto_post_mission',
            status: 'sending',
            name: campaignName,
            subject: subject,
            html_content: htmlContent,
            target_all_clients: false,
            target_has_missions: true,
            target_mission_status: ['completed'],
            target_min_days_since_last_mission: 15,
            target_max_days_since_last_mission: 60,
            sent_count: postMissionClients.length
          })
          .select('id')
          .single();

        if (campaignError) throw campaignError;

        // Insert pending email logs
        const emailLogs = postMissionClients.map((client: any) => ({
          campaign_id: campaign.id,
          client_id: client.client_id,
          client_email: client.client_email,
          client_name: client.client_name,
          subject: subject,
          html_content: htmlContent,
          status: 'pending'
        }));

        const { error: logsError } = await supabase
          .from('marketing_email_logs')
          .insert(emailLogs);

        if (logsError) throw logsError;

        // Mark campaign as sent
        await supabase
          .from('marketing_campaigns')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', campaign.id);

        results.postMissionReminders = postMissionClients.length;
      }
    } catch (e: any) {
      results.errors.push(`Post-mission reminder failed: ${e.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
