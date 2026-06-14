-- Миграция: категория важности для целей/желаний.
-- Запусти этот файл в Supabase → SQL Editor один раз.

alter table goals add column if not exists category text default 'Цели и хотелки';
