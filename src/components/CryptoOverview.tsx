import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useLang } from '../lib/i18n'
import { monthName } from '../lib/db'
import IconButton from './IconButton'
import ConfirmDialog from './ConfirmDialog'
import Select from './Select'
import {
  loadCryptoSnapshotLive,
  loadMonthly,
  loadNetDepositByMonth,
  upsertMonthly,
  deleteMonthly,
  fmtUsd,
  fmtPct,
  parseNum,
  type CryptoSnapshot,
  type MonthlyStats,
} from '../lib/crypto'

const cardCls =
  'rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50'
const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-950'
const btnPrimary =
  'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50'
const btnGhost =
  'rounded-lg border border-neutral-300 px-3 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const labelCls = 'mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400'

const now = new Date()

export default function CryptoOverview() {
  const { user } = useAuth()
  const { t } = useLang()

  const [snapshot, setSnapshot] = useState<CryptoSnapshot | null>(null)
  const [monthly, setMonthly] = useState<MonthlyStats[]>([])
  const [buys, setBuys] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Форма добавления месяца
  const [aYear, setAYear] = useState(String(now.getFullYear()))
  const [aMonth, setAMonth] = useState(now.getMonth()) // 0..11
  const [aStart, setAStart] = useState('')
  const [aDeposit, setADeposit] = useState('')
  const [aEnd, setAEnd] = useState('')
  const [aNote, setANote] = useState('')
  const [errValue, setErrValue] = useState(false)
  const [saving, setSaving] = useState(false)

  const [toDelete, setToDelete] = useState<MonthlyStats | null>(null)

  // Время последнего обновления живых цен (для индикатора «Цены обновлены: HH:MM»).
  const [pricedAt, setPricedAt] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [snap, months, buysMap] = await Promise.all([
        loadCryptoSnapshotLive(user.id),
        loadMonthly(user.id),
        loadNetDepositByMonth(user.id),
      ])
      setSnapshot(snap)
      setMonthly(months)
      setBuys(buysMap)
      setPricedAt(
        new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  // При выборе месяца/года подставляем уже сохранённые значения этого месяца,
  // чтобы правка была безопасной: «пополнение по частям» обновляет общий итог,
  // а не затирает его вслепую. Если записи за месяц ещё нет — в «стоимость на
  // конец» подставляем текущую стоимость портфеля (можно изменить вручную).
  useEffect(() => {
    const existing = monthly.find(
      (m) => m.year === Number(aYear) && m.month === aMonth + 1,
    )
    if (existing) {
      setAStart(String(existing.start_value_usd))
      setADeposit(String(existing.deposit_usd))
      setAEnd(String(existing.end_value_usd))
      setANote(existing.note ?? '')
      return
    }
    setANote('')
    // «Депозит за месяц» подставляем чистым депозитом за месяц (покупки минус продажи):
    // ротация (продал одну монету и купил другую) не считается новыми деньгами. Можно изменить вручную.
    const buyKey = Number(aYear) + '-' + (aMonth + 1)
    setADeposit(buys[buyKey] ? String(buys[buyKey]) : '')
    // Стоимость на начало подставляем с конца предыдущего месяца (если он есть).
    const selKey = Number(aYear) * 12 + aMonth
    const prev = monthly
      .map((m) => ({ m, key: m.year * 12 + (m.month - 1) }))
      .filter((x) => x.key < selKey)
      .sort((a, b) => b.key - a.key)[0]
    setAStart(prev ? String(prev.m.end_value_usd) : '')
    const v = snapshot?.spotValue
    setAEnd(v != null && !Number.isNaN(v) ? String(Math.round(v * 100) / 100) : '')
  }, [aMonth, aYear, monthly, snapshot, buys])

  async function handleSave() {
    if (!user) return
    const start = parseNum(aStart)
    const deposit = parseNum(aDeposit)
    const end = parseNum(aEnd)
    const year = Number(aYear)
    if (end <= 0 || deposit < 0 || start < 0 || !year) {
      setErrValue(true)
      return
    }
    setErrValue(false)
    setSaving(true)
    setError(null)
    try {
      await upsertMonthly(user.id, {
        year,
        month: aMonth + 1,
        start_value_usd: start,
        deposit_usd: deposit,
        end_value_usd: end,
        note: aNote || null,
      })
      setAStart('')
      setADeposit('')
      setAEnd('')
      setANote('')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setError(null)
    try {
      await deleteMonthly(toDelete.id)
      setToDelete(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const pnlColor = (n: number | null | undefined) =>
    n == null
      ? 'text-neutral-500 dark:text-neutral-400'
      : n > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : n < 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-neutral-500 dark:text-neutral-400'

  const monthLabel = (m: MonthlyStats) => monthName(m.month - 1) + ' ' + m.year

  // Всего внесено своих денег = сумма всех депозитов за все месяцы (без прибыли).
  const netDeposited = monthly.reduce((s, m) => s + Number(m.deposit_usd), 0)

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Снимок */}
      {snapshot && (
        <div className={cardCls}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t('ov.snapshot')}</span>
            <div className="flex items-center gap-2">
              {pricedAt && (
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {t('inv.pricedAt', { t: pricedAt })}
                </span>
              )}
              <button
                type="button"
                onClick={() => void reload()}
                disabled={loading}
                className={btnGhost + ' shrink-0 whitespace-nowrap'}
              >
                {t('inv.refreshPrices')}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {/* Спот */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className={labelCls}>{t('ov.spotInvested')}</div>
                <div className="text-base font-semibold">
                  {fmtUsd(snapshot.spotInvested)}
                </div>
              </div>
              <div>
                <div className={labelCls}>{t('ov.spotValue')}</div>
                <div className="text-base font-semibold">
                  {fmtUsd(snapshot.spotValue)}
                </div>
              </div>
              <div>
                <div className={labelCls}>{t('ov.spotPnl')}</div>
                <div className={'text-base font-semibold ' + pnlColor(snapshot.spotPnl)}>
                  {fmtUsd(snapshot.spotPnl)}
                </div>
              </div>
            </div>

            {/* Линия между спотом и фьючерсами */}
            <div className="border-t border-neutral-200 dark:border-neutral-800" />

            {/* Фьючерсы */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className={labelCls}>{t('ov.futuresMargin')}</div>
                <div className="text-base font-semibold">
                  {fmtUsd(snapshot.futuresMargin)}
                </div>
              </div>
              <div>
                <div className={labelCls}>{t('ov.futuresPnl')}</div>
                <div
                  className={'text-base font-semibold ' + pnlColor(snapshot.futuresClosedPnl)}
                >
                  {fmtUsd(snapshot.futuresClosedPnl)}
                </div>
              </div>
              <div>
                <div className={labelCls}>{t('ov.openPositions')}</div>
                <div className="text-base font-semibold">
                  {t('ov.openSpot', { n: snapshot.openSpotCount })}
                  {' · '}
                  {t('ov.openFutures', { n: snapshot.openFuturesCount })}
                </div>
              </div>
            </div>

            {/* Линия перед итогом по деньгам */}
            <div className="border-t border-neutral-200 dark:border-neutral-800" />

            {/* Всего внесено своих денег */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className={labelCls}>{t('ov.netDeposited')}</div>
                <div className="text-base font-semibold">{fmtUsd(netDeposited)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Помесячная сводка */}
      <div className={cardCls}>
        <div className="mb-3 text-sm font-medium">{t('ov.monthly')}</div>
        {monthly.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {t('ov.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1 px-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="h-8 w-8 shrink-0" />
              <div className="grid flex-1 grid-cols-12 gap-2">
                <div className="col-span-4">{t('ov.month')}</div>
                <div className="col-span-2 text-right">{t('ov.startCol')}</div>
                <div className="col-span-2 text-right">{t('ov.depositCol')}</div>
                <div className="col-span-2 text-right">{t('ov.endCol')}</div>
                <div className="col-span-2 text-right">{t('ov.pnlCol')}</div>
              </div>
            </div>
            {monthly.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1 rounded-xl border border-neutral-200 px-2 py-2 text-sm dark:border-neutral-800"
              >
                <IconButton
                  icon="delete"
                  onClick={() => setToDelete(m)}
                  title={t('common.delete')}
                />
                <div className="grid flex-1 grid-cols-12 items-center gap-2">
                  <span className="col-span-4 min-w-0 truncate font-medium">
                    {monthLabel(m)}
                  </span>
                  <div className="col-span-2 text-right">{fmtUsd(m.start_value_usd)}</div>
                  <div className="col-span-2 text-right">{fmtUsd(m.deposit_usd)}</div>
                  <div className="col-span-2 text-right">{fmtUsd(m.end_value_usd)}</div>
                  <div className={'col-span-2 text-right font-medium ' + pnlColor(m.pnl)}>
                    {fmtUsd(m.pnl)}
                    <span className="block text-xs">{fmtPct(m.pnlPct)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Форма добавления / обновления месяца */}
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div className="mb-3 text-sm font-medium">{t('ov.addMonth')}</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('ov.month')}</label>
                <Select
                  value={aMonth}
                  onChange={(v) => setAMonth(Number(v))}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: i,
                    label: monthName(i),
                  }))}
                />
              </div>
              <div>
                <label className={labelCls}>{t('ov.year')}</label>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={aYear}
                  onChange={(e) => setAYear(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('ov.startValue')}</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={aStart}
                  onChange={(e) => setAStart(e.target.value)}
                  placeholder="0"
                />
                <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {t('ov.startHint')}
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('ov.deposit')}</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={aDeposit}
                  onChange={(e) => setADeposit(e.target.value)}
                  placeholder="0"
                />
                <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {t('ov.depositAutoHint')}
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs dark:bg-neutral-800/40">
              <span className="text-neutral-500 dark:text-neutral-400">
                {t('ov.investedSum')}:{' '}
              </span>
              <span className="font-semibold">
                {fmtUsd(parseNum(aStart) + parseNum(aDeposit))}
              </span>
              <div className="mt-0.5 text-neutral-400 dark:text-neutral-500">
                {t('ov.investedHint')}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('ov.endValue')}</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={aEnd}
                  onChange={(e) => setAEnd(e.target.value)}
                  placeholder="0"
                />
                <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {t('ov.endHint')}
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('ov.resultPreview')}</label>
                <div
                  className={
                    'rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium dark:border-neutral-800 ' +
                    pnlColor(parseNum(aEnd) - parseNum(aStart) - parseNum(aDeposit))
                  }
                >
                  {fmtUsd(parseNum(aEnd) - parseNum(aStart) - parseNum(aDeposit))}
                </div>
                <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {t('ov.resultHint')}
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('ov.note')}</label>
              <input
                className={inputCls}
                value={aNote}
                onChange={(e) => setANote(e.target.value)}
              />
            </div>
            {errValue && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {t('ov.errValue')}
              </div>
            )}
            <button className={btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('ov.saveMonth')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={t('ov.deleteMonth')}
        message={t('ov.deleteMonthMsg', { m: toDelete ? monthLabel(toDelete) : '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
