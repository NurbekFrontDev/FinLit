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

// Форматирует ввод суммы с пробелами по тысячам: "1000000" -> "1 000 000".
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Парсит отформатированную сумму обратно в число.
export function parseAmount(formatted: string): number {
  const digits = formatted.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

// Пресеты подкатегорий расходов по названию категории (можно дополнять своими).
export const SUBCATEGORY_PRESETS: Record<string, string[]> = {
  'Обязательные': ['Аренда жилья', 'Коммуналка', 'Интернет', 'Связь', 'Продукты', 'Транспорт', 'Здоровье'],
  'Цели/Хотелки': ['Одежда', 'Кафе и рестораны', 'Развлечения', 'Путешествия', 'Техника', 'Подарки'],
  'Долги': ['Кредит', 'Рассрочка', 'Долг другу'],
  'Свободные': ['Подписки', 'Хобби', 'Разное'],
  'Сбережения': ['Подушка безопасности', 'Накопления'],
  'Инвестиции': ['Акции', 'Криптовалюта', 'Вклад'],
}

// Пресеты источников дохода (можно дополнять своими).
export const INCOME_SOURCE_PRESETS = [
  'Зарплата',
  'Аванс',
  'Фриланс',
  'Подработка',
  'Бизнес',
  'Проценты по вкладу',
  'Подарок',
  'Возврат долга',
  'Другое',
]

// ===== Мультивалюта =====
// Базовая валюта приложения. Все суммы в БД хранятся в ней (сум).
export const BASE_CURRENCY = 'UZS'

export type Currency = {
  id?: string
  code: string
  symbol: string | null
  rate_to_base: number
}

// Загружает валюты пользователя и гарантирует наличие базовой (сум).
export async function loadCurrencies(userId: string): Promise<Currency[]> {
  const { data, error } = await supabase
    .from('currencies')
    .select('id, code, symbol, rate_to_base')
    .eq('user_id', userId)
    .order('code')
  if (error) throw error
  const list = (data ?? []) as Currency[]
  if (!list.some((c) => c.code === BASE_CURRENCY)) {
    list.unshift({ code: BASE_CURRENCY, symbol: 'сум', rate_to_base: 1 })
  }
  return list
}

// Курс валюты к базовой (для базовой = 1).
export function rateOf(currencies: Currency[], code: string): number {
  if (code === BASE_CURRENCY) return 1
  return Number(currencies.find((c) => c.code === code)?.rate_to_base) || 1
}

// Сколько целых месяцев от сегодня до даты (минимум 1). 0 если даты нет.
export function monthsUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  const now = new Date()
  const target = new Date(dateStr)
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth())
  return Math.max(1, months)
}
