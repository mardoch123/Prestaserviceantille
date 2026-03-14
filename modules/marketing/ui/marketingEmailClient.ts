import { supabase, isSupabaseConfigured } from '../../../utils/supabaseClient';

export interface MarketingCampaign {
  id: string;
  type: 'manual' | 'auto_new_pack' | 'auto_no_mission' | 'auto_post_mission';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  name: string;
  subject: string;
  html_content: string;
  text_content?: string;
  trigger_condition?: any;
  last_run_at?: string;
  next_run_at?: string;
  target_all_clients: boolean;
  target_min_days_since_registration?: number;
  target_max_days_since_registration?: number;
  target_specific_client_ids?: string[];
  target_has_missions?: boolean;
  target_mission_status?: string[];
  target_min_days_since_last_mission?: number;
  target_max_days_since_last_mission?: number;
  related_pack_id?: string;
  scheduled_at?: string;
  sent_at?: string;
  sent_count: number;
  failed_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketingEmailLog {
  id: string;
  campaign_id?: string;
  client_id?: string;
  client_email: string;
  client_name?: string;
  subject: string;
  html_content: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
  error_message?: string;
  created_at: string;
}

export interface TargetClient {
  client_id: string;
  client_email: string;
  client_name: string;
  user_id?: string;
  registration_date: string;
  has_missions: boolean;
  last_mission_date?: string;
  days_since_registration: number;
  days_since_last_mission?: number;
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  html_content: string;
  text_content?: string;
  target_all_clients: boolean;
  target_min_days_since_registration?: number;
  target_max_days_since_registration?: number;
  target_specific_client_ids?: string[];
  target_has_missions?: boolean;
  target_mission_status?: string[];
  target_min_days_since_last_mission?: number;
  target_max_days_since_last_mission?: number;
  scheduled_at?: string;
}

// Get all marketing campaigns
export async function getMarketingCampaigns(): Promise<{ data: MarketingCampaign[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'supabase_not_configured' };

  try {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (e: any) {
    return { data: [], error: e.message || 'Failed to fetch campaigns' };
  }
}

// Get a single campaign with its email logs
export async function getCampaignWithLogs(campaignId: string): Promise<{ campaign: MarketingCampaign | null; logs: MarketingEmailLog[]; error: string | null }> {
  if (!isSupabaseConfigured) return { campaign: null, logs: [], error: 'supabase_not_configured' };

  try {
    const [campaignRes, logsRes] = await Promise.all([
      supabase.from('marketing_campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('marketing_email_logs').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    ]);

    if (campaignRes.error) throw campaignRes.error;
    return {
      campaign: campaignRes.data,
      logs: logsRes.data || [],
      error: null
    };
  } catch (e: any) {
    return { campaign: null, logs: [], error: e.message || 'Failed to fetch campaign' };
  }
}

// Get all email logs (history)
export async function getEmailLogs(limit: number = 100): Promise<{ data: MarketingEmailLog[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'supabase_not_configured' };

  try {
    const { data, error } = await supabase
      .from('marketing_email_logs')
      .select('*, marketing_campaigns(name, type)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (e: any) {
    return { data: [], error: e.message || 'Failed to fetch email logs' };
  }
}

// Get target clients for a campaign
export async function getTargetClients(filters: {
  target_all_clients?: boolean;
  target_min_days_since_registration?: number;
  target_max_days_since_registration?: number;
  target_specific_client_ids?: string[];
  target_has_missions?: boolean;
  target_mission_status?: string[];
  target_min_days_since_last_mission?: number;
  target_max_days_since_last_mission?: number;
}): Promise<{ data: TargetClient[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'supabase_not_configured' };

  try {
    const { data, error } = await supabase.rpc('marketing_get_target_clients', {
      p_target_all_clients: filters.target_all_clients ?? false,
      p_target_min_days_since_registration: filters.target_min_days_since_registration ?? null,
      p_target_max_days_since_registration: filters.target_max_days_since_registration ?? null,
      p_target_specific_client_ids: filters.target_specific_client_ids ?? null,
      p_target_has_missions: filters.target_has_missions ?? null,
      p_target_mission_status: filters.target_mission_status ?? null,
      p_target_min_days_since_last_mission: filters.target_min_days_since_last_mission ?? null,
      p_target_max_days_since_last_mission: filters.target_max_days_since_last_mission ?? null
    });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (e: any) {
    return { data: [], error: e.message || 'Failed to fetch target clients' };
  }
}

// Create a new manual campaign
export async function createManualCampaign(input: CreateCampaignInput): Promise<{ campaignId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { campaignId: null, error: 'supabase_not_configured' };

  try {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert({
        type: 'manual',
        status: 'draft',
        name: input.name,
        subject: input.subject,
        html_content: input.html_content,
        text_content: input.text_content,
        target_all_clients: input.target_all_clients,
        target_min_days_since_registration: input.target_min_days_since_registration,
        target_max_days_since_registration: input.target_max_days_since_registration,
        target_specific_client_ids: input.target_specific_client_ids,
        target_has_missions: input.target_has_missions,
        target_mission_status: input.target_mission_status,
        target_min_days_since_last_mission: input.target_min_days_since_last_mission,
        target_max_days_since_last_mission: input.target_max_days_since_last_mission,
        scheduled_at: input.scheduled_at
      })
      .select('id')
      .single();

    if (error) throw error;
    return { campaignId: data?.id || null, error: null };
  } catch (e: any) {
    return { campaignId: null, error: e.message || 'Failed to create campaign' };
  }
}

// Send a campaign immediately
export async function sendCampaign(campaignId: string): Promise<{ success: boolean; targetCount: number; error: string | null }> {
  if (!isSupabaseConfigured) return { success: false, targetCount: 0, error: 'supabase_not_configured' };

  try {
    const { data, error } = await supabase.rpc('marketing_send_campaign', {
      p_campaign_id: campaignId
    });

    if (error) throw error;
    return {
      success: data?.ok || false,
      targetCount: data?.target_count || 0,
      error: data?.error || null
    };
  } catch (e: any) {
    return { success: false, targetCount: 0, error: e.message || 'Failed to send campaign' };
  }
}

// Create campaign for new pack (auto campaign)
export async function createPackCampaign(
  packId: string,
  packName: string,
  packDescription: string,
  packPrice: number
): Promise<{ campaignId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { campaignId: null, error: 'supabase_not_configured' };

  try {
    const { data, error } = await supabase.rpc('marketing_create_pack_campaign', {
      p_pack_id: packId,
      p_pack_name: packName,
      p_pack_description: packDescription,
      p_pack_price: packPrice,
      p_created_by: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) throw error;
    return { campaignId: data || null, error: null };
  } catch (e: any) {
    return { campaignId: null, error: e.message || 'Failed to create pack campaign' };
  }
}

// Check if menu badge should be shown
export async function shouldShowBadge(menuItemKey: string): Promise<{ show: boolean; error: string | null }> {
  if (!isSupabaseConfigured) return { show: false, error: null };

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { show: false, error: null };

    const { data, error } = await supabase.rpc('marketing_should_show_badge', {
      p_menu_item_key: menuItemKey,
      p_user_id: userData.user.id
    });

    if (error) throw error;
    return { show: data || false, error: null };
  } catch (e: any) {
    return { show: false, error: e.message };
  }
}

// Dismiss menu badge
export async function dismissBadge(menuItemKey: string): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) return { success: false, error: 'supabase_not_configured' };

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { success: false, error: 'not_authenticated' };

    const { data, error } = await supabase.rpc('marketing_dismiss_badge', {
      p_menu_item_key: menuItemKey,
      p_user_id: userData.user.id
    });

    if (error) throw error;
    return { success: data || false, error: null };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to dismiss badge' };
  }
}

// Delete a campaign (only if draft)
export async function deleteCampaign(campaignId: string): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) return { success: false, error: 'supabase_not_configured' };

  try {
    const { error } = await supabase
      .from('marketing_campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('status', 'draft');

    if (error) throw error;
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to delete campaign' };
  }
}
