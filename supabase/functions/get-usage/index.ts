// Supabase Edge Function: get-usage
// Назначение: собрать использование и лимиты бесплатных тарифов Supabase и Vercel
// в одном месте для минималистичной карточки в Настройках.
//
// Безопасность: все токены лежат ТОЛЬКО в секретах Supabase и никогда не попадают
// в браузер/бандл. Поэтому ходим за цифрами на сервере (Deno), как в get-rate / ai-chat.
//
// Секреты (Project Settings -> Edge Functions -> Secrets):
//   SB_ACCESS_TOKEN  — личный токен Supabase (Account -> Access Tokens), для egress
//   SB_PROJECT_REF   — ref проекта (например ewgrcmswwvbtoxdxkvuv)
//   (префикс SUPABASE_ зарезервирован Supabase, поэтому имена без него)
//   VERCEL_TOKEN           — токен Vercel (Account Settings -> Tokens)
//   VERCEL_TEAM_ID         — (необязательно) id команды, если проект в команде
// Авто-доступны (заданы в Supabase автоматически): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   — используются для размера БД и Storage через RPC (миграция migration-usage-stats.sql).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function reply(obj: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const MB = 1024 * 1024
const GB = 1024 * 1024 * 1024
const LIMITS = { db: 500 * MB, storage: GB, egress: 5 * GB, vercel: 100 * GB }

// Размер БД и Storage через RPC (service_role, ключ только на сервере).
async function rpcNumber(fn: string): Promise<number | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  try {
    const res = await fetch(url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    if (!res.ok) return null
    const v = await res.json()
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

// Egress Supabase — best-effort через Management API (эндпоинт может меняться).
// При ошибке возвращаем null — UI покажет только лимит и ссылку на дашборд.
async function supabaseEgress(): Promise<number | null> {
  const token = Deno.env.get('SB_ACCESS_TOKEN')
  const ref = Deno.env.get('SB_PROJECT_REF')
  if (!token || !ref) return null
  try {
    const res = await fetch('https://api.supabase.com/v1/projects/' + ref + '/usage', {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!res.ok) return null
    const j: any = await res.json()
    const eg = Number(
      j?.egress?.usage ?? j?.db_egress?.usage ?? j?.total_egress ?? j?.egress ?? NaN,
    )
    return Number.isFinite(eg) && eg >= 0 ? eg : null
  } catch {
    return null
  }
}

// Vercel bandwidth — best-effort. Стабильного публичного эндпоинта для Hobby нет,
// поэтому при недоступности возвращаем null (UI покажет только лимит).
async function vercelBandwidth(): Promise<number | null> {
  const token = Deno.env.get('VERCEL_TOKEN')
  if (!token) return null
  const teamId = Deno.env.get('VERCEL_TEAM_ID')
  const q = teamId ? '?teamId=' + teamId : ''
  try {
    const res = await fetch('https://api.vercel.com/v1/usage' + q, {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!res.ok) return null
    const j: any = await res.json()
    const bw = Number(j?.bandwidth?.total ?? j?.bandwidth ?? NaN)
    return Number.isFinite(bw) && bw >= 0 ? bw : null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const [dbBytes, storageBytes, egress, vercel] = await Promise.all([
      rpcNumber('db_size'),
      rpcNumber('storage_size'),
      supabaseEgress(),
      vercelBandwidth(),
    ])

    const metric = (used: number | null, limit: number) => ({
      usedBytes: used,
      limitBytes: limit,
      live: used != null,
    })

    return reply({
      db: metric(dbBytes, LIMITS.db),
      storage: metric(storageBytes, LIMITS.storage),
      egress: metric(egress, LIMITS.egress),
      vercel: metric(vercel, LIMITS.vercel),
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return reply({ error: String(e) }, 500)
  }
})
