-- А-6.1 (правки): вода каждые 1.5 часа + информация о последнем бэкапе
-- 1) notif_water_every_hours: было integer, делаем numeric, чтобы хранить 1.5.
alter table public.app_settings
  alter column notif_water_every_hours type numeric using notif_water_every_hours::numeric;

-- 2) Куда сохранён последний бэкап (код: device / pc / download / cloud / cloud-auto,
--    возможны сочетания через +, напр. device+cloud). Показываем в настройках.
alter table public.app_settings
  add column if not exists last_backup_target text;
