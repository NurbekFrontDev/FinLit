-- =====================================================================
-- А-6: локальные уведомления (дела/привычки, вода) + бэкап (кнопка/авто)
-- Выполнить один раз: node run-migration.mjs supabase/migration-notifications-backup.sql
-- =====================================================================

-- Новые поля настроек (одна строка на пользователя в app_settings).
alter table public.app_settings
  add column if not exists notif_tasks_enabled boolean default false,
  add column if not exists notif_tasks_offset_min integer default 0,
  add column if not exists notif_water_enabled boolean default false,
  add column if not exists notif_water_every_hours integer default 2,
  add column if not exists notif_water_from text default '09:00',
  add column if not exists notif_water_to text default '21:00',
  add column if not exists backup_auto boolean default false,
  add column if not exists backup_every_days integer default 7,
  add column if not exists last_auto_backup_at timestamptz;

-- =====================================================================
-- Приватное хранилище бэкапов (Supabase Storage). Файлы лежат в папке
-- пользователя: <uid>/finlit-backup-<дата>.json. Бакет закрытый (public=false).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- RLS для storage.objects: пользователь видит и пишет только свою папку.
-- Первый сегмент пути (storage.foldername(name))[1] должен совпадать с auth.uid().
drop policy if exists "backups read own" on storage.objects;
create policy "backups read own" on storage.objects
  for select using (
    bucket_id = 'backups' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "backups insert own" on storage.objects;
create policy "backups insert own" on storage.objects
  for insert with check (
    bucket_id = 'backups' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "backups update own" on storage.objects;
create policy "backups update own" on storage.objects
  for update using (
    bucket_id = 'backups' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "backups delete own" on storage.objects;
create policy "backups delete own" on storage.objects
  for delete using (
    bucket_id = 'backups' and auth.uid()::text = (storage.foldername(name))[1]
  );
