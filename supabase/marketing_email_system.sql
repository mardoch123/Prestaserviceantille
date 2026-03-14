-- Marketing Email System
-- Tables and functions for automated and manual marketing emails

-- Types
DO $$ BEGIN
  CREATE TYPE marketing_campaign_type AS ENUM ('manual', 'auto_new_pack', 'auto_no_mission', 'auto_post_mission');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE marketing_campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE marketing_email_status AS ENUM ('pending', 'sent', 'failed', 'bounced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION public.marketing_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Table: Marketing Campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type marketing_campaign_type NOT NULL DEFAULT 'manual',
  status marketing_campaign_status NOT NULL DEFAULT 'draft',
  
  -- Campaign details
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  
  -- For automated campaigns
  trigger_condition JSONB, -- stores conditions for auto-triggering
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  -- Targeting
  target_all_clients BOOLEAN NOT NULL DEFAULT false,
  target_min_days_since_registration INTEGER, -- e.g., 3 days for no-mission reminder
  target_max_days_since_registration INTEGER,
  target_specific_client_ids UUID[], -- for manual selection
  target_has_missions BOOLEAN, -- true/false/null for mission-based targeting
  target_mission_status TEXT[], -- ['completed', 'planned'] etc.
  target_min_days_since_last_mission INTEGER, -- e.g., 15 days for post-mission
  target_max_days_since_last_mission INTEGER,
  
  -- For new pack campaigns
  related_pack_id UUID REFERENCES public.packs(id) ON DELETE SET NULL,
  
  -- Send options
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS marketing_campaigns_status_idx ON public.marketing_campaigns (status, scheduled_at);
CREATE INDEX IF NOT EXISTS marketing_campaigns_type_idx ON public.marketing_campaigns (type, status);
CREATE INDEX IF NOT EXISTS marketing_campaigns_pack_idx ON public.marketing_campaigns (related_pack_id) WHERE related_pack_id IS NOT NULL;

CREATE TRIGGER marketing_campaigns_set_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.marketing_set_updated_at();

-- Table: Marketing Email Logs (history of sent emails)
CREATE TABLE IF NOT EXISTS public.marketing_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  
  -- Recipient
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  
  -- Email content (snapshot at send time)
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  
  -- Status tracking
  status marketing_email_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS marketing_email_logs_campaign_idx ON public.marketing_email_logs (campaign_id, status);
CREATE INDEX IF NOT EXISTS marketing_email_logs_client_idx ON public.marketing_email_logs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_email_logs_status_idx ON public.marketing_email_logs (status, created_at);

-- Table: Client Marketing Preferences (opt-out tracking)
CREATE TABLE IF NOT EXISTS public.client_marketing_preferences (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  email_opt_out BOOLEAN NOT NULL DEFAULT false,
  email_opt_out_at TIMESTAMPTZ,
  marketing_emails_enabled BOOLEAN NOT NULL DEFAULT true,
  last_marketing_email_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER client_marketing_preferences_set_updated_at
BEFORE UPDATE ON public.client_marketing_preferences
FOR EACH ROW
EXECUTE FUNCTION public.marketing_set_updated_at();

-- Table: Marketing Menu Badge Tracking
CREATE TABLE IF NOT EXISTS public.admin_menu_badge_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_key TEXT NOT NULL UNIQUE,
  badge_text TEXT DEFAULT 'NEW',
  show_badge BOOLEAN NOT NULL DEFAULT true,
  badge_until TIMESTAMPTZ, -- auto-hide after this date
  dismissed_by UUID[] DEFAULT ARRAY[]::UUID[], -- users who dismissed it
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the email marketing badge (will show for 2 weeks by default)
INSERT INTO public.admin_menu_badge_tracking (menu_item_key, badge_text, show_badge, badge_until)
VALUES ('email-marketing', 'NEW', true, NOW() + INTERVAL '14 days')
ON CONFLICT (menu_item_key) DO UPDATE SET
  show_badge = true,
  badge_until = NOW() + INTERVAL '14 days';

-- Function: Get clients for marketing campaign
CREATE OR REPLACE FUNCTION public.marketing_get_target_clients(
  p_target_all_clients BOOLEAN DEFAULT false,
  p_target_min_days_since_registration INTEGER DEFAULT NULL,
  p_target_max_days_since_registration INTEGER DEFAULT NULL,
  p_target_specific_client_ids UUID[] DEFAULT NULL,
  p_target_has_missions BOOLEAN DEFAULT NULL,
  p_target_mission_status TEXT[] DEFAULT NULL,
  p_target_min_days_since_last_mission INTEGER DEFAULT NULL,
  p_target_max_days_since_last_mission INTEGER DEFAULT NULL
)
RETURNS TABLE (
  client_id UUID,
  client_email TEXT,
  client_name TEXT,
  user_id UUID,
  registration_date TIMESTAMPTZ,
  has_missions BOOLEAN,
  last_mission_date TIMESTAMPTZ,
  days_since_registration INTEGER,
  days_since_last_mission INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH client_missions AS (
    SELECT 
      c.id AS cid,
      COALESCE(bool_or(m.id IS NOT NULL), false) AS has_any_mission,
      MAX(m.date) AS last_mission_date,
      ARRAY_AGG(DISTINCT m.status::text) FILTER (WHERE m.id IS NOT NULL) AS mission_statuses
    FROM public.clients c
    LEFT JOIN public.missions m ON m.client_id = c.id
    GROUP BY c.id
  )
  SELECT 
    c.id::UUID AS client_id,
    c.email::TEXT AS client_email,
    COALESCE(c.name, c.email)::TEXT AS client_name,
    u.id::UUID AS user_id,
    c.created_at::TIMESTAMPTZ AS registration_date,
    cm.has_any_mission::BOOLEAN AS has_missions,
    cm.last_mission_date::TIMESTAMPTZ AS last_mission_date,
    EXTRACT(DAY FROM NOW() - c.created_at)::INTEGER AS days_since_registration,
    EXTRACT(DAY FROM NOW() - cm.last_mission_date)::INTEGER AS days_since_last_mission
  FROM public.clients c
  LEFT JOIN public.users u ON u.related_entity_id = c.id AND u.role = 'client'
  LEFT JOIN client_missions cm ON cm.cid = c.id
  LEFT JOIN public.client_marketing_preferences cmp ON cmp.client_id = c.id
  WHERE 
    -- Email must exist and not opted out
    c.email IS NOT NULL 
    AND length(trim(c.email)) > 0
    AND (cmp.email_opt_out IS NULL OR cmp.email_opt_out = false)
    -- Specific client IDs filter
    AND (p_target_specific_client_ids IS NULL OR c.id = ANY(p_target_specific_client_ids))
    -- Registration date filters
    AND (p_target_min_days_since_registration IS NULL OR EXTRACT(DAY FROM NOW() - c.created_at) >= p_target_min_days_since_registration)
    AND (p_target_max_days_since_registration IS NULL OR EXTRACT(DAY FROM NOW() - c.created_at) <= p_target_max_days_since_registration)
    -- Mission filters
    AND (p_target_has_missions IS NULL OR cm.has_any_mission = p_target_has_missions)
    AND (p_target_mission_status IS NULL OR p_target_mission_status = '{}' OR cm.mission_statuses && p_target_mission_status)
    -- Last mission date filters
    AND (p_target_min_days_since_last_mission IS NULL OR 
         (cm.last_mission_date IS NOT NULL AND EXTRACT(DAY FROM NOW() - cm.last_mission_date) >= p_target_min_days_since_last_mission))
    AND (p_target_max_days_since_last_mission IS NULL OR 
         (cm.last_mission_date IS NOT NULL AND EXTRACT(DAY FROM NOW() - cm.last_mission_date) <= p_target_max_days_since_last_mission))
  ORDER BY c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marketing_get_target_clients TO authenticated;

-- Function: Record marketing email sent
CREATE OR REPLACE FUNCTION public.marketing_record_email_sent(
  p_campaign_id UUID,
  p_client_id UUID,
  p_client_email TEXT,
  p_client_name TEXT,
  p_subject TEXT,
  p_html_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.marketing_email_logs (
    campaign_id, client_id, client_email, client_name,
    subject, html_content, status, sent_at
  ) VALUES (
    p_campaign_id, p_client_id, p_client_email, p_client_name,
    p_subject, p_html_content, 'sent', NOW()
  )
  RETURNING id INTO v_log_id;
  
  -- Update campaign sent count
  UPDATE public.marketing_campaigns
  SET sent_count = sent_count + 1
  WHERE id = p_campaign_id;
  
  -- Update client's last marketing email date
  INSERT INTO public.client_marketing_preferences (client_id, last_marketing_email_at, marketing_emails_enabled)
  VALUES (p_client_id, NOW(), true)
  ON CONFLICT (client_id) DO UPDATE SET
    last_marketing_email_at = NOW();
  
  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marketing_record_email_sent TO authenticated;

-- Function: Check if menu badge should be shown
CREATE OR REPLACE FUNCTION public.marketing_should_show_badge(
  p_menu_item_key TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_show_badge BOOLEAN;
  v_badge_until TIMESTAMPTZ;
  v_dismissed_by UUID[];
BEGIN
  SELECT 
    show_badge,
    badge_until,
    dismissed_by
  INTO v_show_badge, v_badge_until, v_dismissed_by
  FROM public.admin_menu_badge_tracking
  WHERE menu_item_key = p_menu_item_key;
  
  -- If no record, don't show
  IF v_show_badge IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if badge expired
  IF v_badge_until IS NOT NULL AND v_badge_until < NOW() THEN
    RETURN false;
  END IF;
  
  -- Check if user dismissed it
  IF p_user_id = ANY(COALESCE(v_dismissed_by, ARRAY[]::UUID[])) THEN
    RETURN false;
  END IF;
  
  RETURN v_show_badge;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marketing_should_show_badge TO authenticated;

-- Function: Dismiss menu badge
CREATE OR REPLACE FUNCTION public.marketing_dismiss_badge(
  p_menu_item_key TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_menu_badge_tracking
  SET dismissed_by = array_append(COALESCE(dismissed_by, ARRAY[]::UUID[]), p_user_id)
  WHERE menu_item_key = p_menu_item_key
    AND NOT (p_user_id = ANY(COALESCE(dismissed_by, ARRAY[]::UUID[])));
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marketing_dismiss_badge TO authenticated;

-- Function: Create automated campaign for new pack
CREATE OR REPLACE FUNCTION public.marketing_create_pack_campaign(
  p_pack_id UUID,
  p_pack_name TEXT,
  p_pack_description TEXT,
  p_pack_price NUMERIC,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id UUID;
  v_subject TEXT;
  v_content TEXT;
BEGIN
  v_subject := 'Nouveau pack disponible : ' || p_pack_name || ' !';
  
  v_content := format(
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' ||
    '<h2 style="color: #0f766e;">Nouveau pack disponible !</h2>' ||
    '<p>Bonjour,</p>' ||
    '<p>Nous avons le plaisir de vous annoncer l''arrivée d''un nouveau pack :</p>' ||
    '<div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 20px; margin: 20px 0;">' ||
    '  <h3 style="margin-top: 0; color: #115e59;">%s</h3>' ||
    '  <p style="margin-bottom: 0;">%s</p>' ||
    '  <p style="font-size: 24px; font-weight: bold; color: #0f766e; margin: 10px 0;">%s €</p>' ||
    '</div>' ||
    '<p>Ne manquez pas cette opportunité ! Contactez-nous dès maintenant pour en profiter.</p>' ||
    '<a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Voir nos offres</a>' ||
    '<p style="color: #64748b; font-size: 12px; margin-top: 30px;">' ||
    '  Presta Services Antilles - Simplifiez votre quotidien' ||
    '</p>' ||
    '</div>',
    p_pack_name,
    COALESCE(p_pack_description, 'Un pack conçu pour vous simplifier la vie !'),
    p_pack_price
  );
  
  INSERT INTO public.marketing_campaigns (
    type, status, name, subject, html_content,
    target_all_clients, related_pack_id, created_by
  ) VALUES (
    'auto_new_pack', 'draft', 
    'Nouveau pack : ' || p_pack_name,
    v_subject, v_content,
    true, p_pack_id, p_created_by
  )
  RETURNING id INTO v_campaign_id;
  
  RETURN v_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marketing_create_pack_campaign TO authenticated;

-- Function: Send campaign emails (to be called from Edge Function or client)
CREATE OR REPLACE FUNCTION public.marketing_send_campaign(
  p_campaign_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign RECORD;
  v_clients RECORD;
  v_sent_count INTEGER := 0;
BEGIN
  -- Get campaign details
  SELECT * INTO v_campaign
  FROM public.marketing_campaigns
  WHERE id = p_campaign_id;
  
  IF v_campaign IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'campaign_not_found');
  END IF;
  
  IF v_campaign.status NOT IN ('draft', 'scheduled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'campaign_already_sent');
  END IF;
  
  -- Update status to sending
  UPDATE public.marketing_campaigns
  SET status = 'sending', sent_at = NOW()
  WHERE id = p_campaign_id;
  
  -- Get target clients
  FOR v_clients IN
    SELECT * FROM public.marketing_get_target_clients(
      v_campaign.target_all_clients,
      v_campaign.target_min_days_since_registration,
      v_campaign.target_max_days_since_registration,
      v_campaign.target_specific_client_ids,
      v_campaign.target_has_missions,
      v_campaign.target_mission_status,
      v_campaign.target_min_days_since_last_mission,
      v_campaign.target_max_days_since_last_mission
    )
  LOOP
    -- Insert pending email log
    INSERT INTO public.marketing_email_logs (
      campaign_id, client_id, client_email, client_name,
      subject, html_content, status
    ) VALUES (
      p_campaign_id, v_clients.client_id, v_clients.client_email, v_clients.client_name,
      v_campaign.subject, v_campaign.html_content, 'pending'
    );
    
    v_sent_count := v_sent_count + 1;
  END LOOP;
  
  -- Update campaign status to sent
  UPDATE public.marketing_campaigns
  SET status = 'sent', sent_count = v_sent_count
  WHERE id = p_campaign_id;
  
  RETURN jsonb_build_object('ok', true, 'target_count', v_sent_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marketing_send_campaign TO authenticated;

-- RLS Policies
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_marketing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_menu_badge_tracking ENABLE ROW LEVEL SECURITY;

-- Allow admins full access
CREATE POLICY marketing_campaigns_admin_all ON public.marketing_campaigns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY marketing_email_logs_admin_all ON public.marketing_email_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY client_marketing_preferences_admin_all ON public.client_marketing_preferences
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY admin_menu_badge_tracking_admin_all ON public.admin_menu_badge_tracking
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Allow clients to see/update their own preferences
CREATE POLICY client_marketing_preferences_own_read ON public.client_marketing_preferences
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT related_entity_id FROM public.users WHERE id = auth.uid() AND role = 'client'
  ));

CREATE POLICY client_marketing_preferences_own_update ON public.client_marketing_preferences
  FOR UPDATE TO authenticated
  USING (client_id IN (
    SELECT related_entity_id FROM public.users WHERE id = auth.uid() AND role = 'client'
  ));
