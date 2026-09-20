DROP FUNCTION IF EXISTS public.ustad_game_daily_start(text, text, text);
DROP FUNCTION IF EXISTS public.ustad_game_daily_progress(text, text, text, integer);

CREATE OR REPLACE FUNCTION public.ustad_game_daily_start(p_guest_id text, p_game_id text, p_session_id text)
RETURNS TABLE(out_date date, out_completed integer, out_status text, out_locked boolean)
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
    from public.ustad_game_daily d
   where d.guest_id = p_guest_id and d.game_id = p_game_id and d.daily_date = v_date
   for update;

  if v_row.completed_questions < 2 then
    update public.ustad_game_daily d
       set session_id = coalesce(p_session_id, d.session_id), updated_at = now()
     where d.id = v_row.id
    returning * into v_row;
  end if;

  return query select v_row.daily_date, v_row.completed_questions, v_row.status,
                      (v_row.completed_questions >= 2);
end;
$function$;

CREATE OR REPLACE FUNCTION public.ustad_game_daily_progress(p_guest_id text, p_game_id text, p_session_id text, p_completed integer)
RETURNS TABLE(out_date date, out_completed integer, out_status text, out_locked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_date date := public.ustad_ist_date();
  v_row public.ustad_game_daily%rowtype;
  v_n integer := greatest(coalesce(p_completed, 0), 0);
begin
  insert into public.guests (id) values (p_guest_id) on conflict (id) do nothing;

  insert into public.ustad_game_daily (guest_id, game_id, daily_date, session_id, completed_questions)
  values (p_guest_id, p_game_id, v_date, p_session_id, v_n)
  on conflict (guest_id, game_id, daily_date) do update
     set completed_questions = greatest(public.ustad_game_daily.completed_questions, v_n),
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