-- Миграция: заметки-рефлексии по привычкам (как «Log habit reflection» в Atoms).
-- Безопасно запускать повторно.

create table if not exists public.planner_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.planner_items (id) on delete cascade,
  date date not null default current_date,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists planner_reflections_user_item_idx
  on public.planner_reflections (user_id, item_id, date desc);

alter table public.planner_reflections enable row level security;

drop policy if exists "reflections_select_own" on public.planner_reflections;
create policy "reflections_select_own" on public.planner_reflections
  for select using (auth.uid() = user_id);

drop policy if exists "reflections_insert_own" on public.planner_reflections;
create policy "reflections_insert_own" on public.planner_reflections
  for insert with check (auth.uid() = user_id);

drop policy if exists "reflections_update_own" on public.planner_reflections;
create policy "reflections_update_own" on public.planner_reflections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reflections_delete_own" on public.planner_reflections;
create policy "reflections_delete_own" on public.planner_reflections
  for delete using (auth.uid() = user_id);
