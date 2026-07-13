-- ============================================================================
-- Seed the default parts catalog. Idempotent — safe to re-run.
-- Run AFTER 0001_init.sql.
-- ============================================================================

insert into public.parts (name) values
  ('Screen'),
  ('RAM'),
  ('CPU'),
  ('Heat Sink'),
  ('Battery'),
  ('Keyboard'),
  ('Charger'),
  ('Hard Drive'),
  ('SSD'),
  ('GPU'),
  ('Power Supply'),
  ('Motherboard')
on conflict (lower(name)) do nothing;
