-- Migration: Create provider_availability table for tracking provider availability
-- This table stores availability slots and status for each provider per day

create table if not exists public.provider_availability (
  id uuid default gen_random_uuid() primary key,
  provider_id uuid not null references public.providers(id) on delete cascade,
  date date not null,
  status text not null check (status in ('available', 'busy', 'leave', 'unavailable')) default 'available',
  slots jsonb default '[]'::jsonb, -- Array of {startTime: string, endTime: string}
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(provider_id, date)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider_id ON public.provider_availability(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_availability_date ON public.provider_availability(date);
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider_date ON public.provider_availability(provider_id, date);

-- Enable RLS
alter table public.provider_availability enable row level security;

-- RLS Policies
-- Admin can do everything
create policy "Admin full access on provider_availability"
  on public.provider_availability
  for all
  to authenticated
  using (auth.jwt() ->> 'role' in ('admin', 'super_admin'))
  with check (auth.jwt() ->> 'role' in ('admin', 'super_admin'));

-- Providers can view their own availability
create policy "Providers can view own availability"
  on public.provider_availability
  for select
  to authenticated
  using (provider_id = auth.uid());

-- Function to update the updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
drop trigger if exists update_provider_availability_updated_at on public.provider_availability;
create trigger update_provider_availability_updated_at
  before update on public.provider_availability
  for each row
  execute function update_updated_at_column();

-- Comment on table
comment on table public.provider_availability is 'Stores daily availability status and time slots for each provider';
comment on column public.provider_availability.status is 'Availability status: available, busy, leave, or unavailable';
comment on column public.provider_availability.slots is 'JSON array of booked time slots with startTime and endTime';
