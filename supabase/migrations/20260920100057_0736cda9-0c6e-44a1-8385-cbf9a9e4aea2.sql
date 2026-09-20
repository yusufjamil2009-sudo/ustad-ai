alter table public.crorepati_events
  add column if not exists free_entries_grant integer not null default 3,
  add column if not exists max_free_entries integer not null default 3,
  add column if not exists missed_threshold integer not null default 10,
  add column if not exists schedule_weekdays jsonb not null default '[0,2,5]'::jsonb,
  add column if not exists open_hour integer not null default 6,
  add column if not exists open_minute integer not null default 0,
  add column if not exists window_minutes integer not null default 960,
  add column if not exists entry_timezone text not null default 'Asia/Kolkata',
  add column if not exists paid_entry_coin_cost bigint not null default 100000,
  add column if not exists paid_entry_enabled boolean not null default true;

create table if not exists public.crorepati_event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.crorepati_events (id) on delete cascade,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  unique (event_id, opened_at)
);
create index if not exists crorepati_occurrences_window_idx
  on public.crorepati_event_occurrences (event_id, opened_at desc);

create table if not exists public.crorepati_participation (
  occurrence_id uuid not null references public.crorepati_event_occurrences (id) on delete cascade,
  guest_id text not null references public.guests (id) on delete cascade,
  event_id uuid not null references public.crorepati_events (id) on delete cascade,
  eligible boolean not null default true,
  played boolean not null default false,
  attempt_id uuid references public.crorepati_attempts (id) on delete set null,
  counted boolean not null default false,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (occurrence_id, guest_id)
);
create index if not exists crorepati_participation_guest_idx
  on public.crorepati_participation (guest_id, closed_at desc);

