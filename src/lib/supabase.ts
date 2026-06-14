import { createClient } from '@supabase/supabase-js'

// Ключи берутся из файла .env (он не попадает в GitHub)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Не заданы переменные окружения VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Проверь файл .env в корне проекта.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
