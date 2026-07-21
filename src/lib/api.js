import { supabase } from './supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

/**
 * Zavolá Supabase Edge Function s auth tokenem aktuální session.
 * Vyhazuje Error se srozumitelnou zprávou při chybě.
 */
export async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Nejsi přihlášen/a.')
  }

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body ?? {}),
  })

  let payload
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const message = payload?.error || `Chyba serveru (${res.status})`
    throw new Error(message)
  }

  return payload
}
