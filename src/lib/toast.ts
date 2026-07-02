// Простейшая шина всплывающих уведомлений (тостов) поверх всего приложения.
// Любой модуль вызывает showToast('текст'); компонент <Toaster/> в Layout ловит
// событие и показывает сообщение в углу на несколько секунд.
export const TOAST_EVENT = 'nucleus-toast'

export function showToast(message: string): void {
  if (typeof window === 'undefined' || !message) return
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }))
}
