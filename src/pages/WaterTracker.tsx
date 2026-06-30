import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useLang } from '../lib/i18n'
import {
  loadWaterDay,
  saveWaterGoal,
  addWaterLog,
  removeWaterLog,
  QUICK_VOLUMES,
  type WaterDay,
  type WaterLog,
} from '../lib/water'
import { todayStr } from '../lib/planner'

// Трекер питьевой воды (💧). Вдохновлён WaterMinder / MapMyRun.
// Прогресс-бар в голубых тонах, быстрые кнопки-объёмы (как «чашки»),
// список выпитого за сегодня, настройка дневной цели.

const cardCls =
  'rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50'

// Голубая палитра для воды
const waterBg = 'from-sky-400 to-blue-500'
const waterBtn = 'border-sky-300 text-sky-600 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400 dark:hover:bg-sky-500/10'

// 12-часовой формат из "HH:MM"
function fmtTime12(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return hhmm
  const pm = h >= 12
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
}

export default function WaterTracker() {
  const { user } = useAuth()
  const { t } = useLang()
  const today = todayStr()

  const [day, setDay] = useState<WaterDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [goalEdit, setGoalEdit] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const [customMl, setCustomMl] = useState('')

  const reload = async () => {
    if (!user) return
    const d = await loadWaterDay(user.id, today)
    setDay(d)
    setGoalDraft(String(d.goal))
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const drunk = day?.drunk ?? 0
  const goal = day?.goal ?? 2000
  const pct = goal > 0 ? Math.min(100, Math.round((drunk / goal) * 100)) : 0
  const remaining = Math.max(0, goal - drunk)
  const glasses = Math.round(goal / 250)
  const drunkGlasses = Math.round(drunk / 250)

  const quickAdd = async (ml: number) => {
    if (!user) return
    try {
      const log = await addWaterLog(user.id, today, ml)
      setDay((prev) =>
        prev
          ? { ...prev, drunk: prev.drunk + ml, logs: [log, ...prev.logs] }
          : null,
      )
    } catch {
      // ignore
    }
  }

  const addCustom = async () => {
    const ml = Number(customMl)
    if (!ml || ml <= 0) return
    await quickAdd(ml)
    setCustomMl('')
  }

  const removeLog = async (log: WaterLog) => {
    if (!user) return
    try {
      await removeWaterLog(user.id, log.id)
      setDay((prev) =>
        prev
          ? {
              ...prev,
              drunk: Math.max(0, prev.drunk - log.amount),
              logs: prev.logs.filter((l) => l.id !== log.id),
            }
          : null,
      )
    } catch {
      // ignore
    }
  }

  const saveGoal = async () => {
    const v = Number(goalDraft)
    if (!user || !v || v <= 0) return
    await saveWaterGoal(user.id, v)
    setDay((prev) => (prev ? { ...prev, goal: v } : null))
    setGoalEdit(false)
  }

  const isFull = pct >= 100

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">💧 {t('water.title')}</h1>

      {loading ? (
        <p className="text-sm text-neutral-500">{t('common.loading')}</p>
      ) : (
        <>
          {/* Карточка прогресса (голубая) */}
          <div
            className={`${cardCls} flex flex-col items-center gap-3 bg-gradient-to-b ${waterBg} border-sky-400/30 text-white`}
          >
            {/* Стаканы визуально */}
            <div className="flex flex-wrap justify-center gap-1">
              {Array.from({ length: glasses }).map((_, i) => (
                <span
                  key={i}
                  className={`text-3xl transition ${
                    i < drunkGlasses ? 'opacity-100 drop-shadow-md' : 'opacity-30'
                  }`}
                >
                  🥛
                </span>
              ))}
            </div>

            {/* Процент и цифры */}
            <p className="text-4xl font-bold drop-shadow">{pct}%</p>
            <p className="text-sm opacity-90">
              {drunk} / {goal} ml
              {remaining > 0 && (
                <span className="ml-1 opacity-75">({remaining} ml {t('water.left')})</span>
              )}
            </p>

            {/* Прогресс-бар */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/30">
              <div
                className={`h-full rounded-full bg-white transition-all duration-500 ${
                  isFull ? 'animate-pulse' : ''
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {isFull && (
              <p className="text-sm font-semibold drop-shadow">{t('water.goalReached')}</p>
            )}
          </div>

          {/* Быстрые кнопки-объёмы (как «чашки» в WaterMinder) */}
          <div className={`${cardCls} flex flex-col gap-3`}>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t('water.quickAdd')}
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_VOLUMES.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => quickAdd(ml)}
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium transition active:scale-95 ${waterBtn}`}
                >
                  +{ml} ml
                </button>
              ))}
            </div>

            {/* Свой объём */}
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={customMl}
                onChange={(e) => setCustomMl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustom()
                  }
                }}
                placeholder={t('water.customMl')}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-950"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customMl}
                className="cursor-pointer rounded-lg bg-sky-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-300 disabled:opacity-50"
              >
                {t('common.add')}
              </button>
            </div>
          </div>

          {/* Дневная цель */}
          <div className={`${cardCls} flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                🎯 {t('water.dailyGoal')}
              </p>
              {!goalEdit && (
                <button
                  type="button"
                  onClick={() => setGoalEdit(true)}
                  className="cursor-pointer text-xs text-sky-500 transition hover:text-sky-400"
                >
                  {t('common.edit')}
                </button>
              )}
            </div>
            {goalEdit ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      saveGoal()
                    }
                  }}
                  className="w-28 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-950"
                />
                <span className="self-center text-sm text-neutral-400">ml</span>
                <button
                  type="button"
                  onClick={saveGoal}
                  className="cursor-pointer rounded-lg bg-sky-400 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-300"
                >
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setGoalEdit(false)}
                  className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <p className="text-lg font-semibold text-sky-600 dark:text-sky-400">
                {goal} ml · ~{glasses} 🥛
              </p>
            )}
          </div>

          {/* История сегодня */}
          {day && day.logs.length > 0 && (
            <div className={`${cardCls} flex flex-col gap-2`}>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('water.todayLogs')}
              </p>
              {day.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900/40"
                >
                  <span className="text-sm">
                    +{log.amount} ml
                    <span className="ml-2 text-xs text-neutral-400">
                      {fmtTime12(
                        new Date(log.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        }),
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLog(log)}
                    className="cursor-pointer text-xs text-red-500 transition hover:text-red-400"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
