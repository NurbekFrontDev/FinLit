// Supabase Edge Function: get-rate
// Назначение: выдаёт курс валюты (сколько единиц `to` стоит 1 `from`).
// Почему на сервере, а не в браузере: сервер (Deno) может ходить на любые
// сайты без блокировок CORS и прятать API-ключ — именно так работает Jarvis.
//
// Источники по приоритету (сверху — точнее):
//   1) Google Finance — сервер открывает страницу котировки и достаёт цифру, как в Google.
//   2) Поисковый/финансовый API с ключом (если задан секрет RATE_API_KEY).
//   3) ЦБ Узбекистана (cbu.uz) — официальный курс к суму (для to=UZS).
//   4) currency-api и open.er-api.com — бесплатные рыночные источники.

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

// 1) Google Finance — сервер открывает страницу котировки и достаёт ту же цифру,
// которую показывает Google. Браузер так не умеет (CORS), а сервер (Deno) — да.
async function fromGoogleFinance(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch('https://www.google.com/finance/quote/' + from + '-' + to, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    // Точная цена в атрибуте data-last-price.
    let m = html.match(/data-last-price="([\d.]+)"/)
    if (m) {
      const r = Number(m[1])
      if (r > 0) return r
    }
    // Резерв: видимое число в блоке цены.
    m = html.match(/class="YMlKec fxKbKc">([\d,]+\.?\d*)/)
    if (m) {
      const r = Number(m[1].replace(/,/g, ''))
      if (r > 0) return r
    }
    return null
  } catch {
    return null
  }
}

// 2) API с ключом (exchangerate.host). Ключ хранится в секрете RATE_API_KEY и никогда не попадает в браузер.
async function fromKeyedApi(from: string, to: string): Promise<number | null> {
  const key = Deno.env.get('RATE_API_KEY')
  if (!key) return null
  try {
    const url =
      'https://api.exchangerate.host/convert?access_key=' +
      key +
      '&from=' +
      from +
      '&to=' +
      to
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.result ?? json?.info?.rate)
    return rate > 0 ? rate : null
  } catch {
    return null
  }
}

// 2) ЦБ Узбекистана — официальный курс 1 единицы `from` в сумах (только для to=UZS).
async function fromCbu(from: string): Promise<number | null> {
  try {
    const res = await fetch('https://cbu.uz/ru/arkhiv-kursov-valyut/json/' + from + '/')
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(Array.isArray(json) ? json[0]?.Rate : NaN)
    return rate > 0 ? rate : null
  } catch {
    return null
  }
}

// 3) currency-api (без ключа).
async function fromCurrencyApi(from: string, to: string): Promise<number | null> {
  const f = from.toLowerCase()
  const t = to.toLowerCase()
  const urls = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' + f + '.json',
    'https://latest.currency-api.pages.dev/v1/currencies/' + f + '.json',
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const json = await res.json()
      const rate = Number(json?.[f]?.[t])
      if (rate > 0) return rate
    } catch {
      // следующий
    }
  }
  return null
}

// 4) open.er-api.com (резерв, без ключа).
async function fromErApi(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/' + from)
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.rates?.[to])
    return rate > 0 ? rate : null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    let from = 'USD'
    let to = 'UZS'
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      from = String(body.from ?? from).toUpperCase()
      to = String(body.to ?? to).toUpperCase()
    } else {
      const u = new URL(req.url)
      from = (u.searchParams.get('from') ?? from).toUpperCase()
      to = (u.searchParams.get('to') ?? to).toUpperCase()
    }
    if (from === to) return reply({ rate: 1, source: 'same' })

    let rate: number | null = null
    let source = ''

    rate = await fromGoogleFinance(from, to)
    if (rate) source = 'google-finance'
    if (!rate) {
      rate = await fromKeyedApi(from, to)
      if (rate) source = 'exchangerate.host'
    }
    if (!rate && to === 'UZS') {
      rate = await fromCbu(from)
      if (rate) source = 'cbu.uz'
    }
    if (!rate) {
      rate = await fromCurrencyApi(from, to)
      if (rate) source = 'currency-api'
    }
    if (!rate) {
      rate = await fromErApi(from, to)
      if (rate) source = 'er-api'
    }

    if (!rate) return reply({ error: 'rate-not-found', from, to }, 502)
    return reply({ rate: Math.round(rate * 100) / 100, from, to, source })
  } catch (e) {
    return reply({ error: String(e) }, 500)
  }
})
