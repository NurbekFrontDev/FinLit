-- Сохранение выбранного объёма порции воды (мл) в app_settings.
-- Выполнить в Supabase SQL Editor.
alter table app_settings
  add column if not exists water_portion integer;
