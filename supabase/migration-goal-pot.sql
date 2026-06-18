-- =====================================================================
-- FinLit -- Снятие из накоплений на цель (paid_from_pot = 'goals')
-- Запустить ОДИН раз в Supabase (SQL Editor -> New query -> Run),
-- затем задеплоить фронтенд.
-- =====================================================================
--
-- Идея: материальную цель копят вкладами (goal_contributions). Эти вклады уже
-- учтены в бюджете «Цели» в те месяцы, когда их откладывали. В день покупки
-- запись расхода помечается paid_from_pot = 'goals': деньги берутся из
-- накоплений на цель, поэтому покупка НЕ удваивает бюджет (не входит в
-- «План против факта» и в карточку «Расходы»), но остаётся реальным расходом
-- в списке расходов и в истории.
--
-- Расширяем разрешённые значения paid_from_pot, добавляя 'goals'.

alter table public.expenses
  drop constraint if exists expenses_paid_from_pot_check;
alter table public.expenses
  add constraint expenses_paid_from_pot_check
  check (paid_from_pot in ('cushion', 'free', 'charity', 'goals'));
