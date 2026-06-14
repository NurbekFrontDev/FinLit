import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'
import { formatAmountInput } from '../lib/db'

type Currency = { id: string; code: string; symbol: string | null; rate_to_base: number }

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [symbol, setSymbol] = useState('')
  const [rate, setRate] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('currencies')
        .select('id, code, symbol, rate_to_base')
        .eq('user_id', user.id)
        .order('code')
      if (!active) return
      if (error) setError(error.message)
      else setCurrencies((data ?? []) as Currency[])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [user])

  const addCurrency = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const c = code.trim().toUpperCase()
    const r = Number(rate.replace(',', '.'))
    if (!c || !r || r <= 0) {
      setError('Укажи код валюты (напр. USD) и курс в сумах')
      return
    }
    const { data, error } = await supabase
      .from('currencies')
      .insert({ user_id: user.id, code: c, symbol: symbol.trim() || null, rate_to_base: r })
      .select('id, code, symbol, rate_to_base')
      .single()
    if (error || !data) {
      setError(error?.message ?? 'Не удалось добавить')
      return
    }
    setCurrencies(
      [...currencies, data as Currency].sort((a, b) => a.code.localeCompare(b.code)),
    )
    setCode('')
    setSymbol('')
    setRate('')
    setError(null)
  }

  const changeRate = (id: string, value: string) => {
    const r = Number(value.replace(',', '.')) || 0
    setCurrencies((cs) => cs.map((c) => (c.id === id ? { ...c, rate_to_base: r } : c)))
  }

  const saveRate = async (c: Currency) => {
    const { error } = await supabase
      .from('currencies')
      .update({ rate_to_base: c.rate_to_base })
      .eq('id', c.id)
    if (error) setError(error.message)
  }

  const removeCurrency = async (id: string) => {
    const { error } = await supabase.from('currencies').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setCurrencies((cs) => cs.filter((c) => c.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">⚙️ Настройки</h1>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Вошёл как</p>
        <p className="mt-1 font-medium break-all">{user?.email}</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div>
          <p className="font-medium">Тема оформления</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Сейчас: {theme === 'dark' ? 'тёмная' : 'светлая'}
          </p>
        </div>
        <button
          onClick={toggle}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {theme === 'dark' ? '☀️ Светлая' : '🌙 Тёмная'}
        </button>
      </div>

      {/* Валюты и курс */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div>
          <p className="font-medium">💱 Валюты и курс</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Базовая валюта — сум (UZS). Укажи, сколько сумов стоит 1 единица валюты.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Загрузка…</p>
        ) : currencies.length === 0 ? (
          <p className="text-sm text-neutral-500">Пока добавлен только сум. Добавь валюту ниже.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {currencies.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm font-medium">{c.code}</span>
                <span className="shrink-0 text-xs text-neutral-500">1 =</span>
                <input
                  inputMode="decimal"
                  value={String(c.rate_to_base)}
                  onChange={(e) => changeRate(c.id, e.target.value)}
                  className="w-28 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                />
                <span className="shrink-0 text-xs text-neutral-500">сум</span>
                <button
                  onClick={() => saveRate(c)}
                  className="ml-auto shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-emerald-400"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => removeCurrency(c.id)}
                  className="shrink-0 text-xs text-neutral-500 transition hover:text-red-500 dark:hover:text-red-400"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addCurrency} className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Код (USD)"
              className={inputCls}
            />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Символ ($)"
              className={inputCls}
            />
            <input
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Курс в сумах"
              className={inputCls}
            />
          </div>
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            className="self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400"
          >
            Добавить валюту
          </button>
          {rate && (
            <p className="text-xs text-neutral-500">
              Предпросмотр: 1 {code.trim().toUpperCase() || 'USD'} = {formatAmountInput(rate.replace(/\D/g, ''))} сум
            </p>
          )}
        </form>
      </div>

      <button
        onClick={() => signOut()}
        className="self-start rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-500 transition hover:bg-red-500/10 dark:text-red-400"
      >
        Выйти
      </button>
    </div>
  )
}
