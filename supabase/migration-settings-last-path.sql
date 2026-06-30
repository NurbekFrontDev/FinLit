-- Nucleus — трекер питьевой воды (💧). Миграция: last_path в app_settings.
-- Безопасно запускать повторно.

alter table public.app_settings
  add column if not exists last_path text;
