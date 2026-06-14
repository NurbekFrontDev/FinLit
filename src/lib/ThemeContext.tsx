import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'
type ThemeCtx = { theme: Theme; toggle: () => void }

const ThemeContext = createContext<ThemeCtx | undefined>(undefined)

function getInitial(): Theme {
  try {
    const saved = localStorage.getItem('finlit-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage может быть недоступен — остаёмся на тёмной теме
  }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('finlit-theme', theme)
    } catch {
      // игнорируем ошибки хранилища
    }
  }, [theme])

  // Плавно переключаем тему: на момент смены навешиваем класс с transition,
  // затем снимаем его, чтобы не замедлять обычные hover-эффекты.
  const toggle = () => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    window.setTimeout(() => root.classList.remove('theme-transition'), 360)
  }

  return (
    <ThemeContext.Provider value={ { theme, toggle } }>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
