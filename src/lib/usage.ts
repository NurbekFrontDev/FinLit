import { supabase } from './supabase'

// Использование и лимиты бесплатных тарифов Supabase и Vercel.
// Данные собирает серверная функция get-usage (токены лежат в секретах Supabase,
// в браузер не попадают). usedBytes === null означает, что живой цифры нет —
// показываем только лимит и ссылку на дашборд.

export type UsageMetric = {
  usedBytes: number | null
  limitBytes: number
  live: boolean
}

export type Usage = {
  db: UsageMetric
  storage: UsageMetric
  egress: UsageMetric
  vercel: UsageMetric
  updatedAt: string
}

export async function loadUsage(): Promise<Usage | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-usage', { body: {} })
    if (error || !data) return null
    return data as Usage
  } catch {
    return null
  }
}
