// API Endpoint pour récupérer le quota EmailJS en temps réel
// Utilise la table email_logs pour un comptage précis des emails envoyés

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get current month's start date
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Count emails sent this month from email_logs
    const { count: sentCount, error: sentError } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .eq('status', 'sent');

    if (sentError) {
      console.error('[emailjs-quota] Error counting sent emails:', sentError);
    }

    // Count failed emails this month
    const { count: failedCount, error: failedError } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .eq('status', 'failed');

    if (failedError) {
      console.error('[emailjs-quota] Error counting failed emails:', failedError);
    }

    // EmailJS subscription limit - starting with 700 emails remaining
    const monthlyLimit = 700;
    const used = sentCount || 0;
    const failed = failedCount || 0;
    const remaining = Math.max(0, monthlyLimit - used);
    const percentUsed = Math.round((used / monthlyLimit) * 100);

    // Calculate daily average and estimate days remaining
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyAverage = dayOfMonth > 1 ? used / dayOfMonth : used;
    const projectedUsage = Math.round(dailyAverage * daysInMonth);
    const estimatedOverage = projectedUsage > monthlyLimit ? projectedUsage - monthlyLimit : 0;

    const quota = {
      used,
      failed,
      limit: monthlyLimit,
      remaining,
      percentUsed,
      projectedUsage,
      estimatedOverage,
      dailyAverage: Math.round(dailyAverage * 10) / 10,
      currentMonth: now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
      period: {
        start: monthStart,
        end: monthEnd
      },
      source: 'email_logs',
      lastUpdated: new Date().toISOString()
    };

    // Return the quota data
    return res.status(200).json({ 
      success: true, 
      quota,
      message: 'Quota retrieved successfully'
    });

  } catch (error) {
    console.error('[emailjs-quota] Error:', error);
    
    // Return fallback data on error
    return res.status(200).json({
      success: false,
      error: error.message,
      quota: {
        used: 0,
        failed: 0,
        limit: 700,
        remaining: 700,
        percentUsed: 0,
        projectedUsage: 0,
        estimatedOverage: 0,
        dailyAverage: 0,
        currentMonth: new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
        source: 'fallback',
        lastUpdated: new Date().toISOString()
      }
    });
  }
}
