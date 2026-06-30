import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useLang } from '../lib/i18n'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import IconButton from '../components/IconButton'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  loadAllItems,
  createItem,
  updateItem,
  archiveItem,
  todayStr,
  PRIORITY_DOT,
  type PlannerItem,
  type RepeatRule,
  type Priority,
  type TimeOfDay,
  type ItemInput,
} from '../lib/planner'

// Экран «Мои дела» (П-4): заведение, изменение и удаление дел с авто-повтором
// (разовое, каждый день, будни, по выбранным дням недели), временем/интервалом,
// важностью и секцией дня. Заведённые дела сами появляются в нужные дни на
// экране «Сегодня». Привычки (со стриком) делаем отдельно на этапе П-5.

const cardCls =
  'rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50'
const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950'
const labelCls = 'mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400'

type FormState = {
  title: string
  note: string
  repeat_rule: RepeatRule
  weekdays: number[]
  start_date: string
  priority: Priority
  time_of_day: TimeOfDay
  at_time_start: string
  at_time_end: string
  icon: string
}

const emptyForm = (): FormState => ({
  title: '',
  note: '',
  repeat_rule: 'none',
  weekdays: [],
  start_date: todayStr(),
  priority: 'none',
  time_of_day: null,
  at_time_start: '',
  at_time_end: '',
  icon: '',
})

