-- Nucleus — трекер питьевой воды (💧).
-- Таблица логов + настройка цели.
-- Безопасно запускать повторно.

alter table public.app_settings
  add column if not exists water_goal integer not null default 2000;

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_water_logs_user_date on public.water_logs (user_id, date);

alter table public.water_logs enable row level security;

drop policy if exists "own water_logs" on public.water_logs;
create policy "own water_logs" on public.water_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
