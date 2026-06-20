-- ИИ-9: профиль ассистента (Soul / User / Memory), редактируемый прямо из чата.
-- Три markdown-документа на пользователя в app_settings. NULL/пусто = поведение по
-- умолчанию (для soul берётся встроенная душа из кода assistant.ts).
-- Запусти этот скрипт один раз в Supabase -> SQL Editor.

alter table app_settings
  add column if not exists ai_soul text,
  add column if not exists ai_user_md text,
  add column if not exists ai_memory_md text;
