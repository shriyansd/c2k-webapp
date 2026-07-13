-- ============================================================================
-- Admin volunteer-stats lookup. Run AFTER 0001_init.sql.
-- ============================================================================
-- Returns a single volunteer's all-time totals per part (parts they've actually
-- contributed to, including now-inactive ones — history is preserved). Guarded
-- by is_admin() so only admins get data.
-- ============================================================================

create or replace function public.get_volunteer_part_totals(v_id uuid)
returns table (part_id uuid, name text, is_active boolean, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.name, p.is_active, sum(c.quantity)::bigint as total
  from public.contributions c
  join public.parts p on p.id = c.part_id
  where c.volunteer_id = v_id
    and public.is_admin()
  group by p.id, p.name, p.is_active
  order by p.name;
$$;

grant execute on function public.get_volunteer_part_totals(uuid) to authenticated;
