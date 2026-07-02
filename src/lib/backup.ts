import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

// ===== Бэкап данных одной кнопкой (А-6) =====
// Собираем все данные пользователя из Supabase в один JSON и сохраняем:
//  - в облако: приватный бакет Storage «backups», папка <userId>/;
//  - на устройство: в вебе — скачивание файла; на телефоне — файл в Документы +
//    системное «Поделиться» (можно отправить в Google Drive и т. п.).
// Больше не нужен PowerShell/pg_dump: кнопка работает и на телефоне, и на компьютере.

// Все пользовательские таблицы, попадающие в бэкап. Имена сверены с кодом
// (schema.sql, db.ts, crypto.ts, planner.ts, water.ts, assistant.ts). У всех есть
// колонка user_id, поэтому выгружаем только строки текущего пользователя.
export const BACKUP_TABLES = [
  'app_settings',
  'categories',
  'months',
  'incomes',
  'expenses',
  'currencies',
  'goals',
  'goal_contributions',
  'debts',
  'debt_payments',
  'crypto_assets',
  'crypto_transactions',
  'crypto_futures',
  'crypto_monthly',
  'planner_items',
  'planner_logs',
  'planner_day_order',
  'planner_day_overrides',
  'planner_reflections',
  'pomodoro_sessions',
  'water_logs',
  'ai_messages',
]

const BUCKET = 'backups'

export type BackupResult = {
  fileName: string
  tableCount: number
  rowCount: number
  cloud: boolean
  file: boolean
  skipped: string[]
}

function todayStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Собирает все данные пользователя в один объект. Таблицы, которых нет или к которым
// нет доступа, тихо пропускаются (попадают в skipped), бэкап при этом не падает.
export async function collectBackup(
  userId: string,
): Promise<{ payload: Record<string, unknown>; rowCount: number; skipped: string[] }> {
  const tables: Record<string, unknown> = {}
  let rowCount = 0
  const skipped: string[] = []
  for (const table of BACKUP_TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
      if (error) {
        skipped.push(table)
        continue
      }
      tables[table] = data ?? []
      rowCount += (data ?? []).length
    } catch {
      skipped.push(table)
    }
  }
  const payload = {
    app: 'Nucleus / FinLit',
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    tables,
  }
  return { payload, rowCount, skipped }
}

// Загрузка JSON в приватный бакет Storage, в папку пользователя.
async function uploadToCloud(userId: string, fileName: string, json: string): Promise<boolean> {
  try {
    const path = `${userId}/${fileName}`
    const blob = new Blob([json], { type: 'application/json' })
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'application/json',
      upsert: true,
    })
    return !error
  } catch {
    return false
  }
}

// Сохранение файла на устройство. Веб/десктоп — скачивание через ссылку; телефон —
// запись в Документы + системное «Поделиться» (в Google Drive, мессенджеры и т. п.).
async function saveToDevice(fileName: string, json: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const write = await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: 'Бэкап Nucleus', text: fileName, url: write.uri })
      } catch {
        // «Поделиться» не критично — файл уже в Документах.
      }
      return true
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch {
    return false
  }
}

// Отмечает в app_settings, что бэкап сделан (сбрасывает напоминание BackupReminder).
async function markBackupDone(userId: string, auto: boolean): Promise<void> {
  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = {
    user_id: userId,
    last_backup_at: nowIso,
    backup_snooze_until: null,
    updated_at: nowIso,
  }
  if (auto) patch.last_auto_backup_at = nowIso
  try {
    await supabase.from('app_settings').upsert(patch, { onConflict: 'user_id' })
  } catch {
    // не критично
  }
}

// Главная функция кнопки «Сделать бэкап»: собирает данные, кладёт в облако и
// (по умолчанию) на устройство. Возвращает сводку для показа пользователю.
export async function runBackup(
  userId: string,
  opts?: { toDevice?: boolean; auto?: boolean },
): Promise<BackupResult> {
  const toDevice = opts?.toDevice ?? true
  const { payload, rowCount, skipped } = await collectBackup(userId)
  const json = JSON.stringify(payload, null, 2)
  const fileName = `finlit-backup-${todayStamp()}.json`

  const cloud = await uploadToCloud(userId, fileName, json)
  const file = toDevice ? await saveToDevice(fileName, json) : false

  // Отмечаем как сделанный, только если удалось сохранить хотя бы куда-то.
  if (cloud || file) await markBackupDone(userId, !!opts?.auto)

  return {
    fileName,
    tableCount: Object.keys(payload.tables as Record<string, unknown>).length,
    rowCount,
    cloud,
    file,
    skipped,
  }
}

// Авто-бэкап при открытии приложения: не чаще, чем раз в backup_every_days дней.
// Только в облако (без скачивания файла, чтобы не мешать пользователю). Если рано
// или авто-бэкап выключен — тихо ничего не делает.
export async function maybeAutoBackup(userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('backup_auto, backup_every_days, last_auto_backup_at')
      .eq('user_id', userId)
      .maybeSingle()
    const d = data as {
      backup_auto?: boolean | null
      backup_every_days?: number | null
      last_auto_backup_at?: string | null
    } | null
    if (!d || !d.backup_auto) return
    const everyDays = Number(d.backup_every_days) > 0 ? Number(d.backup_every_days) : 7
    const last = d.last_auto_backup_at ? new Date(d.last_auto_backup_at).getTime() : 0
    if (last) {
      const ageDays = (Date.now() - last) / (24 * 3600 * 1000)
      if (ageDays < everyDays) return
    }
    await runBackup(userId, { toDevice: false, auto: true })
  } catch {
    // авто-бэкап не критичен
  }
}
