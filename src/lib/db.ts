import { supabase } from './supabase'

export type MonthRow = {
  id: string
  user_id: string
  year: number
  month: number
  planned_income: number
}

// Находит месяц пользователя или создаёт его, если ещё нет.
export async function getOrCreateMonth(
  userId: string,
  year: number,
  month: number,
): Promise<MonthRow> {
  const { data: existing, error } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing as MonthRow

  const { data: created, error: insErr } = await supabase
    .from('months')
    .insert({ user_id: userId, year, month, planned_income: 0 })
    .select('*')
    .single()
  if (insErr) throw insErr
  return created as MonthRow
}

export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

// Форматирует число в вид «5 000 000 сум».
export function formatSum(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value)) + ' сум'
}
