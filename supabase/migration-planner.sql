-- =====================================================================
-- Nucleus -- Планировщик (П-2: база данных)
-- Ежедневный to-do с авто-повтором по дням недели и привычками
-- (по «Атомным привычкам»), плюс заметки фокус-сессий Помодоро.
-- Выполнить ОДИН раз в Supabase: SQL Editor -> New query -> вставить и Run.
-- Безопасно запускать повторно (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Дни недели везде в формате ISO: 1=Пн, 2=Вт, ... 7=Вс.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ДЕЛА И ПРИВЫЧКИ (определение элемента; конкретные дни -- в логах/повторе)
--    type:        'task' (обычное дело) или 'habit' (привычка со стриком).
--    repeat_rule: 'none'     -- разовое дело на дату start_date
--                 'daily'    -- каждый день
--                 'weekdays' -- по будням (Пн-Пт)
--                 'weekly'   -- по выбранным дням недели (см. weekdays)
--    weekdays:    массив дней ISO (1=Пн..7=Вс) для repeat_rule='weekly'.
--                 Пример: спортзал Пн+Чт -> '{1,4}'.
--    time_of_day: секция дня 'morning'/'day'/'evening' (необязательно).
--    at_time_start/at_time_end: время или интервал в формате 'HH:MM'
--                 (например 09:00-10:00). Можно только начало.
--    priority:    'none'/'low'/'medium'/'high' (простая метка приоритета).
--    eisenhower:  квадрант матрицы (на потом): 'do'/'plan'/'delegate'/'drop'.
--    start_date:  дата разового дела или дата, с которой начинается повтор.
--    Поля привычек (по «Атомным привычкам», заполняются только для habit):
--      cue        -- триггер: когда/где (2-й закон: сделать очевидным)
--      stack_after-- сцепка: «после того как я ...»
--      identity   -- личность: «я человек, который ...»
--      two_min    -- версия привычки на 2 минуты
--      goal_target-- цель по стрику (число дней), необязательно
-- ---------------------------------------------------------------------
create table if not exists public.planner_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text,
  type text not null default 'task' check (type in ('task', 'habit')),
  repeat_rule text not null default 'none'
    check (repeat_rule in ('none', 'daily', 'weekdays', 'weekly')),
  weekdays int[] not null default '{}',
  time_of_day text check (time_of_day in ('morning', 'day', 'evening')),
  at_time_start text,
  at_time_end text,
  priority text not null default 'none'
    check (priority in ('none', 'low', 'medium', 'high')),
  eisenhower text check (eisenhower in ('do', 'plan', 'delegate', 'drop')),
  start_date date not null default current_date,
  icon text,
  color text,
  archived boolean not null default false,
  sort_order integer not null default 0,
  -- поля привычек
  cue text,
  stack_after text,
  identity text,
  two_min text,
  goal_target integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) ОТМЕТКИ ПО ДНЯМ (выполнение дела/привычки на конкретную дату).
--    status: 'done' (сделано), 'skip' (осознанный пропуск -- НЕ ломает
--            стрик, «не пропускай дважды»), 'fail' (пропуск/срыв).
--    value:  числовое значение для измеримых привычек (кол-во, минуты).
--    Одна отметка на дело в день -> unique (user_id, item_id, date).
-- ---------------------------------------------------------------------
create table if not exists public.planner_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.planner_items(id) on delete cascade,
  date date not null default current_date,
  status text not null default 'done' check (status in ('done', 'skip', 'fail')),
  value numeric(14,2),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, item_id, date)
);

-- ---------------------------------------------------------------------
-- 3) ПОРЯДОК ДЕЛ ВНУТРИ ДНЯ (ручная сортировка на конкретную дату).
--    Позволяет в разные дни ставить одни и те же дела в своём порядке.
--    Если для дня записи нет -- используется sort_order из planner_items.
--    Одна запись на дело в день -> unique (user_id, item_id, date).
-- ---------------------------------------------------------------------
create table if not exists public.planner_day_order (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.planner_items(id) on delete cascade,
  date date not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, item_id, date)
);

-- ---------------------------------------------------------------------
-- 4) СЕССИИ ПОМОДОРО (учёт фокуса).
--    item_id: к какому делу относится сессия (необязательно).
--    kind:    'focus' (фокус), 'break' (короткий перерыв),
--             'long_break' (длинный перерыв после нескольких циклов).
--    duration_min: длительность сессии в минутах.
--    completed: завершена ли сессия (для честной статистики фокуса).
-- ---------------------------------------------------------------------
create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.planner_items(id) on delete set null,
  started_at timestamptz not null default now(),
  duration_min integer not null default 25,
  kind text not null default 'focus' check (kind in ('focus', 'break', 'long_break')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) НАСТРОЙКИ ПЛАНИРОВЩИКА в app_settings
--    planner_day_sections: показывать секции Утро/День/Вечер (по умолч. выкл).
--    pomo_*: параметры таймера Помодоро.
-- ---------------------------------------------------------------------
alter table public.app_settings
  add column if not exists planner_day_sections boolean not null default false;
alter table public.app_settings
  add column if not exists pomo_focus_min integer not null default 25;
alter table public.app_settings
  add column if not exists pomo_break_min integer not null default 5;
alter table public.app_settings
  add column if not exists pomo_long_break_min integer not null default 15;
alter table public.app_settings
  add column if not exists pomo_cycles integer not null default 4;

-- ---------------------------------------------------------------------
-- Индексы для скорости
-- ---------------------------------------------------------------------
create index if not exists idx_planner_items_user on public.planner_items (user_id, archived);
create index if not exists idx_planner_items_type on public.planner_items (user_id, type, archived);
create index if not exists idx_planner_logs_user on public.planner_logs (user_id);
create index if not exists idx_planner_logs_item on public.planner_logs (item_id);
create index if not exists idx_planner_logs_date on public.planner_logs (user_id, date);
create index if not exists idx_planner_day_order_date on public.planner_day_order (user_id, date);
create index if not exists idx_pomodoro_user on public.pomodoro_sessions (user_id, started_at);
create index if not exists idx_pomodoro_item on public.pomodoro_sessions (item_id);

-- =====================================================================
-- RLS: каждый видит и меняет только свои данные
-- =====================================================================
alter table public.planner_items enable row level security;
alter table public.planner_logs enable row level security;
alter table public.planner_day_order enable row level security;
alter table public.pomodoro_sessions enable row level security;

drop policy if exists "own planner_items" on public.planner_items;
create policy "own planner_items" on public.planner_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own planner_logs" on public.planner_logs;
create policy "own planner_logs" on public.planner_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own planner_day_order" on public.planner_day_order;
create policy "own planner_day_order" on public.planner_day_order
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own pomodoro_sessions" on public.pomodoro_sessions;
create policy "own pomodoro_sessions" on public.pomodoro_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
