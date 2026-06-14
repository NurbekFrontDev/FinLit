-- Связь целей/желаний с расходами.
-- Когда желание/цель отмечается как «Куплено» с записью в расходы,
-- в goals.expense_id сохраняется id созданного расхода (без дублирования).
-- Если расход удаляют напрямую — связь обнуляется (on delete set null).
alter table goals
  add column if not exists expense_id uuid references expenses(id) on delete set null;
