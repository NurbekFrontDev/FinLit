-- Миграция: подкатегория для целей/желаний (список «Хочу купить»).
-- Запусти этот файл в Supabase → SQL Editor один раз.

alter table goals add column if not exists subcategory text;
