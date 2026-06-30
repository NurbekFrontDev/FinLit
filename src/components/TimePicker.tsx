import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { useAnimatedMount } from '../lib/useAnimatedMount'

type Props = {
  value: string // 'HH:MM' или ''
  onChange: (v: string) => void
  placeholder?: string
}

const triggerCls =
  'flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-emerald-500 focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950'

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

const colCls =
  'flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-lg bg-neutral-50 p-1 dark:bg-neutral-800/40'
const cellCls = (sel: boolean) =>
  `shrink-0 rounded-md px-2 py-1.5 text-center text-sm transition ${
    sel ? 'bg-emerald-500 font-medium text-neutral-950' : 'hover:bg-emerald-500/10'
  }`

// Выбор времени в стиле приложения (две колонки: часы и минуты). Значение — 'HH:MM'.
// Заменяет браузерный <input type="time">, чтобы вид был единым на всех устройствах.
export default function TimePicker({ value, onChange, placeholder }: Props) {
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const show = useAnimatedMount(open)
  const ref = useRef<HTMLDivElement>(null)

  const [h, m] = value ? value.split(':') : ['', '']

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const setHour = (hh: string) => onChange(`${hh}:${m || '00'}`)
  const setMinute = (mm: string) => onChange(`${h || '00'}:${mm}`)

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerCls}>
        <span className={value ? '' : 'text-neutral-400'}>{value || placeholder || '--:--'}</span>
        <span className="shrink-0 text-neutral-400">🕒</span>
      </button>
      {show && (
        <div
          className={`${
            open ? 'animate-pop' : 'animate-pop-out'
          } absolute z-30 mt-1 w-44 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900`}
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                {lang === 'en' ? 'Hour' : 'Часы'}
              </p>
              <div className={colCls}>
                {HOURS.map((hh) => (
                  <button
                    key={hh}
                    type="button"
                    onClick={() => setHour(hh)}
                    className={cellCls(hh === h)}
                  >
                    {hh}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                {lang === 'en' ? 'Min' : 'Мин'}
              </p>
              <div className={colCls}>
                {MINUTES.map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => setMinute(mm)}
                    className={cellCls(mm === m)}
                  >
                    {mm}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className="mt-2 w-full rounded-md py-1 text-center text-xs text-neutral-500 transition hover:text-red-500 dark:hover:text-red-400"
          >
            {lang === 'en' ? 'Clear' : 'Очистить'}
          </button>
        </div>
      )}
    </div>
  )
}
