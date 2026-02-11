import { supabase, isSupabaseConfigured } from '../../utils/supabaseClient';
import type {
  ClientLead,
  CreateClientLeadInput,
  CreateMktCustomerRequestInput,
  CreateMktReferralInput,
  CreateMktReferrerInput,
  MktCustomerRequest,
  MktFilleulStats,
  MktReferrerStats,
  MktFlyer,
  MktPointsLedgerEntry,
  MktPointsSummary,
  MktPromotion,
  MktReferral,
  MktReferrer,
  MktReward,
  MktRewardRule,
} from './types';

export type MktAdminReferrerPerformanceRow = {
  id: string;
  referral_code: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_lambda: boolean | null;
  status: string;
  created_at: string;
  filleuls_total: number;
  paid_invoices_total: number;
  points_earned_total: number;
  points_spent_total: number;
  points_balance: number;
};

export type MktAdminReferrerPerformanceDetails = {
  referrer: MktReferrer;
  stats: {
    filleuls_total: number;
    paid_invoices_total: number;
    points_earned_total: number;
    points_spent_total: number;
    points_balance: number;
  };
  referrals: Array<{
    id: string;
    status: string;
    created_at: string;
    referred_full_name: string | null;
    referred_email: string | null;
    referred_phone: string | null;
    paid_invoices_count: number;
    became_referrer_at: string | null;
  }>;
};

export async function listActiveFlyers(): Promise<MktFlyer[]> {
  if (!isSupabaseConfigured) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('mkt_flyers')
    .select('*')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as any;
}

