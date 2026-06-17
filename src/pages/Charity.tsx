import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import DatePicker from '../components/DatePicker'
import { useLang } from '../lib/i18n'
import {
  formatSum,
  formatAmountInput,
  parseAmount,
  monthsUntil,
  formatDateHuman,
  getOrCreateMonth,
  isCharityCategory,
  loadCharityPots,
  loadCharitySplit,
  saveCharitySplit,
  loadCharityGoal,
  saveCharityGoal,
  DEFAULT_CHARITY_SPLIT,
  type CharityPotsStats,
} from '../lib/db'

type Category = { id: string; name: string; percent?: number; archived?: boolean }

const fieldBase =
  'rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700 dark:bg-neutral-950'
const inputCls = 'w-full ' + fieldBase
const btnPrimary =
  'rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-400'
const btnGhost =
  'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const sectionTitle = 'text-xl font-semibold'

export default function Charity() {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [received, setReceived] = useState(0)
  const [pots, setPots] = useState<CharityPotsStats>({ big: 0, small: 0, total: 0 })
  const [split, setSplit] = useState(DEFAULT_CHARITY_SPLIT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState(0)
  const [goalDate, setGoalDate] = useState<string | null>(null)

  const [editGoal, setEditGoal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formTarget, setFormTarget] = useState('')
  const [formDate, setFormDate] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const now = new Date()
        const m = await getOrCreateMonth(user.id, now.getFullYear(), now.getMonth() + 1)
        const [catRes, incRes, potsVal, splitVal, goalVal] = await Promise.all([
          supabase
            .from('categories')
            .select('id, name, percent, archived')
            .eq('user_id', user.id)
            .order('sort_order'),
          supabase.from('incomes').select('amount').eq('month_id', m.id),
          loadCharityPots(user.id),
          loadCharitySplit(user.id),
          loadCharityGoal(user.id),
        ])
        if (!active) return
        if (catRes.error) throw catRes.error
        if (incRes.error) throw incRes.error
        setCategories((catRes.data ?? []) as Category[])
        setReceived(
          (incRes.data ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0),
        )
        setPots(potsVal)
        setSplit(splitVal)
        setGoalName(goalVal.name)
        setGoalTarget(goalVal.target)
        setGoalDate(goalVal.date)
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

  const saveSplit = async () => {
    if (!user) return
    await saveCharitySplit(user.id, split)
  }

  const charityCat = categories.find((c) => !c.archived && isCharityCategory(c.name))
  const charityPercent = charityCat ? Number(charityCat.percent ?? 0) : 0
  const charityBudget = (received * charityPercent) / 100
  const bigBudget = (charityBudget * split) / 100
  const smallBudget = (charityBudget * (100 - split)) / 100

  const pct = goalTarget > 0 ? Math.min(100, (pots.big / goalTarget) * 100) : 0
  const remaining = Math.max(0, goalTarget - pots.big)
  const months = monthsUntil(goalDate)
  const perMonth = months > 0 ? remaining / months : 0

  const openGoalForm = () => {
    setFormName(goalName)
    setFormTarget(goalTarget > 0 ? formatAmountInput(String(goalTarget)) : '')
    setFormDate(goalDate ?? '')
    setEditGoal(true)
    setError(null)
  }

  const submitGoal = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const target = parseAmount(formTarget)
    const goal = { name: formName.trim(), target, date: formDate || null }
    try {
      await saveCharityGoal(user.id, goal)
      setGoalName(goal.name)
      setGoalTarget(goal.target)
      setGoalDate(goal.date)
      setEditGoal(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const hasGoal = goalTarget > 0 || goalName.trim().length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="self-start text-sm text-neutral-500 transition hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {t('charity.back')}
        </button>
        <h1 className="text-2xl font-semibold">{t('charity.title')}</h1>
      </div>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">{t('common.loading')}</p>
      ) : error ? (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      ) : (
        <>
          {/* Текущий баланс копилки по двум частям */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 dark:border-rose-500/20">
              <p className="text-sm font-medium">{t('charity.bigTitle')}</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {formatSum(pots.big)}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 dark:border-rose-500/20">
              <p className="text-sm font-medium">{t('charity.smallTitle')}</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {formatSum(pots.small)}
              </p>
            </div>
          </div>

          {/* Распределение 5% (как 80/20 в «Целях») */}
          <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <h2 className={sectionTitle}>{t('charity.split')}</h2>
            {charityCat ? (
              <>
                <p className="text-sm">{t('charity.budget', { v: formatSum(charityBudget) })}</p>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div className="h-full bg-rose-500" style={{ width: `${split}%` }} />
                  <div className="h-full bg-rose-300" style={{ width: `${100 - split}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-neutral-500">{t('charity.splitBig', { a: split })}</p>
                    <p className="font-medium text-rose-600 dark:text-rose-400">{formatSum(bigBudget)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-neutral-500">{t('charity.splitSmall', { b: 100 - split })}</p>
                    <p className="font-medium text-rose-500 dark:text-rose-300">{formatSum(smallBudget)}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('charity.noCat')}</p>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">{t('charity.bigShare')}</label>
              <input
                inputMode="numeric"
                value={String(split)}
                onChange={(e) =>
                  setSplit(Math.max(0, Math.min(100, Number(e.target.value.replace(/[^\d]/g, '')) || 0)))
                }
                onBlur={saveSplit}
                className="w-16 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-center text-sm outline-none focus:border-rose-500 dark:border-neutral-700 dark:bg-neutral-950"
              />
              <span className="text-xs text-neutral-500">/ {100 - split}%</span>
            </div>
          </section>

          {/* Крупное пожертвование (цель с прогрессом) */}
          <section className="flex flex-col gap-3">
            <h2 className={sectionTitle}>{t('charity.bigTitle')}</h2>
            <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/5 p-4 dark:bg-rose-500/10">
              {editGoal ? (
                <form onSubmit={submitGoal} className="flex flex-col gap-2">
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('charity.goalName')}
                    className={inputCls}
                  />
                  <input
                    inputMode="decimal"
                    value={formTarget}
                    onChange={(e) => setFormTarget(formatAmountInput(e.target.value))}
                    placeholder={t('charity.goalAmount')}
                    className={inputCls}
                  />
                  <DatePicker value={formDate} onChange={setFormDate} />
                  {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className={btnPrimary}>
                      {t('charity.saveGoal')}
                    </button>
                    <button type="button" onClick={() => setEditGoal(false)} className={btnGhost}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              ) : hasGoal ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {goalName && <p className="font-medium">{goalName}</p>}
                      {goalDate && (
                        <p className="text-xs text-neutral-500">{t('charity.by', { d: formatDateHuman(goalDate) })}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-rose-600 dark:text-rose-400">
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-neutral-500">{t('charity.collected')}</p>
                      <p className="font-medium text-rose-600 dark:text-rose-400">{formatSum(pots.big)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">{t('charity.left')}</p>
                      <p className="font-medium">{formatSum(remaining)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">{t('charity.perMonth')}</p>
                      <p className="font-medium">{months > 0 ? formatSum(perMonth) : '—'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">{t('charity.target', { v: formatSum(goalTarget) })}</p>
                  {bigBudget > 0 && (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      {t('charity.monthToBig', { v: formatSum(bigBudget) })}
                    </p>
                  )}
                  <button type="button" onClick={openGoalForm} className={btnGhost + ' self-start'}>
                    {t('charity.editGoal')}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-neutral-500">{t('charity.noGoal')}</p>
                  <p className="text-xs text-neutral-500">{t('charity.inPot', { v: formatSum(pots.big) })}</p>
                  <button type="button" onClick={openGoalForm} className={btnPrimary + ' self-start'}>
                    {t('charity.setGoal')}
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Маленькие пожертвования */}
          <section className="flex flex-col gap-3">
            <hr className="border-neutral-200 dark:border-neutral-800" />
            <h2 className={sectionTitle}>{t('charity.smallTitle')}</h2>
            <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400">{formatSum(pots.small)}</p>
              {smallBudget > 0 && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {t('charity.monthToSmall', { v: formatSum(smallBudget) })}
                </p>
              )}
              <p className="text-xs text-neutral-500">{t('charity.smallHint')}</p>
            </div>
          </section>

          {/* Как пополнять и жертвовать */}
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300">
            {t('charity.howto')}
          </p>
        </>
      )}
    </div>
  )
}
