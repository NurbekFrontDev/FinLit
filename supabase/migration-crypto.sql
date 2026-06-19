-- =====================================================================
-- FinLit -- Крипто-инвестиции (Крипто-этап 1: база данных)
-- Учёт криптоинвестиций: спот (Main), мемкоины и фьючерсы.
-- Выполнить ОДИН раз в Supabase: SQL Editor -> New query -> вставить и Run.
-- Безопасно запускать повторно (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) АКТИВЫ спота и мемкоинов (одна позиция = один актив в портфеле)
--    portfolio: 'main' (основной спот) или 'meme' (мемкоины, отдельно визуально)
--    status:    'open' (в портфеле) или 'closed' (позиция закрыта/продана)
--    Количество, средняя цена и вложенная сумма НЕ хранятся здесь -- они
--    считаются автоматически из списка сделок (crypto_transactions).
-- ---------------------------------------------------------------------
create table if not exists public.crypto_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text,
  portfolio text not null default 'main' check (portfolio in ('main', 'meme')),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at date not null default current_date,
  closed_at date,
  close_price_usd numeric(38,12),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) СДЕЛКИ по активам (покупки/докупки/продажи).
--    type:        'buy' (купил/докупил) или 'sell' (продал).
--    quantity:    количество монет в сделке.
--    price_usd:   цена за одну монету в долларах на момент сделки.
--    amount_usd:  сумма сделки в долларах (quantity * price_usd); храним явно
--                 для удобства и истории, даже если цена потом меняется.
--    expense_id:  связь с расходом в категории «Инвестиции / Криптовалюта»
--                 (авто-расход при покупке). on delete set null -- если расход
--                 удалят, сделка останется.
-- ---------------------------------------------------------------------
create table if not exists public.crypto_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.crypto_assets(id) on delete cascade,
  type text not null default 'buy' check (type in ('buy', 'sell')),
  quantity numeric(38,12) not null default 0,
  price_usd numeric(38,12) not null default 0,
  amount_usd numeric(20,2) not null default 0,
  date date not null default current_date,
  expense_id uuid references public.expenses(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) ФЬЮЧЕРСЫ (отдельный учёт сделок с плечом).
--    direction:  'long' или 'short'.
--    margin_usd: вложено в сделку, долларов (на момент открытия).
--    exit_usd:   получено при закрытии, долларов (итог позиции).
--    Прибыль/убыток и % считаются в приложении: pnl = exit_usd - margin_usd,
--    % = pnl / margin_usd * 100.
--    status:     'open' или 'closed'.
-- ---------------------------------------------------------------------
create table if not exists public.crypto_futures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  direction text not null default 'long' check (direction in ('long', 'short')),
  opened_at date not null default current_date,
  margin_usd numeric(20,2) not null default 0,
  closed_at date,
  exit_usd numeric(20,2),
  status text not null default 'open' check (status in ('open', 'closed')),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4) МЕСЯЧНАЯ СВОДКА (верхняя таблица года).
--    deposit_usd:   пополнение за месяц.
--    end_value_usd: итог (стоимость портфеля) на конец месяца, вводится вручную.
--    Начальная сумма месяца = end_value_usd прошлого месяца (считаем в приложении).
--    Общая сумма вложений = начальная + пополнение; прибыль/убыток = итог - вложения.
-- ---------------------------------------------------------------------
create table if not exists public.crypto_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  deposit_usd numeric(20,2) not null default 0,
  end_value_usd numeric(20,2),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, year, month)
);

-- ---------------------------------------------------------------------
-- 5) НАСТРОЙКА: авто-создание расхода при покупке крипты (по умолчанию вкл).
-- ---------------------------------------------------------------------
alter table public.app_settings
  add column if not exists crypto_auto_expense boolean not null default true;

-- ---------------------------------------------------------------------
-- Индексы для скорости
-- ---------------------------------------------------------------------
create index if not exists idx_crypto_assets_user on public.crypto_assets (user_id);
create index if not exists idx_crypto_assets_portfolio on public.crypto_assets (user_id, portfolio, status);
create index if not exists idx_crypto_tx_user on public.crypto_transactions (user_id);
create index if not exists idx_crypto_tx_asset on public.crypto_transactions (asset_id);
create index if not exists idx_crypto_tx_expense on public.crypto_transactions (expense_id);
create index if not exists idx_crypto_futures_user on public.crypto_futures (user_id, status);
create index if not exists idx_crypto_monthly_user on public.crypto_monthly (user_id, year, month);

-- =====================================================================
-- RLS: каждый видит и меняет только свои данные
-- =====================================================================
alter table public.crypto_assets enable row level security;
alter table public.crypto_transactions enable row level security;
alter table public.crypto_futures enable row level security;
alter table public.crypto_monthly enable row level security;

drop policy if exists "own crypto_assets" on public.crypto_assets;
create policy "own crypto_assets" on public.crypto_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own crypto_transactions" on public.crypto_transactions;
create policy "own crypto_transactions" on public.crypto_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own crypto_futures" on public.crypto_futures;
create policy "own crypto_futures" on public.crypto_futures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own crypto_monthly" on public.crypto_monthly;
create policy "own crypto_monthly" on public.crypto_monthly
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
