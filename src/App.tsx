import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './lib/AuthContext'
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

function NotFoundRedirect() {
  const last = (() => {
    try {
      return localStorage.getItem('finlit-last-path')
    } catch {
      return null
    }
  })()
  const to = last && last !== '/login' ? last : '/'
  return <Navigate to={to} replace />
}

function App() {
  const { session, loading } = useAuth()
  const location = useLocation()

  // Remember last visited page (for next session restore).
  useEffect(() => {
    if (session && location.pathname !== '/login') {
      try {
        localStorage.setItem('finlit-last-path', location.pathname)
      } catch {
        // ignore
      }
    }
  }, [session, location.pathname])

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
        <Route path="*" element={<NotFoundRedirect />} />
      </Route>
    </Routes>
  )
}

export default App
