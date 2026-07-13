-- ============================================================================
-- Leaderboard RPC. Run AFTER 0001_init.sql.
-- ============================================================================
-- Ranks volunteers by parts logged, filtered by time period and (optionally) a
-- single part. Returns only usernames + counts — no raw rows, no PII — so it is
-- safe to expose to every authenticated user (volunteers see it too).
--
-- SECURITY DEFINER so the aggregate can span all volunteers regardless of RLS,
-- while still only ever returning leaderboard-safe columns.
--
-- Time boundaries use America/Los_Angeles (Computers2Kids is in San Diego), so
-- "today" and "this week" line up with the local calendar. Change the timezone
-- string below if needed. Weeks start Monday (Postgres default).
-- ============================================================================

create or replace function public.get_leaderboard(
  period text default 'all',
  p_part_id uuid default null
)
returns table (volunteer_id uuid, display_name text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select case lower(period)
      when 'today' then
        date_trunc('day', now() at time zone 'America/Los_Angeles')
          at time zone 'America/Los_Angeles'
      when 'week' then
        date_trunc('week', now() at time zone 'America/Los_Angeles')
          at time zone 'America/Los_Angeles'
      else '-infinity'::timestamptz
    end as start_at
  )
  select v.id, v.display_name, sum(c.quantity)::bigint as total
  from public.contributions c
  join public.volunteers v on v.id = c.volunteer_id
  cross join bounds b
  where c.created_at >= b.start_at
    and (p_part_id is null or c.part_id = p_part_id)
  group by v.id, v.display_name
  order by sum(c.quantity) desc, v.display_name
  limit 100;
$$;

grant execute on function public.get_leaderboard(text, uuid) to authenticated;
