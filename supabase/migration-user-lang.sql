-- Язык интерфейса пользователя в облаке (синхронизация между устройствами).
-- Хранится в app_settings, одна строка настроек на пользователя.
-- Безопасно запускать повторно.

alter table public.app_settings
  add column if not exists user_lang text;
