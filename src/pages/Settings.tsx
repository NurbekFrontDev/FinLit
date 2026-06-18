import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import Select from '../components/Select'
import CurrencyConverter from '../components/CurrencyConverter'
import { useLang } from '../lib/i18n'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { t, lang, setLang } = useLang()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">⚙️ {t('set.title')}</h1>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('set.signedInAs')}</p>
        <p className="mt-1 font-medium break-all">{user?.email}</p>
      </div>

      {/* Язык интерфейса */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="min-w-0">
          <p className="font-medium">🌐 {t('set.language')}</p>
        </div>
        <div className="w-40 shrink-0">
          <Select
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

      <CurrencyConverter />

      <button
        onClick={() => signOut()}
        className="self-start rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-500 transition hover:bg-red-500/10 dark:text-red-400"
      >
        {t('set.signOut')}
      </button>
    </div>
  )
}
