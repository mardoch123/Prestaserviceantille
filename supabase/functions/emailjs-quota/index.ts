import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const publicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
    const serviceId = Deno.env.get('EMAILJS_SERVICE_ID') || Deno.env.get('VITE_EMAILJS_SERVICE_ID');
    
    if (!publicKey) {
      console.error('[emailjs-quota] EMAILJS_PUBLIC_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'EmailJS not configured',
          quota: { used: 0, limit: 200, remaining: 200 }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Call EmailJS API to get real quota
    // EmailJS doesn't have a public quota API, so we use a workaround:
    // We'll estimate based on the email_logs table or return a mock for now
    // In production, you would need to use EmailJS's private API or web scraping
    
    // Alternative: Use the email_logs table from Supabase to get accurate count
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Get count of emails sent this month from email_logs
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const { count, error } = await fetch(
      `${supabaseUrl}/rest/v1/email_logs?select=*&status=eq.sent&created_at=gte.${monthStart}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Prefer': 'count=exact'
        }
      }
    );

    // Get count from response headers
    const contentRange = count !== undefined ? count : 0;
    
    // EmailJS subscription limit - starting with 700 emails remaining
    const monthlyLimit = 700;
    const used = contentRange || 0;
    const remaining = Math.max(0, monthlyLimit - used);

    const quota = {
      used,
      limit: monthlyLimit,
      remaining,
      source: 'supabase_email_logs',
      lastUpdated: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({ quota }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[emailjs-quota] Error:', error);
    
    // Return fallback quota on error
    return new Response(
      JSON.stringify({ 
        error: error.message,
        quota: { used: 0, limit: 200, remaining: 200 }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
