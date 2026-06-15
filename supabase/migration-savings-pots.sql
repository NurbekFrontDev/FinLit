-- =====================================================================
-- FinLit — Копилки: подушка безопасности и свободные накопления
-- Запустить ОДИН раз в Supabase (SQL Editor -> New query -> Run),
-- затем задеплоить фронтенд.
-- =====================================================================
--
-- Идея: «Уже отложено» теперь реальный баланс копилок за всё время.
--   Пополнение копилки   = расход в категории Сбережения/Инвестиции
--                          (paid_from_pot остаётся NULL).
--   Снятие из копилки    = обычный расход, помеченный paid_from_pot
--                          ('cushion' — из подушки, 'free' — из накоплений).
--                          Он остаётся реальным расходом, но уменьшает баланс.
--
-- Добавляем один столбец к расходам. NULL = обычный расход (не из копилки).

alter table public.expenses
  add column if not exists paid_from_pot text;

-- Разрешаем только два значения (или NULL). CHECK пропускает NULL.
alter table public.expenses
  drop constraint if exists expenses_paid_from_pot_check;
alter table public.expenses
  add constraint expenses_paid_from_pot_check
  check (paid_from_pot in ('cushion', 'free'));