export default function PlannerItems() {
  const { user } = useAuth()
  const { t, lang } = useLang()

  const [items, setItems] = useState<PlannerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [delItem, setDelItem] = useState<PlannerItem | null>(null)

  const WEEKDAYS =
    lang === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const data = await loadAllItems(user.id)
        if (!active) return
        setItems(data)
        setError(null)
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  const reload = async () => {
    if (!user) return
    const data = await loadAllItems(user.id)
    setItems(data)
  }

  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  const openEdit = (it: PlannerItem) => {
    setEditId(it.id)
    setForm({
      title: it.title,
      note: it.note ?? '',
      repeat_rule: it.repeat_rule,
      weekdays: it.weekdays ?? [],
      start_date: it.start_date ?? todayStr(),
      priority: it.priority,
      time_of_day: it.time_of_day,
      at_time_start: it.at_time_start ?? '',
      at_time_end: it.at_time_end ?? '',
      icon: it.icon ?? '',
    })
    setShowForm(true)
  }

  const cancel = () => {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm())
  }

  const toggleWeekday = (d: number) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d)
        ? f.weekdays.filter((x) => x !== d)
        : [...f.weekdays, d].sort((a, b) => a - b),
    }))
  }

  const submit = async () => {
    if (!user) return
    if (!form.title.trim()) {
      setError(t('items.errTitle'))
      return
    }
    if (form.repeat_rule === 'weekly' && form.weekdays.length === 0) {
      setError(t('items.errWeekdays'))
      return
    }
    const input: ItemInput = {
      title: form.title.trim(),
      note: form.note.trim() || null,
      type: 'task',
      repeat_rule: form.repeat_rule,
      weekdays: form.weekdays,
      time_of_day: form.time_of_day,
      at_time_start: form.at_time_start || null,
      at_time_end: form.at_time_end || null,
      priority: form.priority,
      start_date: form.start_date || todayStr(),
      icon: form.icon.trim() || null,
    }
    try {
      setSaving(true)
      if (editId) await updateItem(user.id, editId, input)
      else await createItem(user.id, input)
      await reload()
      cancel()
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!user || !delItem) return
    try {
      await archiveItem(user.id, delItem.id)
      setDelItem(null)
      await reload()
    } catch (e) {
      setError((e as Error).message)
      setDelItem(null)
    }
  }

  const describeRepeat = (it: PlannerItem): string => {
    switch (it.repeat_rule) {
      case 'daily':
        return t('items.repeatDaily')
      case 'weekdays':
        return t('items.repeatWeekdays')
      case 'weekly':
        return (it.weekdays ?? []).map((d) => WEEKDAYS[d - 1]).join(', ')
      default:
        return it.start_date ?? ''
    }
  }

  const timeLabel = (it: PlannerItem): string => {
    if (it.at_time_start && it.at_time_end) return `${it.at_time_start}\u2013${it.at_time_end}`
    if (it.at_time_start) return it.at_time_start
    return ''
  }

  const repeatOptions = [
    { value: 'none', label: t('items.repeatNone') },
    { value: 'daily', label: t('items.repeatDaily') },
    { value: 'weekdays', label: t('items.repeatWeekdays') },
    { value: 'weekly', label: t('items.repeatWeekly') },
  ]
  const priorityOptions = [
    { value: 'none', label: t('items.prioNone') },
    { value: 'high', label: t('items.prioHigh') },
    { value: 'medium', label: t('items.prioMedium') },
    { value: 'low', label: t('items.prioLow') },
  ]
  const sectionOptions = [
    { value: 'none', label: t('items.secNone') },
    { value: 'morning', label: t('items.secMorning') },
    { value: 'day', label: t('items.secDay') },
    { value: 'evening', label: t('items.secEvening') },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">🗂️ {t('pnav.items')}</h1>
        {!showForm && (
          <button
            type="button"
            onClick={openAdd}
            className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400"
          >
            {t('items.add')}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {showForm && (
        <div className={`${cardCls} animate-pop flex flex-col gap-4`}>
          <p className="text-sm font-semibold">
            {editId ? t('items.editTitle') : t('items.newTitle')}
          </p>

          <div>
            <label className={labelCls}>{t('items.name')}</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t('items.namePh')}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>{t('common.descOptional')}</label>
            <input
              className={inputCls}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder={t('items.notePh')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>{t('items.repeat')}</label>
              <Select
                value={form.repeat_rule}
                options={repeatOptions}
                onChange={(v) => setForm((f) => ({ ...f, repeat_rule: v as RepeatRule }))}
              />
            </div>
            <div>
              <label className={labelCls}>{t('items.priority')}</label>
              <Select
                value={form.priority}
                options={priorityOptions}
                onChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
              />
            </div>
          </div>

          {form.repeat_rule === 'weekly' && (
            <div>
              <label className={labelCls}>{t('items.weekdays')}</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((w, i) => {
                  const d = i + 1
                  const on = form.weekdays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleWeekday(d)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        on
                          ? 'bg-emerald-500 font-medium text-neutral-950'
                          : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>
              {form.repeat_rule === 'none' ? t('items.startDate') : t('items.startFrom')}
            </label>
            <DatePicker
              value={form.start_date}
              onChange={(v) => setForm((f) => ({ ...f, start_date: v }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>{t('items.section')}</label>
              <Select
                value={form.time_of_day ?? 'none'}
                options={sectionOptions}
                onChange={(v) =>
                  setForm((f) => ({ ...f, time_of_day: v === 'none' ? null : (v as TimeOfDay) }))
                }
              />
            </div>
            <div>
              <label className={labelCls}>{t('items.timeStart')}</label>
              <input
                type="time"
                className={inputCls}
                value={form.at_time_start}
                onChange={(e) => setForm((f) => ({ ...f, at_time_start: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>{t('items.timeEnd')}</label>
              <input
                type="time"
                className={inputCls}
                value={form.at_time_end}
                onChange={(e) => setForm((f) => ({ ...f, at_time_end: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('items.icon')}</label>
            <input
              className={`${inputCls} w-24`}
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="📚"
              maxLength={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? t('common.saving') : t('items.save')}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('items.empty')}</p>
      ) : (
        <section className="flex flex-col gap-2">
          {items.map((it) => {
            const dot = PRIORITY_DOT[it.priority]
            const time = timeLabel(it)
            return (
              <div key={it.id} className={`flex items-center gap-3 ${cardCls}`}>
                {dot && <span className="shrink-0 text-xs leading-none">{dot}</span>}
                {it.icon && <span className="shrink-0">{it.icon}</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {describeRepeat(it)}
                    {time ? ` · ${time}` : ''}
                  </p>
                </div>
                <IconButton icon="edit" title={t('common.edit')} onClick={() => openEdit(it)} />
                <IconButton icon="delete" title={t('common.delete')} onClick={() => setDelItem(it)} />
              </div>
            )
          })}
        </section>
      )}

      <ConfirmDialog
        open={!!delItem}
        title={t('items.deleteTitle')}
        message={delItem ? t('items.deleteMsg', { n: delItem.title }) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDelItem(null)}
      />
    </div>
  )
}
