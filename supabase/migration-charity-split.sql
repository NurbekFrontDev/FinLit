-- Благотворительность: распределение 5% между крупным пожертвованием и маленькими,
-- плюс параметры крупной цели (название, сумма, дата). Логика как у «Целей» (80/20).
-- Храним в app_settings (одна строка на пользователя) для синхронизации между устройствами.
-- Выполнить ОДИН раз в Supabase -> SQL Editor.
alter table public.app_settings
  add column if not exists charity_primary_split integer not null default 70;
alter table public.app_settings
  add column if not exists charity_goal_name text;
alter table public.app_settings
  add column if not exists charity_goal_target numeric(14,2) not null default 0;
alter table public.app_settings
  add column if not exists charity_goal_date date;
