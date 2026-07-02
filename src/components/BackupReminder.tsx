import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { runBackup } from '../lib/backup'

// Напоминалка о бэкапе раз в 30 дней.
// Дата последнего бэкапа и «отложить» хранятся В БД (таблица app_settings),
// поэтому состояние одинаковое на телефоне и на ПК.
// Теперь бэкап делается прямо отсюда одной кнопкой (облако Supabase + файл на
// устройство) — без PowerShell и консоли, и на телефоне, и на компьютере.
const PERIOD_DAYS = 30
const SNOOZE_DAYS = 3

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

export default function BackupReminder() {
  const { t } = useLang()
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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

  // «Сделать бэкап» — реальный бэкап одной кнопкой: облако Supabase + файл на устройство.
  const doBackup = async () => {
    if (!user || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await runBackup(user.id)
      if (res.cloud || res.file) {
        setMsg(t('backup.okMsg', { rows: String(res.rowCount) }))
        setTimeout(() => setVisible(false), 1600)
      } else {
        setMsg(t('backup.failMsg'))
      }
    } catch {
      setMsg(t('backup.failMsg'))
    } finally {
      setBusy(false)
    }
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
              {t('backup.explain')}
            </p>
          </div>
        </div>

        {msg && (
          <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {msg}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={doBackup}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? t('backup.doing') : t('backup.now')}
          </button>
          <button
            onClick={snoozeLater}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {t('backup.later')}
          </button>
        </div>
      </div>
    </div>
  )
}
