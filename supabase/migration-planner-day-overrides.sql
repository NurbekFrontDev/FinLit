-- =====================================================================
-- Nucleus -- Планировщик: персональные правки дела на КОНКРЕТНЫЙ день.
-- Позволяет менять время/секцию/важность/заметку дела ТОЛЬКО на один день,
-- не трогая шаблон «Мои дела» (planner_items) и другие дни.
--   Если для дела на дату есть строка здесь -> при загрузке дня её поля
--   заменяют поля из planner_items (см. loadDay в src/lib/planner.ts).
--   Одна правка на дело в день -> unique (user_id, item_id, date).
-- Выполнить ОДИН раз в Supabase (SQL Editor) или через run-migration.mjs.
-- Безопасно запускать повторно (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =====================================================================

create table if not exists public.planner_day_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.planner_items(id) on delete cascade,
  date date not null,
  time_of_day text check (time_of_day in ('morning', 'day', 'evening', 'allday')),
  at_time_start text,
  at_time_end text,
  priority text check (priority in ('none', 'low', 'medium', 'high')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id, date)
);

create index if not exists idx_planner_day_overrides_date
  on public.planner_day_overrides (user_id, date);

alter table public.planner_day_overrides enable row level security;

drop policy if exists "own planner_day_overrides" on public.planner_day_overrides;
create policy "own planner_day_overrides" on public.planner_day_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
