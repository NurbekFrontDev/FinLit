import { useAuth } from '../lib/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Дашборд</h1>
      <p className="text-neutral-400">Привет, {user?.email} 👋</p>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-neutral-400">
        Здесь скоро появится обзор месяца и «план против факта». 📊
      </div>
    </div>
  )
}
