import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Incomes from './pages/Incomes'
import Expenses from './pages/Expenses'
import Budget from './pages/Budget'
import Goals from './pages/Goals'
import Investments from './pages/Investments'
import Charity from './pages/Charity'
import History from './pages/History'
import Settings from './pages/Settings'
import PlannerToday from './pages/PlannerToday'
import PlannerItems from './pages/PlannerItems'
import PlannerMatrix from './pages/PlannerMatrix'
import PlannerFocus from './pages/PlannerFocus'
import PlannerStats from './pages/PlannerStats'
import PlannerSettings from './pages/PlannerSettings'
import WaterTracker from './pages/WaterTracker'

function NotFoundRedirect({ fallback }: { fallback: string }) {
  const to = fallback && fallback !== '/login' ? fallback : '/'
  return <Navigate to={to} replace />
}

function App() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [lastPath, setLastPath] = useState('/')
  const [restored, setRestored] = useState(false)
  // Восстановление последней вкладки должно срабатывать ТОЛЬКО один раз при
  // загрузке. Иначе эффект перезапускается на каждой навигации (navigate из
  // react-router меняет идентичность при смене маршрута), и любой переход на '/'
  // (например клик по вкладке FinLit) мгновенно отбрасывает обратно на
  // сохранённый путь — из-за этого "не переключается".
  const didRestore = useRef(false)
  const userId = session?.user?.id

  // Восстановление последней открытой страницы.
  //   1) Мгновенно подставляем значение из localStorage (без мигания),
  //      чтобы на этом устройстве всё работало надёжно в любом случае.
  //   2) Затем берём значение из БД — это источник правды для
  //      синхронизации между телефоном и компьютером.
  useEffect(() => {
    if (!userId) return
    // Только один раз за загрузку (см. комментарий к didRestore выше).
    if (didRestore.current) return
    didRestore.current = true
    let active = true
    const key = `nucleus:last-path:${userId}`

    let localPath = ''
    try {
      localPath = localStorage.getItem(key) || ''
    } catch {
      /* localStorage недоступен */
    }
    if (localPath && localPath !== '/login' && localPath !== '/' && window.location.pathname === '/') {
      setLastPath(localPath)
      navigate(localPath, { replace: true })
    }

    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('last_path')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) {
          // Чаще всего это кеш схемы PostgREST: колонка last_path ещё не видна REST API.
          console.warn('[last_path] ошибка чтения из БД:', error.message)
        }
        const dbPath = (data as { last_path?: string } | null)?.last_path
        if (active && dbPath && dbPath !== '/login') {
          setLastPath(dbPath)
          const here = window.location.pathname
          // Переходим на значение из БД, если пользователь ещё никуда сам не ушёл
          // (мы либо на '/', либо на локальном значении) — это даёт синхрон между устройствами.
          const userMoved = here !== '/' && here !== localPath
          if (dbPath !== here && !userMoved) {
            navigate(dbPath, { replace: true })
          }
        }
      } catch (e) {
        console.warn('[last_path] сбой восстановления:', e)
      } finally {
        if (active) setRestored(true)
      }
    })()

    return () => {
      active = false
    }
  }, [userId, navigate])

  // После восстановления сохраняем текущую страницу: сразу в localStorage
  // (мгновенно, это устройство) и в БД (синхрон между устройствами).
  useEffect(() => {
    if (!restored || !userId) return
    const p = location.pathname
    if (p === '/login') return
    setLastPath(p)
    try {
      localStorage.setItem(`nucleus:last-path:${userId}`, p)
    } catch {
      /* игнорируем */
    }
    void (async () => {
      const { error } = await supabase.from('app_settings').upsert(
        { user_id: userId, last_path: p, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      if (error) {
        console.warn('[last_path] ошибка сохранения в БД:', error.message)
      }
    })()
  }, [restored, userId, location.pathname])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-400">
        Загрузка…
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incomes" element={<Incomes />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/charity" element={<Charity />} />
        <Route path="/debts" element={<Navigate to="/expenses" replace />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/planner" element={<PlannerToday />} />
        <Route path="/planner/items" element={<PlannerItems />} />
        <Route path="/planner/matrix" element={<PlannerMatrix />} />
        <Route path="/planner/habits" element={<Navigate to="/planner/items" replace />} />
        <Route path="/planner/calendar" element={<Navigate to="/planner" replace />} />
        <Route path="/planner/focus" element={<PlannerFocus />} />
        <Route path="/planner/stats" element={<PlannerStats />} />
        <Route path="/planner/settings" element={<PlannerSettings />} />
        <Route path="/planner/water" element={<WaterTracker />} />
        <Route path="*" element={<NotFoundRedirect fallback={lastPath} />} />
      </Route>
    </Routes>
  )
}

export default App