export async function listPendingClientLeadsByCode(referralCode: string): Promise<ClientLead[]> {
  if (!isSupabaseConfigured) return [];

  const code = String(referralCode || '').trim();
  if (!code) return [];

  try {
    const { data, error } = await supabase.rpc('mkt_list_pending_client_leads_by_code', {
      p_referral_code: code,
    });
    if (!error && data && (data as any).ok === true) {
      const items = (data as any).items;
      if (Array.isArray(items)) return items as any;
      if (typeof items === 'string') {
        try {
          const parsed = JSON.parse(items);
          if (Array.isArray(parsed)) return parsed as any;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  return [];
}

export async function listMyPendingClientLeads(): Promise<ClientLead[]> {
  if (!isSupabaseConfigured) return [];

  // Prefer RPC (security definer) so it works even if client_leads SELECT policies are strict.
  try {
    const { data, error } = await supabase.rpc('mkt_list_my_pending_client_leads');
    if (!error && data && (data as any).ok === true) {
      const items = (data as any).items;
      if (Array.isArray(items)) return items as any;
      if (typeof items === 'string') {
        try {
          const parsed = JSON.parse(items);
          if (Array.isArray(parsed)) return parsed as any;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  // Fallback: direct select when policies allow it.
  const profile = await getMyReferrerProfile();
  const referrerId = String((profile as any)?.id || '').trim();
  if (!referrerId) return [];

  const { data, error } = await supabase
    .from('client_leads')
    .select('*')
    .eq('referrer_id', referrerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as any;
}

export async function createClientLead(input: CreateClientLeadInput): Promise<ClientLead | null> {
  if (!isSupabaseConfigured) return null;

  const referralCode = String(input?.referral_code || '').trim();
  if (referralCode) {
    const { data, error } = await supabase.rpc('mkt_get_referrer_public_by_code', {
      p_referral_code: referralCode,
    });

    if (error) {
      throw new Error(error.message);
    }
    if (data && (data as any).ok === false && (data as any).error === 'blocked') {
      throw new Error('referrer_blocked');
    }
  }

  const payload: any = {
    referral_code: referralCode || null,
    full_name: String(input.full_name || '').trim(),
    email: String(input.email || '').trim(),
    phone: String(input.phone || '').trim() || null,
    service_type: input.service_type ? String(input.service_type).trim() : null,
    address: input.address ? String(input.address).trim() : null,
    city: input.city ? String(input.city).trim() : null,
    status: 'pending',
  };

  // IMPORTANT: public signup uses anon key. Avoid selecting/returning rows here,
  // to prevent requiring SELECT privileges/policies for anon.
  const { error: insertError } = await supabase
    .from('client_leads')
    .insert(payload);

  if (insertError) {
    throw new Error(insertError.message);
  }

  return payload as any;
}

export async function getMyPointsSummary(): Promise<MktPointsSummary | null> {
  if (!isSupabaseConfigured) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  let authUserId = sessionData?.session?.user?.id || null;
  if (!authUserId) {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('presta_current_user') : null;
      const parsed = raw ? JSON.parse(raw) : null;
      authUserId = parsed?.id || null;
    } catch {
      authUserId = null;
    }
  }
  if (!authUserId) return null;

  const { data: referrer, error: referrerError } = await supabase
    .from('mkt_referrers')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (referrerError || !referrer?.id) {
    try {
      const code = typeof window !== 'undefined' ? String(localStorage.getItem('mkt_client_referral_code') || '').trim() : '';
      if (!code) return null;
      const { data, error } = await supabase.rpc('mkt_get_points_summary_by_code', { p_referral_code: code });
      if (error || !data || (data as any).ok !== true) return null;
      return {
        balance: Number((data as any).balance || 0),
        history: Array.isArray((data as any).history) ? ((data as any).history as any) : [],
      } as any;
    } catch {
      return null;
    }
  }

  const { data: rows, error } = await supabase
    .from('mkt_points_ledger')
    .select('*')
    .eq('referrer_id', (referrer as any).id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return null;
  const history = (rows || []) as any as MktPointsLedgerEntry[];
  const balance = history.reduce((sum, r) => sum + Number((r as any).points || 0), 0);
  return { balance, history };
}

export async function getPointsSummaryByCode(referralCode: string): Promise<MktPointsSummary | null> {
  if (!isSupabaseConfigured) return null;
  const code = String(referralCode || '').trim();
  if (!code) return null;

  const { data, error } = await supabase.rpc('mkt_get_points_summary_by_code', {
    p_referral_code: code,
  });

  if (error || !data || (data as any).ok !== true) return null;

  const history = ((data as any).history || []) as MktPointsLedgerEntry[];
  const balance = Number((data as any).balance || 0);
  return { balance, history };
}

export async function getMyFilleulStats(): Promise<MktFilleulStats | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('mkt_get_my_filleul_stats');
  if (error || !data || (data as any).ok !== true) return null;
  return {
    paid_invoices_count: Number((data as any).paid_invoices_count || 0),
    is_referrer: (data as any).is_referrer === true,
  };
}

export async function getMyReferrerStats(): Promise<MktReferrerStats | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.rpc('mkt_get_my_referrer_stats');
    if (!error && data && (data as any).ok === true) {
      return {
        referrals_count: Number((data as any).referrals_count || 0),
        paid_invoices_count: Number((data as any).paid_invoices_count || 0),
      };
    }
  } catch {
    // ignore
  }

  // Fallback: localStorage-based sessions may have no auth.uid(), use public RPC by code.
  try {
    const code = typeof window !== 'undefined' ? String(localStorage.getItem('mkt_client_referral_code') || '').trim() : '';
    if (!code) return null;
    const { data, error } = await supabase.rpc('mkt_get_referrer_stats_by_code', { p_referral_code: code });
    if (error || !data || (data as any).ok !== true) return null;
    return {
      referrals_count: Number((data as any).referrals_count || 0),
      paid_invoices_count: Number((data as any).paid_invoices_count || 0),
    };
  } catch {
    return null;
  }
}

export async function listMyReferrals(): Promise<MktReferral[]> {
  if (!isSupabaseConfigured) return [];
  const profile = await getMyReferrerProfile();
  const referrerId = String((profile as any)?.id || '').trim();
  if (!referrerId) return [];

  const { data, error } = await supabase
    .from('mkt_referrals')
    .select('*')
    .eq('referrer_id', referrerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as any;
}

export async function getFlyerById(id: string): Promise<MktFlyer | null> {
  if (!isSupabaseConfigured) return null;
  const flyerId = String(id || '').trim();
  if (!flyerId) return null;

  const { data, error } = await supabase
    .from('mkt_flyers')
    .select('*')
    .eq('id', flyerId)
    .maybeSingle();

  if (error || !data) return null;
  return data as any;
}

export async function getMyReferrerProfile(): Promise<MktReferrer | null> {
  if (!isSupabaseConfigured) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  let authUserId = sessionData?.session?.user?.id || null;
  if (!authUserId) {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('presta_current_user') : null;
      const parsed = raw ? JSON.parse(raw) : null;
      authUserId = parsed?.id || null;
    } catch {
      authUserId = null;
    }
  }
  if (!authUserId) return null;

  const { data, error } = await supabase
    .from('mkt_referrers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (!error && data) return data as any;

  // Fallback: legacy rows may exist without auth_user_id (created before fix).
  // Try linking using local referral code, then re-query.
  try {
    const code = (typeof window !== 'undefined' && (window as any)?.localStorage)
      ? String(localStorage.getItem('mkt_client_referral_code') || '').trim()
      : '';
    if (code) {
      await supabase.rpc('mkt_link_my_referrer_profile', {
        p_referral_code: code,
      });
    } else {
      await supabase.rpc('mkt_link_my_referrer_profile', {
        p_referral_code: null,
      });
    }
  } catch {
    // ignore
  }

  const { data: data2, error: error2 } = await supabase
    .from('mkt_referrers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (!error2 && data2) return data2 as any;

  // Final fallback: local client fallback login uses clientId as currentUser.id.
  // Use stored referral code to fetch public profile.
  try {
    const code = typeof window !== 'undefined' ? String(localStorage.getItem('mkt_client_referral_code') || '').trim() : '';
    if (code) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('mkt_get_referrer_public_profile_by_code', {
        p_referral_code: code,
      });
      if (!rpcErr && rpcData && (rpcData as any).ok === true) {
        return ((rpcData as any).referrer || null) as any;
      }
    }

    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('presta_current_user') : null;
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    const email = String(parsedUser?.email || '').trim() || null;
    const phone = null;
    const { data: rpcData2, error: rpcErr2 } = await supabase.rpc('mkt_get_referrer_public_profile_by_contact', {
      p_email: email,
      p_phone: phone,
    });
    if (rpcErr2 || !rpcData2 || (rpcData2 as any).ok !== true) return null;
    return ((rpcData2 as any).referrer || null) as any;
  } catch {
    return null;
  }
}

export async function listActivePromotions(): Promise<MktPromotion[]> {
  if (!isSupabaseConfigured) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('mkt_promotions')
    .select('*')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as any;
}

export async function createCustomerRequest(input: CreateMktCustomerRequestInput): Promise<MktCustomerRequest | null> {
  if (!isSupabaseConfigured) return null;

  const payload = {
    full_name: String(input.full_name || '').trim(),
    email: input.email ?? null,
    phone: input.phone ?? null,
    message: input.message ?? null,
    source_flyer_id: input.source_flyer_id ?? null,
    source_promotion_id: input.source_promotion_id ?? null,
    referral_code: input.referral_code ?? null,
  };

  const { data, error } = await supabase
    .from('mkt_customer_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) return null;
  return data as any;
}

export async function createReferrerLead(input: CreateMktReferrerInput): Promise<MktReferrer | null> {
  if (!isSupabaseConfigured) return null;

  const payload = {
    referral_code: String(input.referral_code || '').trim(),
    full_name: input.full_name ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    auth_user_id: input.auth_user_id ?? null,
    is_lambda: input.is_lambda ?? null,
    pack_ultime6_threshold: input.pack_ultime6_threshold ?? null,
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const isAuthenticated = !!sessionData?.session?.user;
  const authUserId = sessionData?.session?.user?.id || null;

  if (!isAuthenticated) {
    const { error } = await supabase.from('mkt_referrers').insert(payload);
    if (error) return null;
    return payload as any;
  }

  // Enforce: 1 referrer profile per authenticated user
  if (authUserId) {
    const { data: existing, error: existingError } = await supabase
      .from('mkt_referrers')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (!existingError && existing) {
      return existing as any;
    }
  }

  // Force auth_user_id to the real Supabase auth uid (not app user id)
  (payload as any).auth_user_id = authUserId;

  const { data, error } = await supabase
    .from('mkt_referrers')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) return null;
  return data as any;
}

export async function createReferral(input: CreateMktReferralInput): Promise<MktReferral | null> {
  if (!isSupabaseConfigured) return null;

  const referralCode = String(input.referral_code || '').trim();
  if (!referralCode) return null;

  const { data: referrer, error: referrerError } = await supabase
    .from('mkt_referrers')
    .select('*')
    .ilike('referral_code', referralCode)
    .maybeSingle();

  if (referrerError || !referrer) return null;

  const payload = {
    referrer_id: (referrer as any).id,
    referral_code: (referrer as any).referral_code,
    referred_full_name: input.referred_full_name ?? null,
    referred_email: input.referred_email ?? null,
    referred_phone: input.referred_phone ?? null,
    source_request_id: input.source_request_id ?? null,
  };

  const { data, error } = await supabase
    .from('mkt_referrals')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) return null;
  return data as any;
}

export async function listActiveRewards(): Promise<MktReward[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('mkt_rewards')
    .select('*')
    .eq('is_active', true)
    .order('points_cost', { ascending: true });

  if (error || !data) return [];
  return data as any;
}

export async function listAllRewardsAdmin(): Promise<MktReward[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('mkt_rewards')
    .select('*')
    .order('points_cost', { ascending: true });

  if (error || !data) return [];
  return data as any;
}

export async function upsertRewardAdmin(input: Partial<MktReward> & { name: string }): Promise<MktReward | null> {
  if (!isSupabaseConfigured) return null;
  const payload: any = {
    name: String(input.name || '').trim(),
    description: input.description ?? null,
    points_cost: Number(input.points_cost ?? 0),
    is_active: input.is_active ?? true,
  };

  if (!payload.name) return null;

  const q = input.id
    ? supabase.from('mkt_rewards').update(payload).eq('id', input.id).select('*').single()
    : supabase.from('mkt_rewards').insert(payload).select('*').single();

  const { data, error } = await q;
  if (error || !data) return null;
  return data as any;
}

export async function deleteRewardAdmin(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const rid = String(id || '').trim();
  if (!rid) return false;
  const { error } = await supabase.from('mkt_rewards').delete().eq('id', rid);
  return !error;
}

export async function listRewardRulesAdmin(): Promise<MktRewardRule[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('mkt_reward_rules')
    .select('*')
    .order('points_threshold', { ascending: true });

  if (error || !data) return [];
  return data as any;
}

export async function upsertRewardRuleAdmin(input: Partial<MktRewardRule> & { reward_id: string; points_threshold: number }): Promise<MktRewardRule | null> {
  if (!isSupabaseConfigured) return null;
  const payload: any = {
    reward_id: input.reward_id,
    points_threshold: Number(input.points_threshold),
    applies_to: input.applies_to ?? 'all',
    is_active: input.is_active ?? true,
    note: input.note ?? null,
  };

  if (!payload.reward_id || !payload.points_threshold || payload.points_threshold <= 0) return null;

  const q = input.id
    ? supabase.from('mkt_reward_rules').update(payload).eq('id', input.id).select('*').single()
    : supabase.from('mkt_reward_rules').insert(payload).select('*').single();

  const { data, error } = await q;
  if (error || !data) return null;
  return data as any;
}

export async function deleteRewardRuleAdmin(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const rid = String(id || '').trim();
  if (!rid) return false;
  const { error } = await supabase.from('mkt_reward_rules').delete().eq('id', rid);
  return !error;
}

export async function findReferrerByCodeAdmin(code: string): Promise<MktReferrer | null> {
  if (!isSupabaseConfigured) return null;
  const c = String(code || '').trim();
  if (!c) return null;
  const { data, error } = await supabase
    .from('mkt_referrers')
    .select('*')
    .ilike('referral_code', c)
    .maybeSingle();

  if (error || !data) return null;
  return data as any;
}

export async function getReferrerBalanceAdmin(referrerId: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  const id = String(referrerId || '').trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from('mkt_points_ledger')
    .select('points')
    .eq('referrer_id', id);

  if (error) return null;
  return (data || []).reduce((sum: number, r: any) => sum + Number(r?.points || 0), 0);
}

export async function adminAdjustReferrerPoints(referrerId: string, points: number, note?: string): Promise<{ ok: boolean; before_balance?: number; after_balance?: number } | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('mkt_admin_adjust_referrer_points', {
    p_referrer_id: referrerId,
    p_points: Number(points),
    p_note: note ?? null,
  });
  if (error || !data) return null;
  return data as any;
}

export async function adminGrantReward(referrerId: string, rewardId: string, pointsCostOverride: number | null, note?: string): Promise<{ ok: boolean; redemption_id?: string; before_balance?: number; after_balance?: number } | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('mkt_admin_grant_reward', {
    p_referrer_id: referrerId,
    p_reward_id: rewardId,
    p_points_cost: pointsCostOverride === null || pointsCostOverride === undefined ? null : Number(pointsCostOverride),
    p_note: note ?? null,
  });
  if (error || !data) return null;
  return data as any;
}

export async function adminListReferrersPerformance(filters?: {
  search?: string;
  is_lambda?: boolean;
  status?: string;
  min_filleuls?: number;
  min_points_earned?: number;
}): Promise<MktAdminReferrerPerformanceRow[]> {
  if (!isSupabaseConfigured) return [];
  const f = filters || {};
  const { data, error } = await supabase.rpc('mkt_admin_list_referrers_performance', {
    p_search: f.search ?? null,
    p_is_lambda: typeof f.is_lambda === 'boolean' ? f.is_lambda : null,
    p_status: f.status ?? null,
    p_min_filleuls: typeof f.min_filleuls === 'number' ? Math.floor(f.min_filleuls) : null,
    p_min_points_earned: typeof f.min_points_earned === 'number' ? Math.floor(f.min_points_earned) : null,
  });

  if (error || !data || (data as any).ok !== true) return [];
  return (((data as any).items || []) as any[]) as MktAdminReferrerPerformanceRow[];
}

export async function adminGetReferrerPerformance(referrerId: string): Promise<MktAdminReferrerPerformanceDetails | null> {
  if (!isSupabaseConfigured) return null;
  const rid = String(referrerId || '').trim();
  if (!rid) return null;
  const { data, error } = await supabase.rpc('mkt_admin_get_referrer_performance', {
    p_referrer_id: rid,
  });
  if (error || !data || (data as any).ok !== true) return null;
  return {
    referrer: (data as any).referrer as MktReferrer,
    stats: (data as any).stats as any,
    referrals: ((data as any).referrals || []) as any,
  };
}
