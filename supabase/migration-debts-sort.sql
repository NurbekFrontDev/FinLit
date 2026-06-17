-- =====================================================================
-- FinLit -- Долги: ручной порядок (приоритет)
-- Добавляет столбец sort_order в debts, чтобы можно было перетаскивать
-- долги и держать важные сверху. Выполнить один раз в Supabase SQL Editor.
-- =====================================================================

alter table public.debts
  add column if not exists sort_order integer not null default 0;

-- Бэкафилл: нумеруем существующие долги каждого пользователя по дате создания
-- (новые сверху), чтобы текущий порядок на экране сохранился.
with ordered as (
  select id, row_number() over (
    partition by user_id order by created_at desc
  ) as rn
  from public.debts
)
update public.debts d
set sort_order = o.rn
from ordered o
where d.id = o.id;
