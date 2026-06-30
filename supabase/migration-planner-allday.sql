-- Планировщик: новый раздел дня 'allday' / «Весь день».
-- Обновляет ограничение planner_items.time_of_day.
-- Безопасно запускать повторно.

alter table public.planner_items
  drop constraint if exists planner_items_time_of_day_check;

alter table public.planner_items
  add constraint planner_items_time_of_day_check
  check (time_of_day in ('morning', 'day', 'evening', 'allday'));
