import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  getOrCreateMonth,
  formatSum,
  MONTH_NAMES,
  formatAmountInput,
  parseAmount,
} from '../lib/db'

type Category = { id: string; name: string; percent: number; sort_order: number; archived?: boolean }

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950'

export default function Budget() {
  const { user } = useAuth()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [monthId, setMonthId] = useState<string | null>(null)
  const [goalIncome, setGoalIncome] = useState('')
  const [received, setReceived] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Управление категориями: меню «три точки», переименование, удаление.
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Перетаскивание категорий (мышь + тач) для смены порядка.
  // Во время перетаскивания порядок массива НЕ меняется — вместо этого соседние
  // карточки плавно сдвигаются трансформом, а сама карточка следует за пальцем.
  // Порядок фиксируется и сохраняется автоматически при отпускании — ничего нажимать не нужно.
  const [drag, setDrag] = useState<{
    id: string
    fromIndex: number
    overIndex: number
    startY: number
    offset: number
    slot: number
  } | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const m = await getOrCreateMonth(user.id, year, month)
        const [catRes, incRes] = await Promise.all([
          supabase
            .from('categories')
            .select('id, name, percent, sort_order, archived')
            .eq('user_id', user.id)
            .eq('archived', false)
            .order('sort_order'),
          supabase.from('incomes').select('amount').eq('month_id', m.id),
        ])
        if (!active) return
        if (catRes.error) throw catRes.error
        if (incRes.error) throw incRes.error
        setMonthId(m.id)
        setGoalIncome(m.planned_income ? formatAmountInput(String(m.planned_income)) : '')
        setReceived(
          (incRes.data ?? []).reduce(
            (s: number, r: { amount: number }) => s + Number(r.amount),
            0,
          ),
        )
        setCategories(
          ((catRes.data ?? []) as Category[]).map((c) => ({
            ...c,
            percent: Number(c.percent),
          })),
        )
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [user, year, month])

  const totalPercent = categories.reduce((s, c) => s + Number(c.percent), 0)

  const setPercent = (id: string, val: string) => {
    setCategories((cs) =>
      cs.map((c) => (c.id === id ? { ...c, percent: Number(val) || 0 } : c)),
    )
  }

  // Автосохранение процента категории при уходе из поля.
  const savePercent = async (id: string) => {
    if (!user) return
    const cat = categories.find((c) => c.id === id)
    if (!cat) return
    const { error: pErr } = await supabase
      .from('categories')
      .update({ percent: Number(cat.percent) })
      .eq('id', id)
    if (pErr) setError(pErr.message)
  }

  // Начало перетаскивания: запоминаем высоту карточки (+ gap-2 = 8px) как шаг смещения.
  const startDrag = (e: React.PointerEvent, id: string, index: number) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const el = rowRefs.current.get(id)
    const slot = (el?.offsetHeight ?? 56) + 8
    setDrag({ id, fromIndex: index, overIndex: index, startY: e.clientY, offset: 0, slot })
  }

  // Движение: карточка следует за пальцем (offset), а целевой индекс считаем по смещению.
  const moveDrag = (e: React.PointerEvent) => {
    const clientY = e.clientY
    setDrag((d) => {
      if (!d) return d
      const offset = clientY - d.startY
      const steps = Math.round(offset / d.slot)
      const overIndex = Math.max(0, Math.min(categories.length - 1, d.fromIndex + steps))
      if (offset === d.offset && overIndex === d.overIndex) return d
      return { ...d, offset, overIndex }
    })
  }

  // Отпускание: фиксируем новый порядок и сразу сохраняем sort_order в БД.
  const endDrag = async () => {
    const d = drag
    setDrag(null)
    if (!d || d.overIndex === d.fromIndex) return
    const next = categories.slice()
    const [moved] = next.splice(d.fromIndex, 1)
    next.splice(d.overIndex, 0, moved)
    const reordered = next.map((c, i) => ({ ...c, sort_order: i + 1 }))
    setCategories(reordered)
    const results = await Promise.all(
      reordered.map((c) =>
        supabase.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id),
      ),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) setError(failed.error.message)
  }

  // Стиль карточки во время перетаскивания: соседи освобождают место (плавно),
  // а активная карточка следует за пальцем и слегка увеличивается.
  const dragStyle = (id: string, index: number): React.CSSProperties | undefined => {
    if (!drag) return undefined
    if (id === drag.id) {
      return {
        transform: `translateY(${drag.offset}px) scale(1.03)`,
        transition: 'none',
        position: 'relative',
        zIndex: 30,
      }
    }
    let shift = 0
    if (drag.overIndex > drag.fromIndex && index > drag.fromIndex && index <= drag.overIndex)
      shift = -drag.slot
    else if (drag.overIndex < drag.fromIndex && index >= drag.overIndex && index < drag.fromIndex)
      shift = drag.slot
    return {
      transform: `translateY(${shift}px)`,
      transition: 'transform 180ms cubic-bezier(0.2, 0, 0, 1)',
    }
  }

  const addCategory = async () => {
    if (!user || !newCatName.trim()) return
    const name = newCatName.trim()
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0)

    // Не создаём дубликат активной категории с таким же именем.
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError('Категория с таким названием уже есть.')
      return
    }

    // Если такая категория была удалена раньше — возвращаем ту же строку (снимаем архив),
    // чтобы прошлые расходы в истории снова показывали актуальное название без «(удалена)».
    const { data: revived, error: findErr } = await supabase
      .from('categories')
      .select('id, name, percent, sort_order, archived')
      .eq('user_id', user.id)
      .eq('archived', true)
      .ilike('name', name)
      .order('created_at', { ascending: true })
      .limit(1)
    if (findErr) {
      setError(findErr.message)
      return
    }
    if (revived && revived.length > 0) {
      const found = revived[0] as Category
      const { error: upErr } = await supabase
        .from('categories')
        .update({ archived: false, sort_order: maxOrder + 1 })
        .eq('id', found.id)
      if (upErr) {
        setError(upErr.message)
        return
      }
      setCategories([
        ...categories,
        { ...found, percent: Number(found.percent), sort_order: maxOrder + 1, archived: false },
      ])
      setNewCatName('')
      setError(null)
      return
    }

    const { data, error: addErr } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name, percent: 0, sort_order: maxOrder + 1 })
      .select('id, name, percent, sort_order, archived')
      .single()
    if (addErr || !data) {
      setError(addErr?.message ?? 'Не удалось добавить категорию')
      return
    }
    const c = data as Category
    setCategories([...categories, { ...c, percent: Number(c.percent) }])
    setNewCatName('')
    setError(null)
  }

  // Переименование: расходы связаны с категорией по id, поэтому смена названия безопасна.
  const startRename = (c: Category) => {
    setMenuId(null)
    setEditingId(c.id)
    setEditingName(c.name)
    setError(null)
  }
  const cancelRename = () => {
    setEditingId(null)
    setEditingName('')
  }
  const saveRename = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    const { error: rErr } = await supabase.from('categories').update({ name }).eq('id', editingId)
    if (rErr) {
      setError(rErr.message)
      return
    }
    setCategories((cs) => cs.map((c) => (c.id === editingId ? { ...c, name } : c)))
    cancelRename()
  }

  // Мягкое удаление: archived = true. Строка остаётся в БД, чтобы история хранила название.
  const confirmCat = categories.find((c) => c.id === confirmId) ?? null
  const confirmRemove = async () => {
    if (!confirmId) return
    const { error: delErr } = await supabase
      .from('categories')
      .update({ archived: true })
      .eq('id', confirmId)
    if (delErr) {
      setError(delErr.message)
      setConfirmId(null)
      return
    }
    setCategories((cs) => cs.filter((x) => x.id !== confirmId))
    setConfirmId(null)
  }

  // Автосохранение «Цели по доходу» при уходе из поля (пустое значение очищает её).
  const saveGoalIncome = async () => {
    if (!user || !monthId) return
    const { error: mErr } = await supabase
      .from('months')
      .update({ planned_income: parseAmount(goalIncome) })
      .eq('id', monthId)
    if (mErr) setError(mErr.message)
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">📊 Бюджет / План · {MONTH_NAMES[month - 1]}</h1>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Загрузка…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Получено в этом месяце</span>
              <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatSum(received)}</span>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">Цель по доходу (ориентир)</label>
              <input
                inputMode="numeric"
                value={goalIncome}
                onChange={(e) => setGoalIncome(formatAmountInput(e.target.value))}
                onBlur={saveGoalIncome}
                placeholder="Например, 10 000 000"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Категории и проценты</span>
              <span
                className={`text-sm ${
                  totalPercent === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                Сумма: {totalPercent}%
              </span>
            </div>

            {categories.map((c, index) =>
              editingId === c.id ? (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-neutral-50 px-3 py-3 dark:bg-neutral-900/40"
                >
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveRename()
                      } else if (e.key === 'Escape') {
                        cancelRename()
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <button
                    type="button"
                    onClick={saveRename}
                    className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <div
                  key={c.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(c.id, el)
                    else rowRefs.current.delete(c.id)
                  }}
                  style={dragStyle(c.id, index)}
                  className={`relative flex flex-col gap-1.5 rounded-xl border bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900/40 ${
                    drag?.id === c.id
                      ? 'border-emerald-500/60 shadow-xl ring-1 ring-emerald-500/40'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Перетащить для смены порядка"
                    title="Перетащи, чтобы изменить порядок"
                    onPointerDown={(e) => startDrag(e, c.id, index)}
                    onPointerMove={moveDrag}
                    onPointerUp={(e) => {
                      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                      endDrag()
                    }}
                    onPointerCancel={endDrag}
                    className="shrink-0 cursor-grab touch-none select-none px-1 text-lg leading-none text-neutral-400 transition hover:text-neutral-600 active:cursor-grabbing dark:text-neutral-500 dark:hover:text-neutral-300"
                  >
                    ⠿
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  <input
                    inputMode="numeric"
                    value={String(c.percent)}
                    onChange={(e) => setPercent(c.id, e.target.value)}
                    onBlur={() => savePercent(c.id)}
                    className="w-14 shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-center text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <span className="shrink-0 text-sm text-neutral-500">%</span>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                      title="Действия"
                      className="px-1.5 text-lg leading-none text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      ⋯
                    </button>
                    {menuId === c.id && (
                      <div className="animate-pop absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                        <button
                          type="button"
                          onClick={() => startRename(c)}
                          className="block w-full px-3 py-2 text-left text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          ✏️ Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId(null)
                            setConfirmId(c.id)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-500/10 dark:text-red-400"
                        >
                          🗑️ Удалить
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                  <div className="flex items-center justify-between pl-7 text-xs">
                    <span className="text-neutral-400 dark:text-neutral-500">В этом месяце</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatSum((received * Number(c.percent)) / 100)}
                    </span>
                  </div>
                </div>
              ),
            )}

            <div className="mt-1 flex gap-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCategory()
                  }
                }}
                placeholder="Новая категория"
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
              />
              <button
                type="button"
                onClick={addCategory}
                className="shrink-0 rounded-lg border border-emerald-500/50 px-3 py-2 text-sm text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                + Добавить
              </button>
            </div>
          </div>

          {totalPercent !== 100 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Сумма процентов = {totalPercent}%. Рекомендуется ровно 100%.
            </p>
          )}
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        </div>
      )}

      {/* Клик вне меню — закрыть. */}
      {menuId !== null && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setMenuId(null)}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Удалить категорию?"
        danger
        confirmLabel="Удалить"
        onCancel={() => setConfirmId(null)}
        onConfirm={confirmRemove}
        message={
          <>
            Категория <b>«{confirmCat?.name ?? ''}»</b> будет убрана из списка. Прошлые расходы
            останутся в истории с пометкой «(удалена)».
          </>
        }
      />
    </div>
  )
}
