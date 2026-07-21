// Sdílené utility pro Netlify Functions — auth, rate limit, volání Anthropic API, parsování JSON.
import { createClient } from '@supabase/supabase-js'

export const DAILY_LIMIT = 15
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

/** Ověří JWT z Authorization headeru a vrátí { user, supabase }. Vyhazuje Error při selhání. */
export async function verifyAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    const err = new Error('Chybí autentizační token.')
    err.statusCode = 401
    throw err
  }

  const supabase = adminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    const err = new Error('Neplatný nebo expirovaný token.')
    err.statusCode = 401
    throw err
  }

  return { user: data.user, supabase }
}

/** Zkontroluje a inkrementuje denní limit AI dotazů pro uživatele. Vyhazuje Error při překročení. */
export async function checkRateLimit(supabase, userId) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: existing, error: selectError } = await supabase
    .from('ai_usage')
    .select('id, count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (selectError) throw selectError

  if (!existing) {
    const { error: insertError } = await supabase
      .from('ai_usage')
      .insert({ user_id: userId, date: today, count: 1 })
    if (insertError) throw insertError
    return
  }

  if (existing.count >= DAILY_LIMIT) {
    const err = new Error(`Denní limit ${DAILY_LIMIT} AI dotazů byl vyčerpán. Zkus to zítra.`)
    err.statusCode = 429
    throw err
  }

  const { error: updateError } = await supabase
    .from('ai_usage')
    .update({ count: existing.count + 1 })
    .eq('id', existing.id)
  if (updateError) throw updateError
}

/** Zavolá Anthropic API a vrátí textovou odpověď. */
export async function callAnthropic({ system, prompt, maxTokens = 4096 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const err = new Error('Server není správně nakonfigurován (chybí API klíč).')
    err.statusCode = 500
    throw err
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const err = new Error(`Volání AI se nezdařilo (${res.status}): ${errText.slice(0, 200)}`)
    err.statusCode = 502
    throw err
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

/** Vyextrahuje a naparsuje JSON z textové odpovědi AI (i pokud je obalený v ```json bloku). */
export function parseAIJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  try {
    return JSON.parse(raw.trim())
  } catch {
    const err = new Error('AI vrátila neočekávaný formát odpovědi.')
    err.statusCode = 502
    throw err
  }
}
