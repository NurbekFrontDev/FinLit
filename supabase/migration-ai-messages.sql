-- =====================================================================
-- FinLit -- Этап ИИ-3: история чата с ассистентом
-- Выполнить в Supabase: SQL Editor -> New query -> вставить и Run.
-- Хранит переписку пользователя с «FinLit Бухгалтером».
-- =====================================================================

-- Сообщения чата: по одной строке на реплику.
-- role: 'user' (сообщение пользователя) или 'assistant' (ответ ИИ).
-- provider/model заполняются только у ответов ассистента (какой мозг ответил).
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  provider text,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_user_created on public.ai_messages (user_id, created_at);

alter table public.ai_messages enable row level security;

drop policy if exists "own ai_messages" on public.ai_messages;
create policy "own ai_messages" on public.ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
