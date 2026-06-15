-- =====================================================================
-- FinLit — напоминание о бэкапе: переносим состояние в БД
-- (раньше дата последнего бэкапа жила в localStorage и не
--  синхронизировалась между телефоном и ПК).
-- Выполнить в Supabase: SQL Editor -> New query -> вставить и Run.
-- =====================================================================

-- Одна строка настроек на пользователя.
create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_backup_at timestamptz,        -- когда пользователь нажал «Готово»
  backup_snooze_until timestamptz,   -- до какого момента скрыта напоминалка («Позже»)
  updated_at timestamptz not null default now()
);

-- RLS: каждый видит и меняет только свою строку.
alter table public.app_settings enable row level security;

drop policy if exists "own app_settings" on public.app_settings;
create policy "own app_settings" on public.app_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
