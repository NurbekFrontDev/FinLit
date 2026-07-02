import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import Select from '../components/Select'
import CurrencyConverter from '../components/CurrencyConverter'
import UsageCard from '../components/UsageCard'
import { useLang } from '../lib/i18n'
import { loadCryptoAutoExpense, saveCryptoAutoExpense } from '../lib/db'
import { supabase } from '../lib/supabase'
import { runBackup } from '../lib/backup'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { t, lang, setLang } = useLang()

  const [cryptoAuto, setCryptoAuto] = useState(true)
  const [backupAuto, setBackupAuto] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        const v = await loadCryptoAutoExpense(user.id)
        if (active) setCryptoAuto(v)
      } catch {
        if (active) setCryptoAuto(true)
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('backup_auto')
          .eq('user_id', user.id)
          .maybeSingle()
        if (active) setBackupAuto(!!(data as { backup_auto?: boolean } | null)?.backup_auto)
      } catch {
        // оставляем выключенным
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  const toggleBackupAuto = async () => {
    if (!user) return
    const next = !backupAuto
    setBackupAuto(next)
    try {
      await supabase.from('app_settings').upsert(
        { user_id: user.id, backup_auto: next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    } catch {
      setBackupAuto(!next)
    }
  }

  const doBackup = async () => {
    if (!user || backupBusy) return
    setBackupBusy(true)
    setBackupMsg(null)
    try {
      const res = await runBackup(user.id)
      setBackupMsg(
        res.cloud || res.file
          ? t('set.backupOkMsg', { rows: String(res.rowCount) })
          : t('set.backupFailMsg'),
      )
    } catch {
      setBackupMsg(t('set.backupFailMsg'))
    } finally {
      setBackupBusy(false)
    }
  }

  const toggleCryptoAuto = async () => {
    if (!user) return
    const next = !cryptoAuto
    setCryptoAuto(next)
    try {
      await saveCryptoAutoExpense(user.id, next)
    } catch {
      setCryptoAuto(!next)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 -mx-4 border-b border-neutral-200/70 bg-white/85 px-4 py-3 backdrop-blur dark:border-neutral-800/70 dark:bg-neutral-950/85">
        <h1 className="text-2xl font-semibold">⚙️ {t('set.title')}</h1>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('set.signedInAs')}</p>
        <p className="mt-1 font-medium break-all">{user?.email}</p>
      </div>

      {/* Язык интерфейса */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="min-w-0">
          <p className="font-medium">🌐 {t('set.language')}</p>
        </div>
        <div className="shrink-0">
          <Select
            className="w-fit"
            value={lang}
            onChange={(v) => setLang(v as 'ru' | 'en')}
            options={[
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div>
          <p className="font-medium">{t('set.theme')}</p>
        </div>
        <button
          onClick={toggle}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {theme === 'dark' ? t('set.toLight') : t('set.toDark')}
        </button>
      </div>

      {/* Крипто: авто-расход при покупке */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="min-w-0">
          <p className="font-medium">🪙 {t('set.cryptoAuto')}</p>
        </div>
        <button
          onClick={toggleCryptoAuto}
          disabled={!user}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            cryptoAuto
              ? 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400'
              : 'border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
          }`}
        >
          {cryptoAuto ? t('set.cryptoAutoOn') : t('set.cryptoAutoOff')}
        </button>
      </div>

      {/* 🛡️ Бэкап данных одной кнопкой */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <p className="font-medium">🛡️ {t('set.backup')}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('set.backupHint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={doBackup}
            disabled={!user || backupBusy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {backupBusy ? t('backup.doing') : t('set.backupNow')}
          </button>
          {backupMsg && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{backupMsg}</span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="font-medium">🔁 {t('set.backupAuto')}</p>
          <button
            onClick={toggleBackupAuto}
            disabled={!user}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              backupAuto
                ? 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400'
                : 'border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
            }`}
          >
            {backupAuto ? t('set.on') : t('set.off')}
          </button>
        </div>
      </div>

      <CurrencyConverter />

      <UsageCard />

      <button
        onClick={() => signOut()}
        className="self-start rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-500 transition hover:bg-red-500/10 dark:text-red-400"
      >
        {t('set.signOut')}
      </button>
    </div>
  )
}
