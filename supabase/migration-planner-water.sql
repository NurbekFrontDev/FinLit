-- Nucleus — трекер питьевой воды.
-- Хранится в planner_items как специальный тип (water).
-- Настройки цели по воде — в app_settings (water_goal).
-- Безопасно запускать повторно.

alter table public.app_settings
  add column if not exists water_goal integer not null default 2000;
