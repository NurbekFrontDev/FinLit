// ===== Голосовой ввод (ИИ-6) =====
// Диктовка через Web Speech API - встроено в браузер, без зависимостей и ключей.
// Поддерживается в Chrome/Edge и мобильном Chrome. В других браузерах просто недоступно
// (isVoiceSupported вернёт false, и кнопку микрофона мы не показываем).

// Минимальные типы под Web Speech API (в стандартных типах TS их нет).
type SpeechRecognitionResultLike = {
  0: { transcript: string }
  isFinal: boolean
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>
}

type RecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike
    webkitSpeechRecognition?: new () => RecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// Доступна ли диктовка в этом браузере.
export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null
}

export type Dictation = { stop: () => void }

// Запускает распознавание речи. onText вызывается с финальным текстом фразы.
// Возвращает объект с методом stop() или null, если диктовка не поддерживается.
export function startDictation(
  lang: string,
  handlers: { onText: (text: string) => void; onEnd?: () => void; onError?: () => void },
): Dictation | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = lang
  rec.interimResults = false
  rec.continuous = false
  rec.onresult = (e) => {
    let text = ''
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript
    }
    const trimmed = text.trim()
    if (trimmed) handlers.onText(trimmed)
  }
  rec.onerror = () => handlers.onError?.()
  rec.onend = () => handlers.onEnd?.()
  try {
    rec.start()
  } catch {
    return null
  }
  return { stop: () => rec.stop() }
}
