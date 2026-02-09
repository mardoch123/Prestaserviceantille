import { supabase, isSupabaseConfigured } from '../../utils/supabaseClient';
import type { CreateMktReferralInput, MktReferral } from './types';

export async function createReferralValidated(input: CreateMktReferralInput): Promise<MktReferral | null> {
  if (!isSupabaseConfigured) return null;

  const referralCode = String(input.referral_code || '').trim();
  if (!referralCode) return null;

  const { data: resolved, error: resolvedError } = await supabase.rpc('mkt_get_referrer_public_by_code', {
    p_referral_code: referralCode,
  });

  if (resolvedError || !resolved || (resolved as any).ok !== true) {
    const err = String((resolved as any)?.error || '').trim();
    if (err === 'blocked') {
      throw new Error('referrer_blocked');
    }
    return null;
  }

  const referrerId = String((resolved as any).referrer_id || '').trim();
  const normalizedCode = String((resolved as any).referral_code || '').trim();
  if (!referrerId || !normalizedCode) return null;

  const payload = {
    referrer_id: referrerId,
    referral_code: normalizedCode,
    referred_full_name: input.referred_full_name ?? null,
    referred_email: input.referred_email ?? null,
    referred_phone: input.referred_phone ?? null,
    referred_client_id: input.referred_client_id ?? null,
    source_request_id: input.source_request_id ?? null,
    status: 'validated',
  };

  const { data, error } = await supabase
    .from('mkt_referrals')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) return null;
  return data as any;
}
