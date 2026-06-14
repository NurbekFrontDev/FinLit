import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { formatSum, formatAmountInput, parseAmount, monthsUntil } from '../lib/db'

type Goal = {
  id: string
  name: string
  note: string | null
  target_amount: number
  target_date: string | null
  is_goal: boolean
  done: boolean
  created_at: string
}
type Contribution = { id: string; goal_id: string; amount: number; date: string }

const GOAL_COLS = 'id, name, note, target_amount, target_date, is_goal, done, created_at'

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950'
const btnPrimary =
  'rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400'
const btnGhost =
  'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const btnMuted =
  'text-sm text-neutral-500 transition hover:text-red-500 dark:hover:text-red-400'

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [contribs, setContribs] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const [goalFormId, setGoalFormId] = useState<string | null>(null)
  const [goalTarget, setGoalTarget] = useState('')
  const [goalDate, setGoalDate] = useState('')

  const [contribFormId, setContribFormId] = useState<string | null>(null)
  const [contribAmount, setContribAmount] = useState('')
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const [gRes, cRes] = await Promise.all([
          supabase
            .from('goals')
            .select(GOAL_COLS)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('goal_contributions')
            .select('id, goal_id, amount, date')
            .eq('user_id', user.id),
        ])
        if (!active) return
        if (gRes.error) throw gRes.error
        if (cRes.error) throw cRes.error
        setGoals((gRes.data ?? []) as Goal[])
        setContribs((cRes.data ?? []) as Contribution[])
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  const savedFor = (goalId: string) =>
    contribs.filter((c) => c.goal_id === goalId).reduce((s, c) => s + Number(c.amount), 0)

  const addWish = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim()) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name: name.trim(),
        note: note.trim() || null,
        target_amount: parseAmount(price),
        is_goal: false,
        done: false,
      })
      .select(GOAL_COLS)
      .single()
    setBusy(false)
    if (error || !data) {
      setError(error?.message ?? 'Не удалось добавить')
      return
    }
    setGoals([data as Goal, ...goals])
    setName('')
    setPrice('')
    setNote('')
  }

  const openGoalForm = (g: Goal) => {
    setGoalFormId(g.id)
    setGoalTarget(g.target_amount ? formatAmountInput(String(g.target_amount)) : '')
    setGoalDate(g.target_date ?? '')
    setError(null)
  }

  const makeGoal = async (id: string) => {
    const target = parseAmount(goalTarget)
    if (!target) {
      setError('Укажи сумму цели')
      return
    }
    const { data, error } = await supabase
      .from('goals')
      .update({ target_amount: target, target_date: goalDate || null, is_goal: true })
      .eq('id', id)
      .select(GOAL_COLS)
      .single()
    if (error || !data) {
      setError(error?.message ?? 'Ошибка')
      return
    }
    setGoals(goals.map((g) => (g.id === id ? (data as Goal) : g)))
    setGoalFormId(null)
  }

  const addContribution = async (goalId: string) => {
    if (!user) return
    const value = parseAmount(contribAmount)
    if (!value) {
      setError('Укажи сумму')
      return
    }
    const { data, error } = await supabase
      .from('goal_contributions')
      .insert({ user_id: user.id, goal_id: goalId, amount: value, date: contribDate })
      .select('id, goal_id, amount, date')
      .single()
    if (error || !data) {
      setError(error?.message ?? 'Ошибка')
      return
    }
    setContribs([...contribs, data as Contribution])
    setContribFormId(null)
    setContribAmount('')
  }

  const removeContribution = async (id: string) => {
    const { error } = await supabase.from('goal_contributions').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setContribs(contribs.filter((c) => c.id !== id))
  }

  const setDone = async (g: Goal, done: boolean) => {
    const { data, error } = await supabase
      .from('goals')
      .update({ done })
      .eq('id', g.id)
      .select(GOAL_COLS)
      .single()
    if (error || !data) {
      setError(error?.message ?? 'Ошибка')
      return
    }
    setGoals(goals.map((x) => (x.id === g.id ? (data as Goal) : x)))
  }

  const removeGoal = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setGoals(goals.filter((g) => g.id !== id))
    setContribs(contribs.filter((c) => c.goal_id !== id))
  }

  const activeGoals = goals.filter((g) => g.is_goal && !g.done)
  const wishes = goals.filter((g) => !g.is_goal && !g.done)
  const doneItems = goals.filter((g) => g.done)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">🎯 Цели и желания</h1>

      <form
        onSubmit={addWish}
        className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <p className="text-sm font-medium">➕ Добавить в список желаний</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Что хочу (напр. iPhone, визит к стоматологу)"
          className={inputCls}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(formatAmountInput(e.target.value))}
            placeholder="Примерная цена (необязательно)"
            className={inputCls}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка (необязательно)"
            className={inputCls}
          />
        </div>
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? 'Добавление…' : 'Добавить'}
        </button>
      </form>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Загрузка…</p>
      ) : (
        <>
          {/* Активные цели */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">🎯 Активные цели</h2>
            {activeGoals.length === 0 ? (
              <p className="text-sm text-neutral-500">Пока нет активных целей. Преврати желание в цель ниже 👇</p>
            ) : (
              activeGoals.map((g) => {
                const saved = savedFor(g.id)
                const pct = g.target_amount > 0 ? Math.min(100, (saved / g.target_amount) * 100) : 0
                const remaining = Math.max(0, g.target_amount - saved)
                const months = monthsUntil(g.target_date)
                const perMonth = months > 0 ? remaining / months : 0
                const goalContribs = contribs.filter((c) => c.goal_id === g.id)
                return (
                  <div
                    key={g.id}
                    className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{g.name}</p>
                        {g.target_date && (
                          <p className="text-xs text-neutral-500">до {g.target_date}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div className="h-full rounded-full bg-emerald-500" style={ { width: `${pct}%` } } />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-neutral-500">Собрано</p>
                        <p className="font-medium text-emerald-600 dark:text-emerald-400">{formatSum(saved)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Осталось</p>
                        <p className="font-medium">{formatSum(remaining)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">В месяц</p>
                        <p className="font-medium">{months > 0 ? formatSum(perMonth) : '—'}</p>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500">Цель: {formatSum(g.target_amount)}</p>

                    {contribFormId === g.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          inputMode="numeric"
                          value={contribAmount}
                          onChange={(e) => setContribAmount(formatAmountInput(e.target.value))}
                          placeholder="Сколько отложить"
                          className={inputCls}
                        />
                        <input
                          type="date"
                          value={contribDate}
                          onChange={(e) => setContribDate(e.target.value)}
                          className={inputCls}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => addContribution(g.id)} className={btnPrimary}>
                            Отложить
                          </button>
                          <button onClick={() => setContribFormId(null)} className={btnGhost}>
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => {
                            setContribFormId(g.id)
                            setContribAmount('')
                            setError(null)
                          }}
                          className={btnPrimary}
                        >
                          💰 Отложить
                        </button>
                        <button onClick={() => setDone(g, true)} className={btnGhost}>
                          ✅ Готово
                        </button>
                        <button onClick={() => removeGoal(g.id)} className={btnMuted}>
                          Удалить
                        </button>
                      </div>
                    )}

                    {goalContribs.length > 0 && (
                      <details className="text-xs text-neutral-500">
                        <summary className="cursor-pointer">Вклады ({goalContribs.length})</summary>
                        <div className="mt-2 flex flex-col gap-1">
                          {goalContribs.map((c) => (
                            <div key={c.id} className="flex items-center justify-between">
                              <span>
                                {c.date} · {formatSum(Number(c.amount))}
                              </span>
                              <button
                                onClick={() => removeContribution(c.id)}
                                className="transition hover:text-red-500 dark:hover:text-red-400"
                              >
                                Удалить
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )
              })
            )}
          </section>

          {/* Список желаний */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">🛒 Хочу купить</h2>
            {wishes.length === 0 ? (
              <p className="text-sm text-neutral-500">Список пуст. Добавь что-нибудь сверху ☝️</p>
            ) : (
              wishes.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{g.name}</p>
                    {g.note && <p className="text-xs text-neutral-500">{g.note}</p>}
                    {g.target_amount > 0 && (
                      <p className="text-xs text-neutral-500">≈ {formatSum(g.target_amount)}</p>
                    )}
                  </div>
                  {goalFormId === g.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          inputMode="numeric"
                          value={goalTarget}
                          onChange={(e) => setGoalTarget(formatAmountInput(e.target.value))}
                          placeholder="Сумма цели"
                          className={inputCls}
                        />
                        <input
                          type="date"
                          value={goalDate}
                          onChange={(e) => setGoalDate(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => makeGoal(g.id)} className={btnPrimary}>
                          Сделать целью
                        </button>
                        <button onClick={() => setGoalFormId(null)} className={btnGhost}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => openGoalForm(g)} className={btnPrimary}>
                        🎯 Сделать целью
                      </button>
                      <button onClick={() => setDone(g, true)} className={btnGhost}>
                        ✅ Куплено
                      </button>
                      <button onClick={() => removeGoal(g.id)} className={btnMuted}>
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>

          {/* Достигнуто */}
          {doneItems.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">✅ Достигнуто / куплено</h2>
              {doneItems.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 opacity-70 dark:border-neutral-800 dark:bg-neutral-900/40"
                >
                  <span className="text-sm line-through">{g.name}</span>
                  <div className="flex shrink-0 gap-3 text-sm text-neutral-500">
                    <button onClick={() => setDone(g, false)} className="transition hover:text-neutral-900 dark:hover:text-neutral-100">
                      Вернуть
                    </button>
                    <button onClick={() => removeGoal(g.id)} className="transition hover:text-red-500 dark:hover:text-red-400">
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
