import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

// Напоминалка о бэкапе раз в 30 дней.
// Дата последнего бэкапа и «отложить» хранятся В БД (таблица app_settings),
// поэтому состояние одинаковое на телефоне и на ПК.
const PERIOD_DAYS = 30
const SNOOZE_DAYS = 3
const TABLES = 'incomes, expenses, goals, goal_contributions, currencies, months, categories'
const PROJECT_REF = 'ewgrcmswwvbtoxdxkvuv'

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

const codeCls = 'rounded bg-neutral-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800'

export default function BackupReminder() {
  const { t } = useLang()
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)

  // При заходе спрашиваем БД: пора ли показывать напоминание.
  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('last_backup_at, backup_snooze_until')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!active) return
      // Таблицы может ещё не быть (миграция не применена) — просто не показываем.
      if (error) return
      const now = new Date()
      const snooze = data?.backup_snooze_until
      if (snooze && new Date(snooze).getTime() > now.getTime()) return
      const last = data?.last_backup_at
      if (!last) {
        setVisible(true)
        return
      }
      if (daysBetween(now, new Date(last)) >= PERIOD_DAYS) setVisible(true)
    })()
    return () => {
      active = false
    }
  }, [user])

  if (!visible) return null

  // «Готово» — записываем дату бэкапа в БД и сбрасываем «отложить».
  const markDone = async () => {
    setVisible(false)
    if (!user) return
    await supabase.from('app_settings').upsert(
      {
        user_id: user.id,
        last_backup_at: new Date().toISOString(),
        backup_snooze_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  }

  // «Позже» — прячем напоминалку на несколько дней (тоже в БД).
  const snoozeLater = async () => {
    setVisible(false)
    if (!user) return
    const until = new Date()
    until.setDate(until.getDate() + SNOOZE_DAYS)
    await supabase.from('app_settings').upsert(
      {
        user_id: user.id,
        backup_snooze_until: until.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  }

  return (
    <div className="fixed bottom-24 right-4 z-20 w-[calc(100vw-2rem)] max-w-sm md:bottom-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{t('backup.title')}</p>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {t('backup.sub')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          <span>{t('backup.how')}</span>
          <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        </button>

        {open && (
          <div className="mt-3 space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-100">{t('backup.way1')}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>{t('backup.way1s1')}</li>
                <li>{t('backup.way1s2', { t: TABLES })}</li>
                <li>{t('backup.way1s3')}</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-100">{t('backup.way2')}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>{t('backup.once')} <code className={codeCls}>supabase login</code></li>
                <li>{t('backup.once')} <code className={codeCls}>supabase link --project-ref {PROJECT_REF}</code></li>
                <li>{t('backup.each')} <code className={codeCls}>supabase db dump --data-only -f finlit-backup.sql</code></li>
              </ol>
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              {t('backup.warn')}
            </p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={markDone}
            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400"
          >
            {t('backup.done')}
          </button>
          <button
            onClick={snoozeLater}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-500 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {t('backup.later')}
          </button>
        </div>
      </div>
    </div>
  )
}
