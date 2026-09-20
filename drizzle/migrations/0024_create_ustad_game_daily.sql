CREATE TABLE public.ustad_game_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  daily_date date NOT NULL,
  session_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  lock_triggered_at timestamptz,
  completed_questions integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guest_id, game_id, daily_date)
);

GRANT ALL ON public.ustad_game_daily TO service_role;

ALTER TABLE public.ustad_game_daily ENABLE ROW LEVEL SECURITY;

CREATE INDEX ustad_game_daily_lookup_idx ON public.ustad_game_daily (guest_id, daily_date);

-- Authoritative IST calendar date (Asia/Kolkata). Device clocks are never trusted.
CREATE OR REPLACE FUNCTION public.ustad_ist_date()
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date;
$$;

-- Idempotent start: returns the authoritative record for today. Never creates
-- a second daily record for the same (guest, game, IST day).
CREATE OR REPLACE FUNCTION public.ustad_game_daily_start(p_guest_id text, p_game_id text, p_session_id text)
RETURNS TABLE(daily_date date, completed_questions integer, status text, locked boolean, session_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_date date := public.ustad_ist_date();
  v_row public.ustad_game_daily%rowtype;
begin
  insert into public.guests (id) values (p_guest_id) on conflict (id) do nothing;

  insert into public.ustad_game_daily (guest_id, game_id, daily_date, session_id)
  values (p_guest_id, p_game_id, v_date, p_session_id)
  on conflict (guest_id, game_id, daily_date) do nothing;

  select * into v_row
    from public.ustad_game_daily
   where guest_id = p_guest_id and game_id = p_game_id and daily_date = v_date
   for update;

  if v_row.completed_questions >= 2 then
    return query select v_row.daily_date, v_row.completed_questions, v_row.status, true, v_row.session_id;
    return;
  end if;

  update public.ustad_game_daily d
     set session_id = coalesce(p_session_id, d.session_id),
         status = case when d.status = 'in_progress' then 'in_progress' else d.status end,
         updated_at = now()
   where d.guest_id = p_guest_id and d.game_id = p_game_id and d.daily_date = v_date
  returning * into v_row;

  return query select v_row.daily_date, v_row.completed_questions, v_row.status, false, v_row.session_id;
end;
$function$;

-- Atomic progress report. Safe against double taps, retries and multiple tabs:
-- completed_questions only ever moves forward and the lock timestamp is set once.
CREATE OR REPLACE FUNCTION public.ustad_game_daily_progress(p_guest_id text, p_game_id text, p_session_id text, p_completed integer)
RETURNS TABLE(daily_date date, completed_questions integer, status text, locked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_date date := public.ustad_ist_date();
  v_row public.ustad_game_daily%rowtype;
begin
  insert into public.guests (id) values (p_guest_id) on conflict (id) do nothing;

  insert into public.ustad_game_daily (guest_id, game_id, daily_date, session_id, completed_questions)
  values (p_guest_id, p_game_id, v_date, p_session_id, greatest(coalesce(p_completed, 0), 0))
  on conflict (guest_id, game_id, daily_date) do update
     set completed_questions = greatest(public.ustad_game_daily.completed_questions, greatest(coalesce(p_completed, 0), 0)),
         session_id = coalesce(public.ustad_game_daily.session_id, p_session_id),
         updated_at = now()
  returning * into v_row;

  if v_row.completed_questions >= 2 and v_row.lock_triggered_at is null then
    update public.ustad_game_daily d
       set lock_triggered_at = now(),
           status = case when d.completed_questions >= 30 then 'completed' else 'locked' end,
           updated_at = now()
     where d.id = v_row.id
    returning * into v_row;
  elsif v_row.completed_questions >= 30 and v_row.status <> 'completed' then
    update public.ustad_game_daily d
       set status = 'completed', updated_at = now()
     where d.id = v_row.id
    returning * into v_row;
  end if;

  return query select v_row.daily_date, v_row.completed_questions, v_row.status,
                      (v_row.completed_questions >= 2);
end;
$function$;