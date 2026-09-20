-- Permanent guest accounts + revocable sessions
create table if not exists public.ustad_accounts (
  guest_id text primary key references public.guests (id) on delete cascade,
  user_id uuid not null default gen_random_uuid(),
  username text not null,
  username_normalized text not null unique,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ustad_sessions (
  jti uuid primary key,
  guest_id text not null references public.guests (id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text not null default ''
);
create index if not exists ustad_sessions_guest_idx on public.ustad_sessions (guest_id, issued_at desc);
create index if not exists ustad_sessions_live_idx on public.ustad_sessions (guest_id) where revoked_at is null;

create table if not exists public.ustad_login_attempts (
  id uuid primary key default gen_random_uuid(),
  username_normalized text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);
create index if not exists ustad_login_attempts_idx
  on public.ustad_login_attempts (username_normalized, created_at desc);

create or replace function public.ustad_create_guest_account(
  p_guest_id text,
  p_username text,
  p_username_normalized text,
  p_password_hash text
) returns table (jti uuid, username text, user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jti uuid := gen_random_uuid();
  v_user_id uuid;
begin
  if exists (select 1 from public.ustad_accounts a where a.guest_id = p_guest_id) then
    raise exception 'GUEST_ALREADY_CLAIMED' using errcode = 'U0001';
  end if;

  insert into public.guests (id) values (p_guest_id) on conflict (id) do nothing;
  insert into public.profiles (guest_id) values (p_guest_id) on conflict (guest_id) do nothing;
  insert into public.settings (guest_id) values (p_guest_id) on conflict (guest_id) do nothing;
  insert into public.ustad_wallets (guest_id) values (p_guest_id) on conflict (guest_id) do nothing;

  insert into public.ustad_accounts (guest_id, username, username_normalized, password_hash, last_login_at)
  values (p_guest_id, p_username, p_username_normalized, p_password_hash, now())
  returning ustad_accounts.user_id into v_user_id;

  update public.ustad_sessions s
     set revoked_at = now(), revoked_reason = 'rotated'
   where s.guest_id = p_guest_id and s.revoked_at is null;

  insert into public.ustad_sessions (jti, guest_id, expires_at)
  values (v_jti, p_guest_id, now() + interval '180 days');

  return query select v_jti, p_username, v_user_id;
end;
$$;

create or replace function public.ustad_issue_fresh_session(p_guest_id text)
returns table (jti uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jti uuid := gen_random_uuid();
begin
  insert into public.guests (id) values (p_guest_id) on conflict (id) do nothing;

  update public.ustad_sessions s
     set revoked_at = now(), revoked_reason = 'rotated'
   where s.guest_id = p_guest_id and s.revoked_at is null;

  insert into public.ustad_sessions (jti, guest_id, expires_at)
  values (v_jti, p_guest_id, now() + interval '180 days');

  return query select v_jti;
end;
$$;

create or replace function public.ustad_refresh_session(p_guest_id text, p_jti uuid)
returns table (jti uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.ustad_sessions s
     set expires_at = now() + interval '180 days'
   where s.jti = p_jti
     and s.guest_id = p_guest_id
     and s.revoked_at is null
  returning s.jti, s.expires_at;
end;
$$;

create or replace function public.ustad_revoke_session(p_jti uuid, p_reason text default 'logout')
returns table (jti uuid, revoked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.ustad_sessions s
     set revoked_at = coalesce(s.revoked_at, now()),
         revoked_reason = case when s.revoked_at is null then coalesce(p_reason, 'logout') else s.revoked_reason end
   where s.jti = p_jti
  returning s.jti, s.revoked_at;
end;
$$;

-- God / Mystery tournaments
create table if not exists public.ustad_tickets (
  guest_id text primary key references public.guests (id) on delete cascade,
  god_tickets integer not null default 0 check (god_tickets >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.ustad_ticket_grant(p_guest_id text, p_amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_total integer;
begin
  insert into public.guests (id) values (p_guest_id) on conflict (id) do nothing;
  insert into public.ustad_tickets (guest_id, god_tickets)
  values (p_guest_id, greatest(p_amount, 0))
  on conflict (guest_id) do update
    set god_tickets = public.ustad_tickets.god_tickets + greatest(p_amount, 0),
        updated_at = now()
  returning god_tickets into v_total;
  return v_total;
end;
$$;

create or replace function public.ustad_ticket_consume(p_guest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_total integer;
begin
  update public.ustad_tickets
     set god_tickets = god_tickets - 1, updated_at = now()
   where guest_id = p_guest_id and god_tickets > 0
  returning god_tickets into v_total;
  if not found then
    raise exception 'NO_TICKET' using errcode = 'check_violation';
  end if;
  return v_total;
end;
$$;

create table if not exists public.tournament_attempts (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null references public.guests (id) on delete cascade,
  kind text not null,
  cycle_id text not null default '',
  cycle_start timestamptz,
  cycle_end timestamptz,
  attempt_date date not null default current_date,
  language text not null default 'english',
  status text not null default 'active',
  result text not null default '',
  total_questions integer not null default 0,
  current_index integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  score integer not null default 0,
  entry_amount bigint not null default 0,
  entry_txn_id text not null default '',
  ticket_consumed boolean not null default false,
  reward_issued boolean not null default false,
  reward_txn_id text not null default '',
  coins_awarded bigint not null default 0,
  achievement_id uuid,
  certificate_url text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tournament_attempts_guest_idx
  on public.tournament_attempts (guest_id, created_at desc);
create index if not exists tournament_attempts_cycle_idx
  on public.tournament_attempts (guest_id, kind, cycle_id);
create unique index if not exists tournament_attempts_one_per_day
  on public.tournament_attempts (guest_id, kind, attempt_date);

create table if not exists public.tournament_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.tournament_attempts (id) on delete cascade,
  position integer not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index integer not null default 0,
  explanation text not null default '',
  solution text not null default '',
  difficulty text not null default 'medium',
  category text not null default '',
  payload jsonb not null default '{}'::jsonb,
  selected_index integer,
  is_correct boolean,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attempt_id, position)
);

-- Weekly rank settlement
create table if not exists public.ustad_rank_cycles (
  cycle_start date primary key,
  cycle_end date not null,
  summary jsonb not null default '{}'::jsonb,
  settled_at timestamptz not null default now()
);

create table if not exists public.ustad_rank_awards (
  id uuid primary key default gen_random_uuid(),
  cycle_start date not null,
  cycle_end date not null,
  category text not null,
  guest_id text not null references public.guests (id) on delete cascade,
  profile_name text not null default '',
  rank integer not null,
  cup_count integer not null default 0,
  coins bigint not null default 0,
  cup_awarded boolean not null default false,
  status text not null default 'pending',
  transaction_id uuid,
  certificate_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_start, category, guest_id)
);
create index if not exists ustad_rank_awards_guest_idx
  on public.ustad_rank_awards (guest_id, cycle_start desc);
create index if not exists ustad_rank_awards_status_idx
  on public.ustad_rank_awards (status, cycle_end);

-- Global weekly coin offer
create table if not exists public.ustad_coin_offers (
  id uuid primary key default gen_random_uuid(),
  cycle_start date not null unique,
  cycle_end date not null,
  weekly_offer_id text not null unique,
  offer_day_offset integer not null default 0,
  start_iso timestamptz not null,
  end_iso timestamptz not null,
  discount_pct integer not null,
  duration_minutes integer not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists public.ustad_coin_offer_purchases (
  id uuid primary key default gen_random_uuid(),
  weekly_offer_id text not null,
  guest_id text not null references public.guests (id) on delete cascade,
  item_kind text not null default '',
  item_id text not null default '',
  base_price bigint not null default 0,
  discount_pct integer not null default 0,
  discount_amount bigint not null default 0,
  final_price bigint not null default 0,
  source text not null default '',
  ref_id text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ustad_coin_offer_purchases_idx
  on public.ustad_coin_offer_purchases (weekly_offer_id, created_at desc);

-- Device-generated question batches (short lived)
create table if not exists public.device_ai_batches (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null references public.guests (id) on delete cascade,
  task text not null,
  raw text not null,
  created_at timestamptz not null default now()
);
create index if not exists device_ai_batches_idx
  on public.device_ai_batches (guest_id, task, created_at);

grant all on public.ustad_accounts to service_role;
grant all on public.ustad_sessions to service_role;
grant all on public.ustad_login_attempts to service_role;
grant all on public.ustad_tickets to service_role;
grant all on public.tournament_attempts to service_role;
grant all on public.tournament_questions to service_role;
grant all on public.ustad_rank_cycles to service_role;
grant all on public.ustad_rank_awards to service_role;
grant all on public.ustad_coin_offers to service_role;
grant all on public.ustad_coin_offer_purchases to service_role;
grant all on public.device_ai_batches to service_role;

alter table public.ustad_accounts enable row level security;
alter table public.ustad_sessions enable row level security;
alter table public.ustad_login_attempts enable row level security;
alter table public.ustad_tickets enable row level security;
alter table public.tournament_attempts enable row level security;
alter table public.tournament_questions enable row level security;
alter table public.ustad_rank_cycles enable row level security;
alter table public.ustad_rank_awards enable row level security;
alter table public.ustad_coin_offers enable row level security;
alter table public.ustad_coin_offer_purchases enable row level security;
alter table public.device_ai_batches enable row level security;

revoke all on function public.ustad_create_guest_account(text, text, text, text) from public, anon;
revoke all on function public.ustad_issue_fresh_session(text) from public, anon;
revoke all on function public.ustad_refresh_session(text, uuid) from public, anon;
revoke all on function public.ustad_revoke_session(uuid, text) from public, anon;
revoke all on function public.ustad_ticket_grant(text, integer) from public, anon;
revoke all on function public.ustad_ticket_consume(text) from public, anon;
grant execute on function public.ustad_create_guest_account(text, text, text, text) to service_role;
grant execute on function public.ustad_issue_fresh_session(text) to service_role;
grant execute on function public.ustad_refresh_session(text, uuid) to service_role;
grant execute on function public.ustad_revoke_session(uuid, text) to service_role;
grant execute on function public.ustad_ticket_grant(text, integer) to service_role;
grant execute on function public.ustad_ticket_consume(text) to service_role;