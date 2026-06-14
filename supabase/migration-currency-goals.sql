-- Миграция FinLit: мультивалюта, накопительные цели и список желаний.
-- Выполнить ОДИН раз в Supabase -> SQL Editor.

-- 1. Валюты пользователя. Базовая валюта — UZS (сум) с курсом 1.
create table if not exists currencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  symbol text,
  rate_to_base numeric(14,4) not null default 1,
  created_at timestamptz default now(),
  unique (user_id, code)
);
alter table currencies enable row level security;
create policy "currencies_select" on currencies for select using (auth.uid() = user_id);
create policy "currencies_insert" on currencies for insert with check (auth.uid() = user_id);
create policy "currencies_update" on currencies for update using (auth.uid() = user_id);
create policy "currencies_delete" on currencies for delete using (auth.uid() = user_id);

-- 2. Валюта и исходная сумма в доходах/расходах (amount всегда хранится в сумах).
alter table incomes add column if not exists currency text default 'UZS';
alter table incomes add column if not exists original_amount numeric(14,2);
alter table expenses add column if not exists currency text default 'UZS';
alter table expenses add column if not exists original_amount numeric(14,2);

-- 3. Список желаний + накопительные цели (одна таблица).
--    is_goal=false — просто желание; is_goal=true — активная цель.
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  note text,
  target_amount numeric(14,2) not null default 0,
  target_date date,
  is_goal boolean not null default false,
  done boolean not null default false,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table goals enable row level security;
create policy "goals_select" on goals for select using (auth.uid() = user_id);
create policy "goals_insert" on goals for insert with check (auth.uid() = user_id);
create policy "goals_update" on goals for update using (auth.uid() = user_id);
create policy "goals_delete" on goals for delete using (auth.uid() = user_id);

-- 4. Вклады в цели (сколько отложено, в сумах).
create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  amount numeric(14,2) not null,
  date date not null default current_date,
  created_at timestamptz default now()
);
alter table goal_contributions enable row level security;
create policy "gc_select" on goal_contributions for select using (auth.uid() = user_id);
create policy "gc_insert" on goal_contributions for insert with check (auth.uid() = user_id);
create policy "gc_update" on goal_contributions for update using (auth.uid() = user_id);
create policy "gc_delete" on goal_contributions for delete using (auth.uid() = user_id);
