-- Миграция FinLit: подкатегории расходов и источник дохода.
-- Выполнить ОДИН раз в Supabase -> SQL Editor.

-- Подкатегория расхода (напр. "Интернет", "Продукты"). Хранится текстом.
alter table expenses add column if not exists subcategory text;

-- Источник дохода (напр. "Зарплата", "Фриланс"). Хранится текстом.
alter table incomes add column if not exists source text;
