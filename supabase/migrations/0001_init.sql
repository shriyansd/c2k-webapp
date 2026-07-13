-- ============================================================================
-- Computers2Kids (C2K) Contribution Tracker — schema, RLS, RPCs, indexes
-- ============================================================================
-- Run this in the Supabase SQL editor (or via `supabase db push`) BEFORE
-- 0002_seed_parts.sql.
--
-- Design notes (free-tier friendly):
--   * All aggregate reads go through GROUP BY RPCs, never sum-in-JS.
--   * Indexes cover every hot column (volunteer_id, part_id, created_at) plus a
--     composite (volunteer_id, part_id) for the personal-totals GROUP BY.
--   * Real-time is enabled only on `contributions` (admin live feed).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.parts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Unique part names keep the seed idempotent and prevent duplicate catalog rows.
create unique index if not exists parts_name_key on public.parts (lower(name));

create table if not exists public.volunteers (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

create table if not exists public.contributions (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  part_id      uuid not null references public.parts (id) on delete restrict,
  quantity     integer not null default 1,
  created_at   timestamptz not null default now()
);

create table if not exists public.admins (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null unique references public.volunteers (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Indexes (hot query paths)
-- ---------------------------------------------------------------------------

create index if not exists contributions_volunteer_id_idx on public.contributions (volunteer_id);
create index if not exists contributions_part_id_idx      on public.contributions (part_id);
create index if not exists contributions_created_at_idx   on public.contributions (created_at desc);
-- Composite index makes the personal-totals GROUP BY (volunteer_id, part_id) fast.
create index if not exists contributions_vol_part_idx      on public.contributions (volunteer_id, part_id);

-- ---------------------------------------------------------------------------
-- New-user trigger: create a volunteers row automatically on signup.
-- display_name is passed in auth signup metadata from the client.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.volunteers (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin(): security-definer helper so admin policies don't recurse through
-- the admins table's own RLS.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.volunteer_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Aggregate RPCs (GROUP BY in Postgres, not in JS).
-- security invoker so RLS still applies to the underlying tables.
-- ---------------------------------------------------------------------------

-- All-time totals per active part, across every volunteer (admin dashboard).
create or replace function public.get_part_totals()
returns table (part_id uuid, name text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.name, coalesce(sum(c.quantity), 0)::bigint as total
  from public.parts p
  left join public.contributions c on c.part_id = p.id
  where p.is_active
  group by p.id, p.name
  order by p.name;
$$;

-- All parts (active AND inactive) with all-time totals, for the admin parts
-- management table. Historical counts are preserved for deactivated parts.
-- Admin-only: returns no rows for non-admins (belt-and-suspenders alongside RLS).
create or replace function public.get_all_part_totals()
returns table (
  part_id uuid,
  name text,
  total bigint,
  is_active boolean,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.name, coalesce(sum(c.quantity), 0)::bigint as total,
         p.is_active, p.created_at
  from public.parts p
  left join public.contributions c on c.part_id = p.id
  where public.is_admin()
  group by p.id, p.name, p.is_active, p.created_at
  order by p.name;
$$;

-- Per-part totals for the currently authenticated volunteer (their stats).
create or replace function public.get_my_part_totals()
returns table (part_id uuid, name text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.name, coalesce(sum(c.quantity), 0)::bigint as total
  from public.parts p
  left join public.contributions c
    on c.part_id = p.id and c.volunteer_id = auth.uid()
  where p.is_active
  group by p.id, p.name
  order by p.name;
$$;

-- ---------------------------------------------------------------------------
-- Table & function privileges for the Data API.
-- Needed when "Automatically expose new tables" is OFF (the recommended, secure
-- setting) — RLS filters rows, but the role still needs table-level privileges.
-- Only the `authenticated` role is granted access; `anon` gets nothing because
-- every page in this app requires login. RLS policies still govern which rows
-- each user can touch.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

-- parts: everyone reads (RLS limits to active); admins write (RLS enforces).
grant select, insert, update, delete on public.parts to authenticated;
-- contributions: own rows only (RLS); delete powers the 5-second undo.
grant select, insert, delete on public.contributions to authenticated;
-- volunteers: read/update own row (RLS). Rows are inserted by the signup
-- trigger (security definer), so no insert grant is needed here.
grant select, update on public.volunteers to authenticated;
-- admins: admin-only (RLS).
grant select, insert, update, delete on public.admins to authenticated;

-- Aggregate RPCs.
grant execute on function public.get_part_totals()      to authenticated;
grant execute on function public.get_my_part_totals()   to authenticated;
grant execute on function public.get_all_part_totals()  to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.parts         enable row level security;
alter table public.volunteers    enable row level security;
alter table public.contributions enable row level security;
alter table public.admins        enable row level security;

-- parts ---------------------------------------------------------------------
-- Any authenticated user may read active parts.
drop policy if exists parts_select_active on public.parts;
create policy parts_select_active on public.parts
  for select to authenticated
  using (is_active or public.is_admin());

-- Admins may insert/update/delete any part (active or inactive).
drop policy if exists parts_admin_insert on public.parts;
create policy parts_admin_insert on public.parts
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists parts_admin_update on public.parts;
create policy parts_admin_update on public.parts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists parts_admin_delete on public.parts;
create policy parts_admin_delete on public.parts
  for delete to authenticated
  using (public.is_admin());

-- volunteers ----------------------------------------------------------------
-- A volunteer can read/update their own row; admins can read all rows.
drop policy if exists volunteers_select_own on public.volunteers;
create policy volunteers_select_own on public.volunteers
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists volunteers_update_own on public.volunteers;
create policy volunteers_update_own on public.volunteers
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- contributions -------------------------------------------------------------
-- A volunteer can read/insert/delete only their own rows; admins can read all.
-- DELETE-own supports the 5-second undo feature.
drop policy if exists contributions_select_own on public.contributions;
create policy contributions_select_own on public.contributions
  for select to authenticated
  using (volunteer_id = auth.uid() or public.is_admin());

drop policy if exists contributions_insert_own on public.contributions;
create policy contributions_insert_own on public.contributions
  for insert to authenticated
  with check (volunteer_id = auth.uid());

drop policy if exists contributions_delete_own on public.contributions;
create policy contributions_delete_own on public.contributions
  for delete to authenticated
  using (volunteer_id = auth.uid());

-- admins --------------------------------------------------------------------
-- Only admins may read or write the admins table.
drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins
  for select to authenticated
  using (public.is_admin());

drop policy if exists admins_write on public.admins;
create policy admins_write on public.admins
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Real-time: publish ONLY contributions (admin live activity feed).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.contributions;
