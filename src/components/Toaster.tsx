import { useEffect, useState } from 'react'
import { TOAST_EVENT } from '../lib/toast'

type Toast = { id: number; msg: string }

// Показывает всплывающие уведомления (тосты) снизу по центру. Слушает события
// showToast() и сам убирает сообщение через несколько секунд.
export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent).detail as string
      if (!msg) return
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, msg }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-pop pointer-events-auto max-w-sm rounded-xl bg-neutral-900 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}
