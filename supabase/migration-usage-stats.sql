-- Миграция: функции для карточки «Хранилище и лимиты» в Настройках.
-- Дают размер базы данных и файлового хранилища в байтах.
-- Вызываются серверной функцией get-usage через service_role (ключ только на сервере).
-- Запустить ОДИН раз в Supabase SQL Editor.

-- Размер всей базы данных в байтах.
create or replace function public.db_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database())::bigint;
$$;

-- Суммарный размер файлов в Storage в байтах (0, если хранилище пустое).
create or replace function public.storage_size()
returns bigint
language sql
security definer
set search_path = public, storage
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint
  from storage.objects;
$$;

-- Доступ: только сервер (service_role) и вошедшие пользователи, не анонимам.
revoke all on function public.db_size() from public;
revoke all on function public.storage_size() from public;
grant execute on function public.db_size() to service_role, authenticated;
grant execute on function public.storage_size() to service_role, authenticated;

-- Перезагрузить кэш схемы, чтобы PostgREST сразу увидел новые функции.
notify pgrst, 'reload schema';
