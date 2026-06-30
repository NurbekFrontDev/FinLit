import { useEffect, useState, type CSSProperties } from 'react'
import { useLang } from '../lib/i18n'
import { loadUsage, type Usage } from '../lib/usage'

// Минималистичная карточка «Хранилище и лимиты» в Настройках.
// Показывает заполнение бесплатных тарифов: база данных, файлы (Storage),
// трафик Supabase (egress) и трафик Vercel. Живые цифры приходят из серверной
// функции get-usage; где живого значения нет — показываем лимит и ссылку на дашборд.

const KB = 1024
const MB = 1024 * 1024
const GB = 1024 * 1024 * 1024

function fmtBytes(n: number, lang: 'ru' | 'en'): string {
  const u = lang === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ'] : ['B', 'KB', 'MB', 'GB']
  if (n >= GB) return (n / GB).toFixed(n / GB >= 10 ? 0 : 1) + ' ' + u[3]
  if (n >= MB) return (n / MB).toFixed(n / MB >= 10 ? 0 : 1) + ' ' + u[2]
  if (n >= KB) return Math.round(n / KB) + ' ' + u[1]
  return Math.round(n) + ' ' + u[0]
}

function barColor(pct: number): string {
  if (pct >= 85) return 'bg-red-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

type Row = { key: 'db' | 'storage' | 'egress' | 'vercel'; name: string; perMonth?: boolean; link?: string }

export default function UsageCard() {
  const { lang } = useLang()
  const ru = lang === 'ru'
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const supaRef = (() => {
    try {
      const host = new URL(import.meta.env.VITE_SUPABASE_URL as string).host
      return host.split('.')[0]
    } catch {
      return ''
    }
  })()

  const refresh = async () => {
    setLoading(true)
    setFailed(false)
    const u = await loadUsage()
    if (u) setUsage(u)
    else setFailed(true)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const base = supaRef ? 'https://supabase.com/dashboard/project/' + supaRef : ''
  const supaUsageLink = base ? base + '/settings/billing/usage' : undefined

  const rows: Row[] = [
    { key: 'db', name: ru ? 'База данных' : 'Database', link: supaUsageLink },
    {
      key: 'storage',
      name: ru ? 'Файлы (Storage)' : 'File storage',
      link: base ? base + '/storage/buckets' : undefined,
    },
    { key: 'egress', name: ru ? 'Трафик Supabase' : 'Supabase egress', perMonth: true, link: supaUsageLink },
    { key: 'vercel', name: ru ? 'Трафик Vercel' : 'Vercel bandwidth', perMonth: true, link: 'https://vercel.com/dashboard/usage' },
  ]

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">💾 {ru ? 'Хранилище и лимиты' : 'Storage & limits'}</p>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {loading ? (ru ? 'Обновляю…' : 'Loading…') : ru ? 'Обновить' : 'Refresh'}
        </button>
      </div>

      {failed && !usage ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          {ru
            ? 'Не удалось получить данные. Проверь, что функция get-usage задеплоена в Supabase.'
            : 'Could not load data. Make sure the get-usage function is deployed in Supabase.'}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {rows.map((r) => {
            const m = usage ? usage[r.key] : undefined
            const used = m?.usedBytes ?? null
            const limit = m?.limitBytes ?? 0
            const pct = used != null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
            const per = r.perMonth ? (ru ? ' / мес' : ' / mo') : ''
            const fillStyle: CSSProperties = { width: pct + '%' }
            const fillClass =
              'h-full rounded-full transition-all ' +
              (used != null ? barColor(pct) : 'bg-neutral-300 dark:bg-neutral-700')
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="shrink-0 text-neutral-500 dark:text-neutral-400">
                    {used != null
                      ? fmtBytes(used, lang) + ' / ' + fmtBytes(limit, lang) + per + ' · ' + pct + '%'
                      : (ru ? 'лимит ' : 'limit ') + fmtBytes(limit, lang) + per}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div className={fillClass} style={fillStyle} />
                </div>
                {used == null && (
                  <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                    {r.link ? (
                      <a href={r.link} target="_blank" rel="noreferrer" className="underline hover:text-emerald-500">
                        {ru ? 'смотреть в дашборде' : 'see in dashboard'}
                      </a>
                    ) : ru ? (
                      'смотреть в дашборде'
                    ) : (
                      'see in dashboard'
                    )}
                  </p>
                )}
              </div>
            )
          })}

          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {ru
              ? 'Бесплатные тарифы: база 500 МБ, файлы 1 ГБ, трафик Supabase 5 ГБ/мес, Vercel 100 ГБ/мес.'
              : 'Free tiers: DB 500 MB, files 1 GB, Supabase egress 5 GB/mo, Vercel 100 GB/mo.'}
          </p>
        </div>
      )}
    </div>
  )
}