create table if not exists public.crorepati_entry_state (
  guest_id text primary key references public.guests (id) on delete cascade,
  event_id uuid not null references public.crorepati_events (id) on delete cascade,
  free_entries integer not null default 3 check (free_entries >= 0),
  free_entries_used integer not null default 0,
  paid_entries_used integer not null default 0,
  missed_streak integer not null default 0 check (missed_streak >= 0),
  recovery_count integer not null default 0,
  last_played_at timestamptz,
  last_recovered_at timestamptz,
  zero_notified boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.crorepati_entries (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null references public.guests (id) on delete cascade,
  event_id uuid not null references public.crorepati_events (id) on delete cascade,
  occurrence_id uuid references public.crorepati_event_occurrences (id) on delete set null,
  attempt_id uuid unique references public.crorepati_attempts (id) on delete set null,
  entry_type text not null,
  free_entry_used boolean not null default false,
  paid_entry boolean not null default false,
  price bigint not null default 0,
  currency text not null default 'USTAD_COIN',
  status text not null default 'granted',
  ledger_ref text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (guest_id, idempotency_key)
);
create index if not exists crorepati_entries_guest_idx
  on public.crorepati_entries (guest_id, created_at desc);
create unique index if not exists crorepati_entries_one_open
  on public.crorepati_entries (guest_id)
  where status = 'granted';

alter table public.crorepati_attempts
  add column if not exists entry_id uuid references public.crorepati_entries (id) on delete set null;

insert into public.crorepati_event_occurrences (event_id, opened_at, closed_at, status)
select e.id, date_trunc('hour', now()), date_trunc('hour', now()) + interval '4 hours', 'open'
from public.crorepati_events e
where e.code = 'kbc-default'
on conflict (event_id, opened_at) do nothing;

grant all on public.crorepati_event_occurrences to service_role;
grant all on public.crorepati_participation to service_role;
grant all on public.crorepati_entry_state to service_role;
grant all on public.crorepati_entries to service_role;

alter table public.crorepati_event_occurrences enable row level security;
alter table public.crorepati_participation enable row level security;
alter table public.crorepati_entry_state enable row level security;
alter table public.crorepati_entries enable row level security;

create table if not exists public.trophy_designs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  version integer not null default 1,
  trophy_type text not null,
  title text not null,
  theme jsonb not null default '{}'::jsonb,
  event_id uuid,
  event_kind text not null default 'any',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists trophy_designs_lookup_idx
  on public.trophy_designs (trophy_type, event_kind, active);

create table if not exists public.ustad_achievements (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null references public.guests (id) on delete cascade,
  type text not null,
  title text not null,
  level integer not null default 1,
  event_id uuid,
  event_kind text not null default 'mega',
  match_id uuid,
  source text not null default '',
  awarded_at timestamptz not null default now(),
  verification_status text not null default 'verified',
  revoked_at timestamptz,
  revoked_reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (guest_id, type, event_id, match_id)
);
create index if not exists ustad_achievements_guest_idx
  on public.ustad_achievements (guest_id, awarded_at desc);
create index if not exists ustad_achievements_type_idx
  on public.ustad_achievements (guest_id, type, verification_status);

create table if not exists public.ustad_trophies (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null unique references public.ustad_achievements (id) on delete cascade,
  guest_id text not null references public.guests (id) on delete cascade,
  event_id uuid,
  match_id uuid,
  type text not null,
  design_id uuid references public.trophy_designs (id) on delete set null,
  design_code text not null default '',
  design_version integer not null default 1,
  image_reference text,
  image_status text not null default 'pending',
  engraving jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ustad_trophies_guest_idx
  on public.ustad_trophies (guest_id, created_at desc);

create table if not exists public.achievement_audit (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid references public.ustad_achievements (id) on delete set null,
  guest_id text not null references public.guests (id) on delete cascade,
  action text not null,
  reason text not null default '',
  source_event_id uuid,
  source_match_id uuid,
  engine_version text not null default 'part4.v1',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists achievement_audit_guest_idx
  on public.achievement_audit (guest_id, created_at desc);

insert into public.trophy_designs (code, trophy_type, title, event_kind, theme) values
  (
    'normal-gold-v1', 'normal_cup', 'Tournament Cup', 'any',
    '{"material":"gold","finish":"shiny","shape":"classic-cup","accent":"#f5c542","base":"#8a5a12","glow":"#fff3c4","handles":true,"stars":3,"label":"TOURNAMENT CHAMPION"}'::jsonb
  ),
  (
    'mega-diamond-v1', 'mega_cup', 'Mega Tournament Cup', 'mega',
    '{"material":"diamond","finish":"ultra-shiny","shape":"faceted-chalice","accent":"#8fe9ff","base":"#1b6f8c","glow":"#eafcff","handles":true,"stars":5,"label":"MEGA TOURNAMENT CHAMPION"}'::jsonb
  ),
  (
    'grandmaster-v1', 'grandmaster_cup', 'Grandmaster Cup', 'mega',
    '{"material":"platinum-royal","finish":"ultra-premium","shape":"crowned-chalice","accent":"#d9b3ff","base":"#4b2b7f","glow":"#f4e9ff","handles":true,"crown":true,"stars":7,"label":"USTAD AI GRANDMASTER"}'::jsonb
  ),
  (
    'ultra-grandmaster-v1', 'ultra_cup', 'Ultra Great Grandmaster Cup', 'mega',
    '{"material":"celestial","finish":"highest-tier","shape":"winged-monument","accent":"#ffd36e","base":"#7a1f5c","glow":"#fff6d8","handles":true,"crown":true,"wings":true,"stars":9,"label":"ULTRA GREAT GRANDMASTER"}'::jsonb
  )
on conflict (code) do nothing;

grant all on public.trophy_designs to service_role;
grant all on public.ustad_achievements to service_role;
grant all on public.ustad_trophies to service_role;
grant all on public.achievement_audit to service_role;

alter table public.trophy_designs enable row level security;
alter table public.ustad_achievements enable row level security;
alter table public.ustad_trophies enable row level security;
alter table public.achievement_audit enable row level security;