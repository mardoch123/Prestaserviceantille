export type MktCustomerRequestStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'closed' | 'spam';

export type MktDiscountType = 'percentage' | 'fixed';

export type MktFlyer = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  normal_price: number | null;
  promo_price: number | null;
  observations: string | null;
  is_featured?: boolean | null;
  featured_rank?: number | null;
  target_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MktPromotion = {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  discount_type: MktDiscountType | null;
  discount_value: number | null;
  service_type: string | null;
  pack_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateMktCustomerRequestInput = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  source_flyer_id?: string | null;
  source_promotion_id?: string | null;
  referral_code?: string | null;
};

export type CreateClientLeadInput = {
  referral_code?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  service_type?: string | null;
  address?: string | null;
  city?: string | null;
};

export type ClientLeadStatus = 'pending' | 'validated' | 'rejected' | 'blocked';

export type ClientLead = {
  id: string;
  referral_code: string | null;
  referrer_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  service_type: string | null;
  address?: string | null;
  city?: string | null;
  status: ClientLeadStatus;
  note: string | null;
  created_client_id: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MktCustomerRequest = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  source_flyer_id: string | null;
  source_promotion_id: string | null;
  referral_code: string | null;
  status: MktCustomerRequestStatus;
  created_at: string;
  updated_at: string;
};

export type CreateMktReferrerInput = {
  referral_code: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  auth_user_id?: string | null;
  is_lambda?: boolean | null;
  pack_ultime6_threshold?: number | null;
};

export type MktReferrerStatus = 'active' | 'blocked';

export type MktReferrer = {
  id: string;
  referral_code: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  auth_user_id: string | null;
  is_lambda?: boolean | null;
  pack_ultime6_threshold?: number | null;
  pack_ultime6_earned_count?: number | null;
  status: MktReferrerStatus;
  created_at: string;
  updated_at: string;
};

export type MktReferralStatus = 'pending' | 'validated' | 'rewarded' | 'rejected' | 'blocked';

export type CreateMktReferralInput = {
  referral_code: string;
  referred_full_name?: string | null;
  referred_email?: string | null;
  referred_phone?: string | null;
  referred_client_id?: string | null;
  source_request_id?: string | null;
};

export type MktReferral = {
  id: string;
  referrer_id: string;
  referral_code: string;
  referred_full_name: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  referred_client_id?: string | null;
  source_request_id: string | null;
  status: MktReferralStatus;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type MktPointsLedgerEntry = {
  id: string;
  referrer_id: string;
  points: number;
  reason: 'mission_completed' | 'invoice_paid' | 'manual_adjustment' | 'reward_redemption';
  related_type: string | null;
  related_id: string | null;
  source_referral_id?: string | null;
  source_document_id?: string | null;
  created_by: string | null;
  created_at: string;
};

export type MktPointsSummary = {
  balance: number;
  history: MktPointsLedgerEntry[];
};

export type MktFilleulStats = {
  paid_invoices_count: number;
  is_referrer: boolean;
};

export type MktReferrerStats = {
  referrals_count: number;
  paid_invoices_count: number;
};

export type MktReward = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MktRewardRuleAppliesTo = 'all' | 'normal' | 'lambda';

export type MktRewardRule = {
  id: string;
  reward_id: string;
  points_threshold: number;
  applies_to: MktRewardRuleAppliesTo;
  is_active: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MktRedemptionStatus = 'requested' | 'approved' | 'delivered' | 'cancelled';

export type MktRewardRedemption = {
  id: string;
  reward_id: string;
  referrer_id: string;
  points_cost: number;
  status: MktRedemptionStatus;
  requested_note: string | null;
  approved_by: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};
