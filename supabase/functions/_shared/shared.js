// Sdílené utility pro Supabase Edge Functions — auth, rate limit, volání
// OpenAI API, parsování JSON. Deno runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const DAILY_LIMIT = 15
const OPENAI_MODEL = 'gpt-4o'

export function jsonResponse(statusCode, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

function adminClient() {
  // SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY jsou v Edge Functions vždy
  // dostupné automaticky (Supabase je injectuje, nejde je přepsat ručně).
  return createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

/** Ověří JWT z Authorization headeru a vrátí { user, supabase }. Vyhazuje Error při selhání. */
export async function verifyAuth(req) {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
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

/** Zavolá OpenAI Chat Completions API a vrátí kompletní zprávu asistenta (včetně tool_calls). */
export async function callAIRaw({ messages, tools, maxTokens = 4096 }) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    const err = new Error('Server není správně nakonfigurován (chybí API klíč).')
    err.statusCode = 500
    throw err
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      messages,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const err = new Error(`Volání AI se nezdařilo (${res.status}): ${errText.slice(0, 200)}`)
    err.statusCode = 502
    throw err
  }

  const data = await res.json()
  const message = data.choices?.[0]?.message
  if (!message) {
    const err = new Error('AI nevrátila žádnou odpověď.')
    err.statusCode = 502
    throw err
  }
  return message
}

/** Zavolá OpenAI API a vrátí jen textovou odpověď (bez function calling). */
export async function callAI({ system, prompt, maxTokens = 4096 }) {
  const message = await callAIRaw({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    maxTokens,
  })
  return message.content ?? ''
}

const ALLERGEN_LABELS = {
  lepek: 'lepek (obiloviny)',
  korysi: 'korýši',
  vejce: 'vejce',
  ryby: 'ryby',
  arasidy: 'arašídy',
  soja: 'sója',
  mleko: 'mléko (laktóza)',
  orechy: 'skořápkové plody (ořechy)',
  celer: 'celer',
  horcice: 'hořčice',
  sezam: 'sezamová semena',
  siriciny: 'oxid siřičitý a siřičitany',
  vlci_bob: 'vlčí bob (lupina)',
  mekkysi: 'měkkýši',
}

/** Sestaví blok textu s rozpočtem, preferencemi a alergeny z profilu pro vložení do promptu. */
export function buildPreferencesPrompt(profile) {
  const lines = []
  if (profile.budget_czk_week) {
    lines.push(`- maximální rozpočet na jídlo: ${profile.budget_czk_week} Kč/týden — nepřekračuj ho`)
  }
  if (profile.favorite_foods) {
    lines.push(`- oblíbené potraviny (zařazuj častěji): ${profile.favorite_foods}`)
  }
  if (profile.disliked_foods) {
    lines.push(`- nechtěné potraviny (nepoužívej): ${profile.disliked_foods}`)
  }
  if (profile.allergens?.length) {
    const labels = profile.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(', ')
    lines.push(`- alergeny/intolerance (bezpodmínečně vynech): ${labels}`)
  }
  return lines.length ? `\nDalší požadavky uživatele:\n${lines.join('\n')}\n` : ''
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
