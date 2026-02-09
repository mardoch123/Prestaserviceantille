-- MARKETING MODULE (Flyers / Promotions / Parrainage)

create extension if not exists pgcrypto;

-- Enums
DO $$ BEGIN
  create type mkt_customer_request_status as enum ('new','contacted','qualified','converted','closed','spam');
EXCEPTION
  when duplicate_object then null;
END $$;

-- Public RPC: referrer stats by referral code (for localStorage-based sessions)
create or replace function public.mkt_get_referrer_stats_by_code(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  r public.mkt_referrers%rowtype;
  filleuls_total integer;
  paid_invoices_total integer;
begin
  v_code := lower(trim(coalesce(p_referral_code, '')));
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_code');
  end if;

  select * into r
  from public.mkt_referrers rr
  where lower(rr.referral_code) = v_code
  limit 1;

  if r.id is null then
    return jsonb_build_object('ok', true, 'referrals_count', 0, 'paid_invoices_count', 0);
  end if;

  select coalesce(count(*)::integer,0) into filleuls_total
  from public.mkt_referrals rf
  where rf.referrer_id = r.id
    and rf.deleted_at is null
    and rf.status <> 'rejected';

  select coalesce(sum(rf.paid_invoices_count)::integer,0) into paid_invoices_total
  from public.mkt_referrals rf
  where rf.referrer_id = r.id
    and rf.deleted_at is null
    and rf.status <> 'rejected';

  return jsonb_build_object(
    'ok', true,
    'referrals_count', filleuls_total,
    'paid_invoices_count', paid_invoices_total
  );
end;
$$;

grant execute on function public.mkt_get_referrer_stats_by_code(text) to anon, authenticated;

DO $$ BEGIN
  create type mkt_request_event_type as enum ('status_change','note','conversion','deletion');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type mkt_referrer_status as enum ('active','blocked');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type mkt_referral_status as enum ('pending','validated','rewarded','rejected');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  alter type mkt_referral_status add value 'blocked';
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type mkt_discount_type as enum ('percentage','fixed');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type mkt_points_reason as enum ('mission_completed','invoice_paid','manual_adjustment','reward_redemption');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type mkt_redemption_status as enum ('requested','approved','delivered','cancelled');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type mkt_notification_channel as enum ('app','email','push');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type mkt_outbox_status as enum ('pending','sent','failed');
EXCEPTION
  when duplicate_object then null;
END $$;

DO $$ BEGIN
  create type client_lead_status as enum ('pending','validated','rejected','blocked');
EXCEPTION
  when duplicate_object then null;
END $$;

-- Helpers
create or replace function public.mkt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.mkt_notify_referrer_referral_validated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_title text;
  v_body text;
begin
  if new.referrer_id is null then
    return new;
  end if;

  begin
    select r.auth_user_id into v_auth_user_id
    from public.mkt_referrers r
    where r.id = new.referrer_id
    limit 1;
  exception when others then
    v_auth_user_id := null;
  end;

  if v_auth_user_id is null then
    return new;
  end if;

  v_title := 'Filleul validé';
  v_body := 'Votre filleul a été validé.';
  if nullif(trim(coalesce(new.referred_full_name, '')), '') is not null then
    v_body := 'Votre filleul ' || trim(new.referred_full_name) || ' a été validé.';
  end if;

  begin
    insert into public.notifications (
      id, title, message, date, is_read, link, created_at,
      target_user_type, target_user_role, target_user_id
    ) values (
      gen_random_uuid(),
      v_title,
      v_body,
      now(),
      false,
      '/parrainage/mes-filleuls',
      now(),
      'client',
      'client',
      v_auth_user_id
    );
  exception
    when undefined_table then null;
    when undefined_column then null;
    when datatype_mismatch then null;
    when others then null;
  end;

  return new;
end;
$$;

drop trigger if exists mkt_referrals_notify_validated on public.mkt_referrals;
create trigger mkt_referrals_notify_validated
after insert on public.mkt_referrals
for each row
when (new.status = 'validated')
execute function public.mkt_notify_referrer_referral_validated();

create or replace function public.mkt_notify_referrer_points_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_title text;
  v_body text;
  v_points integer;
  v_reason text;
begin
  if new.referrer_id is null then
    return new;
  end if;

  begin
    select r.auth_user_id into v_auth_user_id
    from public.mkt_referrers r
    where r.id = new.referrer_id
    limit 1;
  exception when others then
    v_auth_user_id := null;
  end;

  if v_auth_user_id is null then
    return new;
  end if;

  v_points := coalesce(new.points, 0);
  v_reason := lower(coalesce(new.reason::text, ''));

  if v_points >= 0 then
    v_title := 'Points crédités';
  else
    v_title := 'Points débités';
  end if;

  v_body := 'Mouvement de points : ' || case when v_points >= 0 then '+' else '' end || v_points::text || ' points.';
  if v_reason <> '' then
    v_body := v_body || ' (' || v_reason || ')';
  end if;

  begin
    insert into public.notifications (
      id, title, message, date, is_read, link, created_at,
      target_user_type, target_user_role, target_user_id
    ) values (
      gen_random_uuid(),
      v_title,
      v_body,
      now(),
      false,
      '/parrainage/mes-points',
      now(),
      'client',
      'client',
      v_auth_user_id
    );
  exception
    when undefined_table then null;
    when undefined_column then null;
    when datatype_mismatch then null;
    when others then null;
  end;

  return new;
end;
$$;

drop trigger if exists mkt_points_ledger_notify_insert on public.mkt_points_ledger;
create trigger mkt_points_ledger_notify_insert
after insert on public.mkt_points_ledger
for each row
execute function public.mkt_notify_referrer_points_ledger_insert();

-- RPC for logged-in parrains: see referrals count + paid invoices total
create or replace function public.mkt_get_my_referrer_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
  r public.mkt_referrers%rowtype;
  filleuls_total integer;
  paid_invoices_total integer;
begin
  select * into r
  from public.mkt_referrers rr
  where rr.auth_user_id = auth.uid();

  if r.id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(count(*)::integer,0) into filleuls_total
  from public.mkt_referrals rf
  where rf.referrer_id = r.id
    and rf.deleted_at is null
    and rf.status <> 'rejected';

  select coalesce(sum(rf.paid_invoices_count)::integer,0) into paid_invoices_total
  from public.mkt_referrals rf
  where rf.referrer_id = r.id
    and rf.deleted_at is null
    and rf.status <> 'rejected';

  return jsonb_build_object(
    'ok', true,
    'referrals_count', filleuls_total,
    'paid_invoices_count', paid_invoices_total
  );
end;
$$;

grant execute on function public.mkt_get_my_referrer_stats() to authenticated;

create or replace function public.mkt_get_referrer_public_profile_by_code(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mkt_referrers%rowtype;
begin
  select * into r
  from public.mkt_referrers
  where lower(referral_code) = lower(trim(coalesce(p_referral_code,'')));

  if r.id is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'referrer', jsonb_build_object(
      'id', r.id,
      'referral_code', r.referral_code,
      'full_name', r.full_name,
      'email', r.email,
      'phone', r.phone,
      'is_lambda', r.is_lambda,
      'pack_ultime6_threshold', r.pack_ultime6_threshold,
      'pack_ultime6_earned_count', r.pack_ultime6_earned_count,
      'status', r.status,
      'created_at', r.created_at,
      'updated_at', r.updated_at
    )
  );
end;
$$;

grant execute on function public.mkt_get_referrer_public_profile_by_code(text) to anon, authenticated;

create or replace function public.mkt_get_referrer_public_profile_by_contact(p_email text default null, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mkt_referrers%rowtype;
  v_email text;
  v_phone text;
begin
  v_email := lower(trim(coalesce(p_email,'')));
  v_phone := trim(coalesce(p_phone,''));

  if v_email = '' and v_phone = '' then
    return jsonb_build_object('ok', false);
  end if;

  select * into r
  from public.mkt_referrers
  where (
    (v_email <> '' and lower(coalesce(email,'')) = v_email)
    or (v_phone <> '' and trim(coalesce(phone,'')) = v_phone)
  )
  order by created_at desc
  limit 1;

  if r.id is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'referrer', jsonb_build_object(
      'id', r.id,
      'referral_code', r.referral_code,
      'full_name', r.full_name,
      'email', r.email,
      'phone', r.phone,
      'is_lambda', r.is_lambda,
      'pack_ultime6_threshold', r.pack_ultime6_threshold,
      'pack_ultime6_earned_count', r.pack_ultime6_earned_count,
      'status', r.status,
      'created_at', r.created_at,
      'updated_at', r.updated_at
    )
  );
end;
$$;

grant execute on function public.mkt_get_referrer_public_profile_by_contact(text, text) to anon, authenticated;

create or replace function public.mkt_get_referrer_public_by_code(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mkt_referrers%rowtype;
begin
  select * into r
  from public.mkt_referrers
  where lower(referral_code) = lower(trim(coalesce(p_referral_code,'')));

  if r.id is null then
    return jsonb_build_object('ok', false);
  end if;

  if r.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;

  return jsonb_build_object(
    'ok', true,
    'referrer_id', r.id,
    'referral_code', r.referral_code,
    'is_lambda', r.is_lambda,
    'pack_ultime6_threshold', r.pack_ultime6_threshold
  );
end;
$$;

grant execute on function public.mkt_get_referrer_public_by_code(text) to anon, authenticated;

create or replace function public.mkt_audit_rewards_changes()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
    values ('mkt_rewards', new.id, 'reward_inserted', auth.uid(), null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
    values ('mkt_rewards', new.id, 'reward_updated', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
    values ('mkt_rewards', old.id, 'reward_deleted', auth.uid(), to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists mkt_rewards_audit_changes on public.mkt_rewards;
create trigger mkt_rewards_audit_changes
after insert or update or delete on public.mkt_rewards
for each row
execute function public.mkt_audit_rewards_changes();

create or replace function public.mkt_audit_reward_rules_changes()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
    values ('mkt_reward_rules', new.id, 'reward_rule_inserted', auth.uid(), null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
    values ('mkt_reward_rules', new.id, 'reward_rule_updated', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
    values ('mkt_reward_rules', old.id, 'reward_rule_deleted', auth.uid(), to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists mkt_reward_rules_audit_changes on public.mkt_reward_rules;
create trigger mkt_reward_rules_audit_changes
after insert or update or delete on public.mkt_reward_rules
for each row
execute function public.mkt_audit_reward_rules_changes();

-- RPC for logged-in filleuls: see paid count and whether they became referrer
create or replace function public.mkt_get_my_filleul_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
  client_id uuid;
  paid_total integer;
  became_referrer boolean;
begin
  -- resolve current user's client_id
  select u.related_entity_id into client_id
  from public.users u
  where u.id = auth.uid();

  if client_id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(max(r.paid_invoices_count),0)::integer into paid_total
  from public.mkt_referrals r
  where r.referred_client_id = client_id
    and r.deleted_at is null
    and r.status <> 'rejected';

  select exists(
    select 1 from public.mkt_referrers rr
    where rr.auth_user_id = auth.uid()
  ) into became_referrer;

  return jsonb_build_object(
    'ok', true,
    'paid_invoices_count', paid_total,
    'is_referrer', became_referrer
  );
end;
$$;

create or replace function public.mkt_is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select
    (
      exists (
        select 1
        from public.users u
        where u.id = p_user_id
          and lower(coalesce(u.role::text, '')) in ('admin','super_admin')
      )
      or lower(coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'email'), '')) = 'contact@prestaservicesantilles.com'
    );
$$;

revoke all on function public.mkt_is_admin(uuid) from public;

-- ADMIN: block/unblock a referrer (parrain)
create or replace function public.mkt_admin_set_referrer_status(p_referrer_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mkt_referrers%rowtype;
  new_status mkt_referrer_status;
  title text;
  body text;
begin
  if not public.mkt_is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  if p_referrer_id is null then
    raise exception 'referrer_id required';
  end if;

  begin
    new_status := p_status::mkt_referrer_status;
  exception when others then
    raise exception 'invalid status';
  end;

  select * into r from public.mkt_referrers where id = p_referrer_id;
  if r.id is null then
    raise exception 'Referrer not found';
  end if;

  update public.mkt_referrers
    set status = new_status,
        blocked_at = case when new_status = 'blocked' then now() else null end,
        blocked_by = case when new_status = 'blocked' then auth.uid() else null end,
        blocked_reason = case when new_status = 'blocked' then nullif(trim(coalesce(p_reason,'')), '') else null end,
        updated_at = now()
  where id = p_referrer_id;

  insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
  values (
    'mkt_referrers',
    p_referrer_id,
    case when new_status = 'blocked' then 'referrer_blocked' else 'referrer_unblocked' end,
    auth.uid(),
    to_jsonb(r),
    jsonb_build_object('status', new_status, 'reason', nullif(trim(coalesce(p_reason,'')), ''))
  );

  if new_status = 'blocked' then
    title := 'Compte parrain bloqué';
    body := 'Votre compte parrain a été bloqué.' || case when nullif(trim(coalesce(p_reason,'')), '') is not null then ' Raison : ' || trim(p_reason) else '' end;

    if r.email is not null and length(trim(r.email)) > 0 then
      insert into public.mkt_notification_outbox (channel, template, to_user_type, to_user_id, to_email, title, body, data)
      values (
        'email',
        'mkt_referrer_blocked',
        'referrer',
        r.auth_user_id,
        r.email,
        title,
        body,
        jsonb_build_object('referrer_id', r.id, 'referral_code', r.referral_code, 'reason', nullif(trim(coalesce(p_reason,'')), ''))
      );
    end if;

    if r.auth_user_id is not null then
      begin
        insert into public.notifications (
          id, title, message, date, is_read, link, created_at,
          target_user_type, target_user_role, target_user_id
        ) values (
          gen_random_uuid(),
          title,
          body,
          now(),
          false,
          '/parrainage',
          now(),
          'client',
          'client',
          r.auth_user_id
        );
      exception
        when undefined_table then null;
        when undefined_column then null;
        when datatype_mismatch then null;
        when others then null;
      end;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.mkt_admin_set_referrer_status(uuid, text, text) to authenticated;

-- ADMIN: block/unblock a referral (filleul in parrainage)
create or replace function public.mkt_admin_set_referral_status(p_referral_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mkt_referrals%rowtype;
  new_status mkt_referral_status;
  filleul_user_id uuid;
  title text;
  body text;
begin
  if not public.mkt_is_admin(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_referral_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_referral_id');
  end if;

  begin
    new_status := p_status::mkt_referral_status;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end;

  select * into r from public.mkt_referrals where id = p_referral_id;
  if r.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.mkt_referrals
    set status = new_status,
        blocked_at = case when new_status = 'blocked' then now() else null end,
        blocked_by = case when new_status = 'blocked' then auth.uid() else null end,
        blocked_reason = case when new_status = 'blocked' then nullif(trim(coalesce(p_reason,'')), '') else null end,
        updated_at = now()
  where id = p_referral_id;

  insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
  values (
    'mkt_referrals',
    p_referral_id,
    case when new_status = 'blocked' then 'referral_blocked' else 'referral_unblocked' end,
    auth.uid(),
    to_jsonb(r),
    jsonb_build_object('status', new_status, 'reason', nullif(trim(coalesce(p_reason,'')), ''))
  );

  if new_status = 'blocked' then
    title := 'Compte filleul bloqué';
    body := 'Votre accès au programme de parrainage a été bloqué.' || case when nullif(trim(coalesce(p_reason,'')), '') is not null then ' Raison : ' || trim(p_reason) else '' end;

    if r.referred_email is not null and length(trim(r.referred_email)) > 0 then
      insert into public.mkt_notification_outbox (channel, template, to_user_type, to_user_id, to_email, title, body, data)
      values (
        'email',
        'mkt_referral_blocked',
        'client',
        null,
        r.referred_email,
        title,
        body,
        jsonb_build_object('referral_id', r.id, 'reason', nullif(trim(coalesce(p_reason,'')), ''))
      );
    end if;

    if r.referred_client_id is not null then
      begin
        select u.id into filleul_user_id
        from public.users u
        where u.related_entity_id = r.referred_client_id
        limit 1;
      exception when others then
        filleul_user_id := null;
      end;

      if filleul_user_id is not null then
        begin
          insert into public.notifications (
            id, title, message, date, is_read, link, created_at,
            target_user_type, target_user_role, target_user_id
          ) values (
            gen_random_uuid(),
            title,
            body,
            now(),
            false,
            '/parrainage/mes-points',
            now(),
            'client',
            'client',
            filleul_user_id
          );
        exception
          when undefined_table then null;
          when undefined_column then null;
          when datatype_mismatch then null;
          when others then null;
        end;
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.mkt_admin_set_referral_status(uuid, text, text) to authenticated;

-- Link legacy referrer profile (missing auth_user_id) to current authenticated user
create or replace function public.mkt_link_my_referrer_profile(p_referral_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text;
  v_code text;
  v_referrer_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- already linked
  select r.id into v_referrer_id
  from public.mkt_referrers r
  where r.auth_user_id = v_uid
  limit 1;

  if v_referrer_id is not null then
    return jsonb_build_object('ok', true, 'referrer_id', v_referrer_id, 'already_linked', true);
  end if;

  select lower(trim(coalesce(u.email, ''))) into v_email
  from public.users u
  where u.id = v_uid;

  v_code := nullif(lower(trim(coalesce(p_referral_code, ''))), '');

  -- Priority 1: referral code match
  if v_code is not null then
    select r.id into v_referrer_id
    from public.mkt_referrers r
    where lower(r.referral_code) = v_code
    limit 1;
  end if;

  -- Priority 2: email match (only if code didn't resolve)
  if v_referrer_id is null and v_email <> '' then
    select r.id into v_referrer_id
    from public.mkt_referrers r
    where lower(trim(coalesce(r.email, ''))) = v_email
    order by r.created_at desc
    limit 1;
  end if;

  if v_referrer_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  begin
    update public.mkt_referrers
    set auth_user_id = v_uid,
        updated_at = now()
    where id = v_referrer_id;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'unique_violation');
  end;

  return jsonb_build_object('ok', true, 'referrer_id', v_referrer_id, 'already_linked', false);
end;
$$;

grant execute on function public.mkt_link_my_referrer_profile(text) to authenticated;

-- Tables
create table if not exists public.mkt_flyers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  normal_price numeric,
  promo_price numeric,
  observations text,
  target_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mkt_flyers add column if not exists normal_price numeric;
alter table public.mkt_flyers add column if not exists promo_price numeric;
alter table public.mkt_flyers add column if not exists observations text;

create index if not exists mkt_flyers_active_window_idx on public.mkt_flyers (is_active, starts_at, ends_at);

create trigger mkt_flyers_set_updated_at
before update on public.mkt_flyers
for each row
execute function public.mkt_set_updated_at();

create table if not exists public.mkt_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  code text,
  discount_type mkt_discount_type,
  discount_value numeric,
  service_type text,
  pack_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mkt_promotions_code_unique on public.mkt_promotions (lower(code)) where code is not null and length(trim(code)) > 0;
create index if not exists mkt_promotions_active_window_idx on public.mkt_promotions (is_active, starts_at, ends_at);

create trigger mkt_promotions_set_updated_at
before update on public.mkt_promotions
for each row
execute function public.mkt_set_updated_at();

create table if not exists public.mkt_customer_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  message text,
  source_flyer_id uuid references public.mkt_flyers(id) on delete set null,
  source_promotion_id uuid references public.mkt_promotions(id) on delete set null,
  referral_code text,
  status mkt_customer_request_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_leads (
  id uuid primary key default gen_random_uuid(),
  referral_code text,
  referrer_id uuid references public.mkt_referrers(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  service_type text,
  status client_lead_status not null default 'pending',
  note text,
  created_client_id uuid references public.clients(id) on delete set null,
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto link leads to referrer by referral_code (best-effort)
create or replace function public.mkt_client_leads_fill_referrer_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if new.referrer_id is not null then
    return new;
  end if;

  if nullif(trim(coalesce(new.referral_code, '')), '') is null then
    return new;
  end if;

  select r.id into rid
  from public.mkt_referrers r
  where lower(r.referral_code) = lower(trim(new.referral_code))
  limit 1;

  if rid is not null then
    new.referrer_id := rid;
  end if;

  return new;
end;
$$;

drop trigger if exists client_leads_fill_referrer_id on public.client_leads;
create trigger client_leads_fill_referrer_id
before insert on public.client_leads
for each row
execute function public.mkt_client_leads_fill_referrer_id();

alter table public.client_leads add column if not exists address text;
alter table public.client_leads add column if not exists city text;

create index if not exists client_leads_status_idx on public.client_leads (status, created_at desc);
create index if not exists client_leads_referrer_idx on public.client_leads (referrer_id, created_at desc);
create index if not exists client_leads_email_idx on public.client_leads (lower(email)) where email is not null and length(trim(email)) > 0;

create trigger client_leads_set_updated_at
before update on public.client_leads
for each row
execute function public.mkt_set_updated_at();

create index if not exists mkt_customer_requests_status_idx on public.mkt_customer_requests (status, created_at desc);
create index if not exists mkt_customer_requests_sources_idx on public.mkt_customer_requests (source_flyer_id, source_promotion_id);

create trigger mkt_customer_requests_set_updated_at
before update on public.mkt_customer_requests
for each row
execute function public.mkt_set_updated_at();

create table if not exists public.mkt_customer_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mkt_customer_requests(id) on delete cascade,
  event_type mkt_request_event_type not null,
  from_status mkt_customer_request_status,
  to_status mkt_customer_request_status,
  note text,
  actor_user_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mkt_request_events_request_id_idx on public.mkt_customer_request_events (request_id, created_at desc);

create table if not exists public.mkt_referrers (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  full_name text,
  email text,
  phone text,
  auth_user_id uuid,
  status mkt_referrer_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mkt_referrers add column if not exists blocked_at timestamptz;
alter table public.mkt_referrers add column if not exists blocked_by uuid;
alter table public.mkt_referrers add column if not exists blocked_reason text;

alter table public.mkt_referrers add column if not exists is_lambda boolean not null default false;
alter table public.mkt_referrers add column if not exists pack_ultime6_threshold integer not null default 1500;
alter table public.mkt_referrers add column if not exists pack_ultime6_earned_count integer not null default 0;

create unique index if not exists mkt_referrers_code_unique on public.mkt_referrers (lower(referral_code));
create unique index if not exists mkt_referrers_auth_user_unique on public.mkt_referrers (auth_user_id) where auth_user_id is not null;

create trigger mkt_referrers_set_updated_at
before update on public.mkt_referrers
for each row
execute function public.mkt_set_updated_at();

create table if not exists public.mkt_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.mkt_referrers(id) on delete restrict,
  referral_code text not null,
  referred_full_name text,
  referred_email text,
  referred_phone text,
  referred_client_id uuid,
  source_request_id uuid references public.mkt_customer_requests(id) on delete set null,
  status mkt_referral_status not null default 'pending',
  paid_invoices_count integer not null default 0,
  became_referrer_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mkt_referrals add column if not exists blocked_at timestamptz;
alter table public.mkt_referrals add column if not exists blocked_by uuid;
alter table public.mkt_referrals add column if not exists blocked_reason text;

create index if not exists mkt_referrals_referrer_idx on public.mkt_referrals (referrer_id, created_at desc);
create index if not exists mkt_referrals_status_idx on public.mkt_referrals (status, created_at desc);

create trigger mkt_referrals_set_updated_at
before update on public.mkt_referrals
for each row
execute function public.mkt_set_updated_at();

create table if not exists public.mkt_points_ledger (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.mkt_referrers(id) on delete restrict,
  points integer not null,
  reason mkt_points_reason not null,
  related_type text,
  related_id uuid,
  source_referral_id uuid,
  source_document_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists mkt_points_ledger_invoice_paid_unique
  on public.mkt_points_ledger (reason, source_document_id)
  where reason = 'invoice_paid' and source_document_id is not null;

create index if not exists mkt_points_ledger_source_referral_idx
  on public.mkt_points_ledger (source_referral_id, created_at desc);

-- LIMIT: max 5 filleuls per parrain (ignore deleted + rejected)
create or replace function public.mkt_referrals_enforce_limit()
returns trigger
language plpgsql
as $$
declare
  cnt integer;
begin
  select count(*) into cnt
  from public.mkt_referrals r
  where r.referrer_id = new.referrer_id
    and r.deleted_at is null
    and r.status <> 'rejected';

  if cnt >= 5 then
    raise exception 'Parrainage: limite de 5 filleuls atteinte pour ce parrain.';
  end if;

  return new;
end;
$$;

drop trigger if exists mkt_referrals_limit_on_insert on public.mkt_referrals;
create trigger mkt_referrals_limit_on_insert
before insert on public.mkt_referrals
for each row
execute function public.mkt_referrals_enforce_limit();

-- CREDIT POINTS: +99 when invoice becomes paid AND reste à charge == 99
-- Calcul reste à charge = total_ttc - (tax_credit_enabled ? total_ttc * 0.5 : 0)
create or replace function public.mkt_on_invoice_paid_credit_points()
returns trigger
language plpgsql
security definer
as $$
declare
  client_email text;
  referral_row public.mkt_referrals%rowtype;
  referrer_row public.mkt_referrers%rowtype;
  rest_a_charge numeric;
  has_credit boolean;
  paid_cnt integer;
  filleul_user_id uuid;
  new_code text;
begin
  -- only when transitioning to paid
  if new.status = 'paid' and coalesce(old.status,'') <> 'paid' then
    -- ensure this is an invoice (if column exists)
    begin
      if new.type is not null and new.type <> 'Facture' then
        return new;
      end if;
    exception when undefined_column then
      -- no type column, ignore
      null;
    end;

    -- compute reste à charge
    begin
      has_credit := coalesce(new.tax_credit_enabled, false);
      rest_a_charge := coalesce(new.total_ttc, 0) - (case when has_credit then coalesce(new.total_ttc, 0) * 0.5 else 0 end);
    exception when undefined_column then
      return new;
    end;

    if abs(rest_a_charge - 99) > 0.01 then
      return new;
    end if;

    -- fetch client email (best-effort)
    begin
      select c.email into client_email
      from public.clients c
      where c.id = new.client_id;
    exception
      when undefined_table then client_email := null;
      when undefined_column then client_email := null;
    end;

    -- resolve referral: by client_id first, else by email
    select r.* into referral_row
    from public.mkt_referrals r
    where r.deleted_at is null
      and r.status in ('validated','rewarded')
      and (
        (new.client_id is not null and r.referred_client_id = new.client_id)
        or (client_email is not null and lower(coalesce(r.referred_email,'')) = lower(client_email))
      )
    order by r.created_at desc
    limit 1;

    if referral_row.id is null then
      return new;
    end if;

    -- stop if referrer is blocked
    select * into referrer_row
    from public.mkt_referrers rr
    where rr.id = referral_row.referrer_id;

    if referrer_row.id is null or referrer_row.status <> 'active' then
      return new;
    end if;

    -- stop if referral (filleul) is blocked
    if referral_row.status = 'blocked' then
      return new;
    end if;

    -- backfill referred_client_id if missing
    if referral_row.referred_client_id is null then
      begin
        update public.mkt_referrals
          set referred_client_id = new.client_id
          where id = referral_row.id;
      exception when others then
        null;
      end;
    end if;

    -- idempotent insert (+99)
    insert into public.mkt_points_ledger (
      referrer_id,
      points,
      reason,
      related_type,
      related_id,
      source_referral_id,
      source_document_id,
      created_by
    ) values (
      referral_row.referrer_id,
      99,
      'invoice_paid',
      'referral',
      referral_row.id,
      referral_row.id,
      new.id,
      null
    ) on conflict do nothing;

    -- increment paid invoices counter for filleul (idempotent based on unique ledger insert)
    -- If the ledger insert was ignored due to conflict, we still want to avoid double count.
    -- We treat ledger (invoice_paid, source_document_id) as the source of truth.
    select count(*)::integer into paid_cnt
    from public.mkt_points_ledger l
    where l.reason = 'invoice_paid'
      and l.source_referral_id = referral_row.id;

    update public.mkt_referrals
      set paid_invoices_count = paid_cnt
      where id = referral_row.id;

    -- After 2 paid invoices: transform filleul into referrer (non-lambda)
    if paid_cnt >= 2 then
      begin
        select u.id into filleul_user_id
        from public.users u
        where (u.related_entity_id = new.client_id)
        limit 1;
      exception when undefined_column then
        filleul_user_id := null;
      end;

      new_code := 'PAR-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));

      begin
        insert into public.mkt_referrers (
          referral_code,
          full_name,
          email,
          phone,
          auth_user_id,
          is_lambda,
          pack_ultime6_threshold,
          status
        ) values (
          new_code,
          referral_row.referred_full_name,
          referral_row.referred_email,
          referral_row.referred_phone,
          filleul_user_id,
          false,
          1500,
          'active'
        ) on conflict do nothing;
      exception when others then
        null;
      end;

      update public.mkt_referrals
        set became_referrer_at = coalesce(became_referrer_at, now())
        where id = referral_row.id;
    end if;

    -- mark rewarded
    update public.mkt_referrals
      set status = 'rewarded'
      where id = referral_row.id
        and status <> 'rejected';
  end if;

  return new;
end;
$$;

-- Create trigger only if documents table exists
DO $$
BEGIN
  IF to_regclass('public.documents') IS NOT NULL THEN
    EXECUTE 'drop trigger if exists mkt_documents_on_paid on public.documents';
    EXECUTE 'create trigger mkt_documents_on_paid after update on public.documents for each row execute function public.mkt_on_invoice_paid_credit_points()';
  END IF;
END $$;

-- ADMIN: delete referral (soft-delete) + remove points generated + audit
create or replace function public.mkt_delete_referral(p_referral_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
as $$
declare
  r public.mkt_referrals%rowtype;
  lost_points integer;
begin
  if not public.mkt_is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  select * into r from public.mkt_referrals where id = p_referral_id;
  if r.id is null then
    raise exception 'Referral not found';
  end if;

  select coalesce(sum(points),0)::integer into lost_points
  from public.mkt_points_ledger
  where source_referral_id = p_referral_id;

  delete from public.mkt_points_ledger
  where source_referral_id = p_referral_id;

  update public.mkt_referrals
    set deleted_at = now(),
        deleted_by = auth.uid(),
        deleted_reason = p_reason
  where id = p_referral_id;

  insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
  values (
    'mkt_referrals',
    p_referral_id,
    'referral_deleted',
    auth.uid(),
    to_jsonb(r),
    jsonb_build_object('deleted_at', now(), 'deleted_by', auth.uid(), 'deleted_reason', p_reason, 'lost_points', lost_points)
  );

  return jsonb_build_object('ok', true, 'lost_points', lost_points);
end;
$$;

create index if not exists mkt_points_ledger_referrer_idx on public.mkt_points_ledger (referrer_id, created_at desc);

create table if not exists public.mkt_rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  points_cost integer not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mkt_reward_rules (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.mkt_rewards(id) on delete cascade,
  points_threshold integer not null,
  applies_to text not null default 'all',
  is_active boolean not null default true,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mkt_reward_rules_points_threshold_check check (points_threshold > 0),
  constraint mkt_reward_rules_applies_to_check check (applies_to in ('all','normal','lambda'))
);

create index if not exists mkt_reward_rules_active_idx on public.mkt_reward_rules (is_active, points_threshold asc);
create index if not exists mkt_reward_rules_reward_idx on public.mkt_reward_rules (reward_id);

create trigger mkt_reward_rules_set_updated_at
before update on public.mkt_reward_rules
for each row
execute function public.mkt_set_updated_at();

create index if not exists mkt_rewards_active_idx on public.mkt_rewards (is_active);

create trigger mkt_rewards_set_updated_at
before update on public.mkt_rewards
for each row
execute function public.mkt_set_updated_at();

create table if not exists public.mkt_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.mkt_rewards(id) on delete restrict,
  referrer_id uuid not null references public.mkt_referrers(id) on delete restrict,
  points_cost integer not null,
  status mkt_redemption_status not null default 'requested',
  requested_note text,
  approved_by uuid,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PHASE 9: auto conversion points -> reward "Pack Ultime 6" when threshold reached
create or replace function public.mkt_get_referrer_points_balance(p_referrer_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(points),0)::integer
  from public.mkt_points_ledger
  where referrer_id = p_referrer_id;
$$;

create or replace function public.mkt_ensure_pack_ultime6_reward()
returns uuid
language plpgsql
security definer
as $$
declare
  rid uuid;
begin
  select id into rid
  from public.mkt_rewards
  where lower(name) = lower('Pack Ultime 6')
  limit 1;

  if rid is not null then
    return rid;
  end if;

  insert into public.mkt_rewards (name, description, points_cost, is_active)
  values ('Pack Ultime 6', 'Récompense automatique par parrainage', 0, true)
  returning id into rid;

  return rid;
end;
$$;

create or replace function public.mkt_maybe_auto_convert_points(p_referrer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  r public.mkt_referrers%rowtype;
  balance integer;
  threshold integer;
  reward_id uuid;
  cost integer;
  redemption_id uuid;
  rr_reward_id uuid;
  rr_threshold integer;
  has_rule boolean;
begin
  select * into r
  from public.mkt_referrers
  where id = p_referrer_id;

  if r.id is null then
    return;
  end if;

  if r.status <> 'active' then
    return;
  end if;

  balance := public.mkt_get_referrer_points_balance(r.id);
  select exists(
    select 1
    from public.mkt_reward_rules x
    where x.is_active = true
      and (x.applies_to = 'all' or (x.applies_to = 'lambda' and r.is_lambda = true) or (x.applies_to = 'normal' and (r.is_lambda is not true)))
  ) into has_rule;

  -- if already redeemed recently at same balance, we still allow multiple packs by consuming points in loops
  while true loop
    if has_rule then
      select x.points_threshold, x.reward_id
      into rr_threshold, rr_reward_id
      from public.mkt_reward_rules x
      where x.is_active = true
        and x.points_threshold <= balance
        and (x.applies_to = 'all' or (x.applies_to = 'lambda' and r.is_lambda = true) or (x.applies_to = 'normal' and (r.is_lambda is not true)))
      order by x.points_threshold desc
      limit 1;

      if rr_reward_id is null then
        exit;
      end if;

      threshold := rr_threshold;
      reward_id := rr_reward_id;
      cost := threshold;
    else
      threshold := coalesce(r.pack_ultime6_threshold, case when r.is_lambda then 1500 else 1000 end);
      if balance < threshold then
        exit;
      end if;
      reward_id := public.mkt_ensure_pack_ultime6_reward();
      cost := threshold;
    end if;

    if balance < threshold then
      exit;
    end if;

    insert into public.mkt_reward_redemptions (reward_id, referrer_id, points_cost, status, requested_note, approved_by, delivered_at)
    values (reward_id, r.id, cost, 'delivered', 'Auto conversion points -> Pack Ultime 6', auth.uid(), now())
    returning id into redemption_id;

    insert into public.mkt_points_ledger (referrer_id, points, reason, related_type, related_id, created_by)
    values (r.id, -cost, 'reward_redemption', 'reward_redemption', redemption_id, auth.uid());

    update public.mkt_referrers
      set pack_ultime6_earned_count = pack_ultime6_earned_count + 1
      where id = r.id;

    -- APP notification (best-effort)
    begin
      insert into public.notifications (
        id, title, message, date, is_read, link, created_at,
        target_user_type, target_user_role, target_user_id
      ) values (
        gen_random_uuid(),
        'Récompense obtenue',
        'Bravo ! Vous avez obtenu un Pack Ultime 6 grâce à vos points de parrainage.',
        now(),
        false,
        '/parrainage/mes-points',
        now(),
        'client',
        'client',
        r.auth_user_id
      );
    exception
      when undefined_table then null;
      when undefined_column then null;
      when datatype_mismatch then null;
      when others then null;
    end;

    -- Email notification (outbox)
    insert into public.mkt_notification_outbox (channel, template, to_user_type, to_user_id, to_email, title, body, data)
    values (
      'email',
      'mkt_reward_pack_ultime6',
      'referrer',
      r.auth_user_id,
      r.email,
      'Récompense Pack Ultime 6',
      'Bravo ! Vous avez obtenu un Pack Ultime 6 grâce à vos points de parrainage.',
      jsonb_build_object(
        'referrer_id', r.id,
        'reward_id', reward_id,
        'redemption_id', redemption_id,
        'threshold', threshold,
        'balance_before', balance
      )
    );

    balance := balance - threshold;
  end loop;
end;
$$;

create or replace function public.mkt_admin_adjust_referrer_points(p_referrer_id uuid, p_points integer, p_note text)
returns jsonb
language plpgsql
security definer
as $$
declare
  before_balance integer;
  after_balance integer;
begin
  if not public.mkt_is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  if p_referrer_id is null then
    raise exception 'referrer_id required';
  end if;

  if p_points is null or p_points = 0 then
    return jsonb_build_object('ok', false, 'message', 'points must be non-zero');
  end if;

  before_balance := public.mkt_get_referrer_points_balance(p_referrer_id);

  insert into public.mkt_points_ledger (referrer_id, points, reason, related_type, related_id, created_by)
  values (p_referrer_id, p_points, 'manual_adjustment', 'admin_adjustment', gen_random_uuid(), auth.uid());

  after_balance := public.mkt_get_referrer_points_balance(p_referrer_id);

  insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
  values (
    'mkt_referrers',
    p_referrer_id,
    'admin_adjust_points',
    auth.uid(),
    jsonb_build_object('balance', before_balance),
    jsonb_build_object('balance', after_balance, 'delta', p_points, 'note', p_note)
  );

  perform public.mkt_maybe_auto_convert_points(p_referrer_id);

  return jsonb_build_object('ok', true, 'before_balance', before_balance, 'after_balance', after_balance);
end;
$$;

create or replace function public.mkt_admin_grant_reward(p_referrer_id uuid, p_reward_id uuid, p_points_cost integer, p_note text)
returns jsonb
language plpgsql
security definer
as $$
declare
  before_balance integer;
  after_balance integer;
  redemption_id uuid;
  cost integer;
  r public.mkt_rewards%rowtype;
begin
  if not public.mkt_is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  select * into r from public.mkt_rewards where id = p_reward_id;
  if r.id is null then
    raise exception 'Reward not found';
  end if;

  cost := coalesce(p_points_cost, r.points_cost);
  if cost is null or cost < 0 then
    raise exception 'Invalid points_cost';
  end if;

  before_balance := public.mkt_get_referrer_points_balance(p_referrer_id);

  insert into public.mkt_reward_redemptions (reward_id, referrer_id, points_cost, status, requested_note, approved_by, delivered_at)
  values (p_reward_id, p_referrer_id, cost, 'delivered', coalesce(p_note, 'Admin grant reward'), auth.uid(), now())
  returning id into redemption_id;

  if cost > 0 then
    insert into public.mkt_points_ledger (referrer_id, points, reason, related_type, related_id, created_by)
    values (p_referrer_id, -cost, 'reward_redemption', 'reward_redemption', redemption_id, auth.uid());
  end if;

  after_balance := public.mkt_get_referrer_points_balance(p_referrer_id);

  insert into public.mkt_audit_log (entity_table, entity_id, action, actor_user_id, before, after)
  values (
    'mkt_reward_redemptions',
    redemption_id,
    'admin_grant_reward',
    auth.uid(),
    jsonb_build_object('balance', before_balance),
    jsonb_build_object('balance', after_balance, 'points_cost', cost, 'reward_id', p_reward_id, 'note', p_note)
  );

  return jsonb_build_object('ok', true, 'redemption_id', redemption_id, 'before_balance', before_balance, 'after_balance', after_balance);
end;
$$;

grant execute on function public.mkt_admin_grant_reward(uuid, uuid, integer, text) to authenticated;

create or replace function public.mkt_admin_list_referrers_performance(
  p_search text default null,
  p_is_lambda boolean default null,
  p_status text default null,
  p_min_filleuls integer default null,
  p_min_points_earned integer default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  if not public.mkt_is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  with base as (
    select
      r.id,
      r.referral_code,
      r.full_name,
      r.email,
      r.phone,
      r.is_lambda,
      r.status,
      r.created_at,
      coalesce((
        select count(*)::integer
        from public.mkt_referrals rf
        where rf.referrer_id = r.id
          and rf.deleted_at is null
          and rf.status <> 'rejected'
      ), 0) as filleuls_total,
      coalesce((
        select sum(rf.paid_invoices_count)::integer
        from public.mkt_referrals rf
        where rf.referrer_id = r.id
          and rf.deleted_at is null
          and rf.status <> 'rejected'
      ), 0) as paid_invoices_total,
      coalesce((
        select sum(case when l.points > 0 then l.points else 0 end)::integer
        from public.mkt_points_ledger l
        where l.referrer_id = r.id
      ), 0) as points_earned_total,
      coalesce((
        select sum(case when l.points < 0 then -l.points else 0 end)::integer
        from public.mkt_points_ledger l
        where l.referrer_id = r.id
      ), 0) as points_spent_total,
      public.mkt_get_referrer_points_balance(r.id) as points_balance
    from public.mkt_referrers r
    where (p_is_lambda is null or r.is_lambda = p_is_lambda)
      and (p_status is null or r.status = p_status::mkt_referrer_status)
      and (
        p_search is null
        or trim(p_search) = ''
        or (
          lower(r.referral_code) like '%' || lower(trim(p_search)) || '%'
          or lower(coalesce(r.full_name,'')) like '%' || lower(trim(p_search)) || '%'
          or lower(coalesce(r.email,'')) like '%' || lower(trim(p_search)) || '%'
          or lower(coalesce(r.phone,'')) like '%' || lower(trim(p_search)) || '%'
        )
      )
  ), filtered as (
    select *
    from base
    where (p_min_filleuls is null or filleuls_total >= p_min_filleuls)
      and (p_min_points_earned is null or points_earned_total >= p_min_points_earned)
  )
  select coalesce(jsonb_agg(to_jsonb(filtered) order by points_earned_total desc, filleuls_total desc, created_at asc), '[]'::jsonb)
  into result
  from filtered;

  return jsonb_build_object('ok', true, 'items', result);
end;
$$;

grant execute on function public.mkt_admin_list_referrers_performance(text, boolean, text, integer, integer) to authenticated;

create or replace function public.mkt_admin_get_referrer_performance(p_referrer_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  r public.mkt_referrers%rowtype;
  filleuls_total integer;
  paid_invoices_total integer;
  points_earned_total integer;
  points_spent_total integer;
  points_balance integer;
  referrals jsonb;
begin
  if not public.mkt_is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  select * into r from public.mkt_referrers where id = p_referrer_id;
  if r.id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(count(*)::integer,0) into filleuls_total
  from public.mkt_referrals rf
  where rf.referrer_id = r.id
    and rf.deleted_at is null
    and rf.status <> 'rejected';

  select coalesce(sum(rf.paid_invoices_count)::integer,0) into paid_invoices_total
  from public.mkt_referrals rf
  where rf.referrer_id = r.id
    and rf.deleted_at is null
    and rf.status <> 'rejected';

  select coalesce(sum(case when l.points > 0 then l.points else 0 end)::integer,0) into points_earned_total
  from public.mkt_points_ledger l
  where l.referrer_id = r.id;

  select coalesce(sum(case when l.points < 0 then -l.points else 0 end)::integer,0) into points_spent_total
  from public.mkt_points_ledger l
  where l.referrer_id = r.id;

  points_balance := public.mkt_get_referrer_points_balance(r.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', rf.id,
    'status', rf.status,
    'created_at', rf.created_at,
    'referred_full_name', rf.referred_full_name,
    'referred_email', rf.referred_email,
    'referred_phone', rf.referred_phone,
    'paid_invoices_count', rf.paid_invoices_count,
    'became_referrer_at', rf.became_referrer_at
  ) order by rf.created_at desc), '[]'::jsonb)
  into referrals
  from public.mkt_referrals rf
  where rf.referrer_id = r.id
    and rf.deleted_at is null;

  return jsonb_build_object(
    'ok', true,
    'referrer', to_jsonb(r),
    'stats', jsonb_build_object(
      'filleuls_total', filleuls_total,
      'paid_invoices_total', paid_invoices_total,
      'points_earned_total', points_earned_total,
      'points_spent_total', points_spent_total,
      'points_balance', points_balance
    ),
    'referrals', referrals
  );
end;
$$;

grant execute on function public.mkt_admin_get_referrer_performance(uuid) to authenticated;

create or replace function public.mkt_points_ledger_after_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.mkt_maybe_auto_convert_points(new.referrer_id);
  return new;
end;
$$;

drop trigger if exists mkt_points_ledger_on_insert on public.mkt_points_ledger;
create trigger mkt_points_ledger_on_insert
after insert on public.mkt_points_ledger
for each row
execute function public.mkt_points_ledger_after_insert();

create index if not exists mkt_redemptions_referrer_idx on public.mkt_reward_redemptions (referrer_id, created_at desc);
create index if not exists mkt_redemptions_status_idx on public.mkt_reward_redemptions (status, created_at desc);

create trigger mkt_redemptions_set_updated_at
before update on public.mkt_reward_redemptions
for each row
execute function public.mkt_set_updated_at();

create table if not exists public.mkt_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mkt_audit_log_entity_idx on public.mkt_audit_log (entity_table, entity_id, created_at desc);

create table if not exists public.mkt_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  channel mkt_notification_channel not null,
  template text,
  to_user_type text,
  to_user_id uuid,
  to_email text,
  title text,
  body text,
  data jsonb,
  status mkt_outbox_status not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists mkt_outbox_status_idx on public.mkt_notification_outbox (status, created_at asc);

-- Triggers for outbox
create or replace function public.mkt_on_new_customer_request()
returns trigger
language plpgsql
as $$
begin
  insert into public.mkt_customer_request_events (request_id, event_type, note, payload)
  values (new.id, 'note', 'Request created', jsonb_build_object(
    'source_flyer_id', new.source_flyer_id,
    'source_promotion_id', new.source_promotion_id,
    'referral_code', new.referral_code
  ));

  begin
    insert into public.notifications (
      id,
      title,
      message,
      date,
      is_read,
      link,
      created_at,
      target_user_type,
      target_user_role,
      target_user_id
    ) values (
      gen_random_uuid(),
      'Nouvelle demande',
      coalesce(new.full_name, '') || ' a envoyé une demande.',
      now(),
      false,
      '/admin/marketing/demandes',
      now(),
      'admin',
      'admin',
      null
    );
  exception
    when undefined_table then null;
    when undefined_column then null;
    when datatype_mismatch then null;
    when others then null;
  end;

  insert into public.mkt_notification_outbox (
    channel, template, to_user_type, to_email, title, body, data
  ) values (
    'email',
    'mkt_new_customer_request',
    'admin',
    'contact@prestaservicesantilles.com',
    'Nouvelle demande client',
    coalesce(new.full_name,'') || ' a envoyé une demande.',
    jsonb_build_object(
      'request_id', new.id,
      'full_name', new.full_name,
      'email', new.email,
      'phone', new.phone,
      'message', new.message,
      'source_flyer_id', new.source_flyer_id,
      'source_promotion_id', new.source_promotion_id,
      'referral_code', new.referral_code
    )
  );

  return new;
end;
$$;

drop trigger if exists mkt_customer_requests_on_insert on public.mkt_customer_requests;
create trigger mkt_customer_requests_on_insert
after insert on public.mkt_customer_requests
for each row
execute function public.mkt_on_new_customer_request();

-- RLS
alter table public.mkt_flyers enable row level security;
alter table public.mkt_promotions enable row level security;
alter table public.mkt_customer_requests enable row level security;
alter table public.mkt_customer_request_events enable row level security;
alter table public.client_leads enable row level security;
alter table public.mkt_referrers enable row level security;
alter table public.mkt_referrals enable row level security;
alter table public.mkt_points_ledger enable row level security;
alter table public.mkt_rewards enable row level security;
alter table public.mkt_reward_rules enable row level security;
alter table public.mkt_reward_redemptions enable row level security;
alter table public.mkt_audit_log enable row level security;
alter table public.mkt_notification_outbox enable row level security;

-- Privileges (PostgREST needs GRANTs in addition to RLS policies)
grant insert on table public.client_leads to anon, authenticated;
grant select, update, delete on table public.client_leads to authenticated;

drop policy if exists client_leads_public_insert on public.client_leads;
create policy client_leads_public_insert
on public.client_leads
for insert
to anon, authenticated
with check (true);

drop policy if exists client_leads_admin_all on public.client_leads;
create policy client_leads_admin_all
on public.client_leads
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

drop policy if exists client_leads_referrer_select on public.client_leads;
create policy client_leads_referrer_select
on public.client_leads
for select
to authenticated
using (
  public.mkt_is_admin(auth.uid())
  or referrer_id in (
    select r.id from public.mkt_referrers r where r.auth_user_id = auth.uid()
  )
);

-- RPC: list pending leads for current referrer
create or replace function public.mkt_list_my_pending_client_leads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  items jsonb;
begin
  select r.id into v_referrer_id
  from public.mkt_referrers r
  where r.auth_user_id = auth.uid()
  limit 1;

  if v_referrer_id is null then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]'::jsonb)
  into items
  from (
    select *
    from public.client_leads
    where referrer_id = v_referrer_id
      and status = 'pending'
    order by created_at desc
    limit 200
  ) l;

  return jsonb_build_object('ok', true, 'items', items);
end;
$$;

grant execute on function public.mkt_list_my_pending_client_leads() to authenticated;

-- Public RPC: list pending leads by referral code (fallback when auth session is missing)
create or replace function public.mkt_list_pending_client_leads_by_code(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_referrer_id uuid;
  items jsonb;
begin
  v_code := lower(trim(coalesce(p_referral_code, '')));
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_code', 'items', '[]'::jsonb);
  end if;

  select r.id into v_referrer_id
  from public.mkt_referrers r
  where lower(r.referral_code) = v_code
  limit 1;

  if v_referrer_id is null then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]'::jsonb)
  into items
  from (
    select *
    from public.client_leads
    where referrer_id = v_referrer_id
      and status = 'pending'
    order by created_at desc
    limit 200
  ) l;

  return jsonb_build_object('ok', true, 'items', items);
end;
$$;

grant execute on function public.mkt_list_pending_client_leads_by_code(text) to anon, authenticated;

-- Admin RPC: list pending leads (deterministic admin view)
create or replace function public.mkt_admin_list_pending_client_leads(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  items jsonb;
begin
  if not public.mkt_is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 500), 2000));

  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]'::jsonb)
  into items
  from (
    select *
    from public.client_leads
    where status = 'pending'
    order by created_at desc
    limit v_limit
  ) l;

  return jsonb_build_object('ok', true, 'items', items);
end;
$$;

grant execute on function public.mkt_admin_list_pending_client_leads(integer) to authenticated;

-- Referrers: public insert, owner select
drop policy if exists mkt_referrers_public_insert on public.mkt_referrers;
create policy mkt_referrers_public_insert
on public.mkt_referrers
for insert
to anon, authenticated
with check (true);

drop policy if exists mkt_referrers_owner_select on public.mkt_referrers;
create policy mkt_referrers_owner_select
on public.mkt_referrers
for select
to authenticated
using (auth_user_id = auth.uid() or public.mkt_is_admin(auth.uid()));

-- Referrals: public insert, admin select
drop policy if exists mkt_referrals_public_insert on public.mkt_referrals;
create policy mkt_referrals_public_insert
on public.mkt_referrals
for insert
to anon, authenticated
with check (true);

drop policy if exists mkt_referrals_admin_select on public.mkt_referrals;
create policy mkt_referrals_admin_select
on public.mkt_referrals
for select
to authenticated
using (public.mkt_is_admin(auth.uid()));

-- Referrals: owner select (parrain can see their filleuls)
drop policy if exists mkt_referrals_owner_select on public.mkt_referrals;
create policy mkt_referrals_owner_select
on public.mkt_referrals
for select
to authenticated
using (
  public.mkt_is_admin(auth.uid())
  or referrer_id in (
    select id from public.mkt_referrers r where r.auth_user_id = auth.uid()
  )
);

-- Ledger: owner select + admin all
drop policy if exists mkt_points_ledger_owner_select on public.mkt_points_ledger;
create policy mkt_points_ledger_owner_select
on public.mkt_points_ledger
for select
to authenticated
using (
  referrer_id in (
    select id from public.mkt_referrers r where r.auth_user_id = auth.uid()
  )
  or public.mkt_is_admin(auth.uid())
);

drop policy if exists mkt_points_ledger_admin_write on public.mkt_points_ledger;
create policy mkt_points_ledger_admin_write
on public.mkt_points_ledger
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Public RPC: points summary by referral code (lambda)
create or replace function public.mkt_get_points_summary_by_code(p_referral_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  r public.mkt_referrers%rowtype;
  balance integer;
  history jsonb;
begin
  select * into r
  from public.mkt_referrers
  where lower(referral_code) = lower(trim(coalesce(p_referral_code,'')));

  if r.id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(sum(l.points),0)::integer into balance
  from public.mkt_points_ledger l
  where l.referrer_id = r.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'points', l.points,
    'reason', l.reason,
    'created_at', l.created_at,
    'source_referral_id', l.source_referral_id,
    'source_document_id', l.source_document_id
  ) order by l.created_at desc), '[]'::jsonb)
  into history
  from (
    select * from public.mkt_points_ledger
    where referrer_id = r.id
    order by created_at desc
    limit 50
  ) l;

  return jsonb_build_object(
    'ok', true,
    'referrer_id', r.id,
    'referral_code', r.referral_code,
    'balance', balance,
    'history', history
  );
end;
$$;

grant execute on function public.mkt_get_points_summary_by_code(text) to anon, authenticated;

-- Flyers: public read active window
drop policy if exists mkt_flyers_public_read on public.mkt_flyers;
create policy mkt_flyers_public_read
on public.mkt_flyers
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists mkt_flyers_admin_write on public.mkt_flyers;
create policy mkt_flyers_admin_write
on public.mkt_flyers
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Promotions: public read active window
drop policy if exists mkt_promotions_public_read on public.mkt_promotions;
create policy mkt_promotions_public_read
on public.mkt_promotions
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists mkt_promotions_admin_write on public.mkt_promotions;
create policy mkt_promotions_admin_write
on public.mkt_promotions
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Customer requests: anon can create, admin can read/manage
drop policy if exists mkt_customer_requests_public_insert on public.mkt_customer_requests;
create policy mkt_customer_requests_public_insert
on public.mkt_customer_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists mkt_customer_requests_admin_select on public.mkt_customer_requests;
create policy mkt_customer_requests_admin_select
on public.mkt_customer_requests
for select
to authenticated
using (public.mkt_is_admin(auth.uid()));

drop policy if exists mkt_customer_requests_admin_update on public.mkt_customer_requests;
create policy mkt_customer_requests_admin_update
on public.mkt_customer_requests
for update
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Request events: admin only
drop policy if exists mkt_request_events_admin_all on public.mkt_customer_request_events;
create policy mkt_request_events_admin_all
on public.mkt_customer_request_events
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Referrers: public insert (create lead), admin manage, referrer can read own if linked
drop policy if exists mkt_referrers_public_insert on public.mkt_referrers;
create policy mkt_referrers_public_insert
on public.mkt_referrers
for insert
to anon, authenticated
with check (true);

drop policy if exists mkt_referrers_admin_all on public.mkt_referrers;
create policy mkt_referrers_admin_all
on public.mkt_referrers
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

drop policy if exists mkt_referrers_self_select on public.mkt_referrers;
create policy mkt_referrers_self_select
on public.mkt_referrers
for select
to authenticated
using (auth_user_id = auth.uid());

-- Referrals: public insert, admin manage, referrer read own
drop policy if exists mkt_referrals_public_insert on public.mkt_referrals;
create policy mkt_referrals_public_insert
on public.mkt_referrals
for insert
to anon, authenticated
with check (true);

drop policy if exists mkt_referrals_admin_all on public.mkt_referrals;
create policy mkt_referrals_admin_all
on public.mkt_referrals
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

drop policy if exists mkt_referrals_referrer_select on public.mkt_referrals;
create policy mkt_referrals_referrer_select
on public.mkt_referrals
for select
to authenticated
using (
  exists (
    select 1
    from public.mkt_referrers r
    where r.id = mkt_referrals.referrer_id
      and r.auth_user_id = auth.uid()
  )
);

-- Points ledger: admin only
drop policy if exists mkt_points_admin_all on public.mkt_points_ledger;
create policy mkt_points_admin_all
on public.mkt_points_ledger
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Rewards: public read active, admin manage
drop policy if exists mkt_rewards_public_read on public.mkt_rewards;
create policy mkt_rewards_public_read
on public.mkt_rewards
for select
to anon
using (is_active = true);

drop policy if exists mkt_reward_rules_admin_all on public.mkt_reward_rules;
create policy mkt_reward_rules_admin_all
on public.mkt_reward_rules
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

drop policy if exists mkt_rewards_admin_all on public.mkt_rewards;
create policy mkt_rewards_admin_all
on public.mkt_rewards
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Reward redemptions: referrer can create/read own, admin manage
drop policy if exists mkt_redemptions_referrer_insert on public.mkt_reward_redemptions;
create policy mkt_redemptions_referrer_insert
on public.mkt_reward_redemptions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.mkt_referrers r
    where r.id = mkt_reward_redemptions.referrer_id
      and r.auth_user_id = auth.uid()
  )
);

drop policy if exists mkt_redemptions_referrer_select on public.mkt_reward_redemptions;
create policy mkt_redemptions_referrer_select
on public.mkt_reward_redemptions
for select
to authenticated
using (
  exists (
    select 1
    from public.mkt_referrers r
    where r.id = mkt_reward_redemptions.referrer_id
      and r.auth_user_id = auth.uid()
  )
);

drop policy if exists mkt_redemptions_admin_all on public.mkt_reward_redemptions;
create policy mkt_redemptions_admin_all
on public.mkt_reward_redemptions
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

-- Audit log + outbox: admin only
drop policy if exists mkt_audit_admin_all on public.mkt_audit_log;
create policy mkt_audit_admin_all
on public.mkt_audit_log
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));

drop policy if exists mkt_outbox_admin_all on public.mkt_notification_outbox;
create policy mkt_outbox_admin_all
on public.mkt_notification_outbox
for all
to authenticated
using (public.mkt_is_admin(auth.uid()))
with check (public.mkt_is_admin(auth.uid()));
